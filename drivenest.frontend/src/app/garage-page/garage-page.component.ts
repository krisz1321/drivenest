import { Component, DestroyRef, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormControl, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { FuelType, Vehicle, VehicleBrand, VehicleModel, VehicleRequest, VehicleService } from '../services/vehicle.service';
import { ProfileService } from '../services/profile.service';
import { AppShellComponent } from '../layout/app-shell.component';
import { Consumption, StatsService } from '../services/stats.service';
import { consumptionLabel, distanceLabel, toConsumption, toDistance } from '../shared/units';
import { VehicleRefuelingsComponent } from '../dashboard/vehicle-refuelings.component';
import { VehicleServicesComponent } from './vehicle-services.component';
import { VehicleImportComponent } from './vehicle-import.component';

function mileageOrder(form: AbstractControl): ValidationErrors | null {
  return form.get('currentKm')!.value < form.get('initialKm')!.value ? { mileageOrder: true } : null;
}
const integer = (control: AbstractControl): ValidationErrors | null =>
  control.value === null || Number.isInteger(control.value) ? null : { integer: true };

@Component({
  selector: 'app-garage-page',
  standalone: true,
  imports: [RouterLink, CommonModule, ReactiveFormsModule, AppShellComponent, VehicleRefuelingsComponent, VehicleServicesComponent, VehicleImportComponent],
  templateUrl: './garage-page.component.html',
  styleUrl: './garage-page.component.scss'
})
export class GaragePageComponent implements OnInit {
  private readonly api = inject(VehicleService);
  private readonly profile = inject(ProfileService);
  private readonly statsApi = inject(StatsService);
  private readonly destroyRef = inject(DestroyRef);
  @ViewChild('vehicleDialog') dialog!: ElementRef<HTMLDialogElement>;
  vehicles: Vehicle[] = [];
  consumption: Record<number, Consumption> = {};
  fuelTypes: FuelType[] = [];
  brands: VehicleBrand[] = [];
  models: VehicleModel[] = [];
  loading = true;
  saving = false;
  loadErrors: string[] = [];
  modalErrors: string[] = [];
  message = '';
  mode: 'create' | 'edit' | 'delete' = 'create';
  target: Vehicle | null = null;
  readonly form = inject(FormBuilder).nonNullable.group({
    source: ['catalog' as 'catalog' | 'custom'],
    brandId: [0],
    vehicleModelID: new FormControl<number | null>(null),
    customMake: ['', [Validators.maxLength(50)]],
    customModel: ['', [Validators.maxLength(50)]],
    licensePlate: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(20)]],
    fuelTypeId: [0, [Validators.required, Validators.min(1), integer]],
    vin: ['', [Validators.pattern(/^[A-Za-z0-9]{17}$/)]],
    year: new FormControl<number | null>(null, [Validators.min(1886), Validators.max(2100), integer]),
    initialKm: [0, [Validators.required, Validators.min(0), Validators.max(2147483647), integer]],
    currentKm: [0, [Validators.required, Validators.min(0), Validators.max(2147483647), integer]]
  }, { validators: mileageOrder });

  get loadError() { return this.loadErrors.join(' '); }
  get currency() { return this.profile.preferences().currency; }
  get modalTitle() { return this.mode === 'create' ? 'Jármű hozzáadása' : this.mode === 'edit' ? 'Jármű szerkesztése' : 'Jármű törlése'; }
  name(vehicle: Vehicle) { return `${vehicle.make} ${vehicle.model}`; }
  number(value: number) { return value.toLocaleString('hu-HU'); }
  fuelName(id: number) { return this.fuelTypes.find(f => f.id === id)?.name ?? '—'; }
  invalid(field: keyof typeof this.form.controls) { const control = this.form.controls[field]; return control.touched && control.invalid; }
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  vehicleId: number | null = null;
  get selectedVehicle() { return this.vehicles.find(vehicle => vehicle.id === this.vehicleId) ?? null; }
  ngOnInit() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const id = params.get('id');
      this.vehicleId = id === null ? null : Number(id);
      this.message = '';
    });
    this.load();
  }

  load() {
    if (this.saving) return;
    this.loading = true;
    this.loadErrors = [];
    forkJoin({
      vehicles: this.api.list().pipe(catchError(() => { this.loadErrors.push('A járművek betöltése nem sikerült. Próbáld újra.'); return of(null); })),
      fuelTypes: this.api.fuelTypes().pipe(catchError(() => { this.loadErrors.push('Az üzemanyagtípusok nem érhetők el. A jármű mentéséhez próbáld újra a betöltést.'); return of(null); })),
      brands: this.api.brands().pipe(catchError(() => { this.loadErrors.push('A járműmárkák nem érhetők el.'); return of(null); })),
      models: this.api.models().pipe(catchError(() => { this.loadErrors.push('A járműmodellek nem érhetők el.'); return of(null); })),
      user: this.profile.load().pipe(catchError(() => { this.loadErrors.push('A profil betöltése nem sikerült.'); return of(null); }))
    }).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading = false)).subscribe(result => {
      if (result.vehicles !== null) {
        this.vehicles = result.vehicles;
        this.loadConsumption();
      }
      if (result.fuelTypes !== null) this.fuelTypes = result.fuelTypes;
      if (result.brands !== null) this.brands = result.brands;
      if (result.models !== null) this.models = result.models;
    });
  }


  // Tankolás/szerviz mentése után a szerver frissíti az óraállást, ezért újratöltjük a járműveket.
  refreshVehicles() {
    this.api.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: vehicles => { this.vehicles = vehicles; this.loadConsumption(); },
      error: () => {} // ha nem sikerül, marad a régi lista
    });
  }

  // Ha egy jármű fogyasztása nem töltődik be, annál N/A marad.
  private loadConsumption() {
    for (const vehicle of this.vehicles) {
      this.statsApi.consumption(vehicle.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: result => this.consumption = { ...this.consumption, [vehicle.id]: result }, error: () => {}
      });
    }
  }

  averageConsumption(vehicle: Vehicle) {
    const value = this.consumption[vehicle.id]?.averageLitersPer100Km ?? null;
    const unit = this.profile.preferences().consumptionUnit;
    return value === null ? 'N/A' : `${toConsumption(value, unit).toLocaleString('hu-HU')} ${consumptionLabel(unit)}`;
  }

  open(mode: 'create' | 'edit' | 'delete', vehicle: Vehicle | null = null) {
    if (this.saving || (mode !== 'create' && !vehicle)) return;
    this.mode = mode;
    this.target = vehicle;
    this.modalErrors = [];
    this.form.reset({ source: 'catalog', brandId: 0, vehicleModelID: null, customMake: '', customModel: '',
      licensePlate: '', fuelTypeId: this.fuelTypes[0]?.id ?? 0,
      vin: '', year: null, initialKm: 0, currentKm: 0 });
    if (vehicle) {
      const selectedModel = this.models.find(model =>
        model.modelName === vehicle.model
        && this.brands.find(brand => brand.id === model.vehicleBrandId)?.brandName === vehicle.make);
      this.form.patchValue({
        source: selectedModel ? 'catalog' : 'custom',
        brandId: selectedModel?.vehicleBrandId ?? 0,
        vehicleModelID: selectedModel?.id ?? null,
        customMake: selectedModel ? '' : vehicle.make,
        customModel: selectedModel ? '' : vehicle.model,
        fuelTypeId: vehicle.fuelTypeId, licensePlate: vehicle.licensePlate, vin: vehicle.vin ?? '',
        year: vehicle.year, initialKm: vehicle.initialKm, currentKm: vehicle.currentKm
      });
    }
    this.dialog.nativeElement.showModal();
  }

  close() { if (!this.saving) this.dialog.nativeElement.close(); }
  cancel(event: Event) { event.preventDefault(); this.close(); }

  save() {
    if (this.saving) return;
    this.modalErrors = [];
    if (this.form.invalid || !this.fuelTypes.length) { this.form.markAllAsTouched(); return; }
    const value = this.form.getRawValue();
    const catalog = value.source === 'catalog';
    if ((catalog && !value.vehicleModelID) ||
      (!catalog && (!value.customMake.trim() || !value.customModel.trim()))) {
      this.modalErrors = [catalog ? 'Válassz márkát és modellt a katalógusból.' : 'Add meg az egyedi márkát és modellt.'];
      return;
    }
    const request: VehicleRequest = { vehicleModelID: catalog ? value.vehicleModelID : null,
      customMake: catalog ? null : value.customMake.trim(), customModel: catalog ? null : value.customModel.trim(),
      fuelTypeId: value.fuelTypeId,
      licensePlate: value.licensePlate.trim().toUpperCase(),
      vin: value.vin ? value.vin.toUpperCase() : null,
      year: value.year, initialKm: value.initialKm, currentKm: value.currentKm };
    this.saving = true;
    const action = this.mode === 'edit' && this.target ? this.api.update(this.target.id, request) : this.api.create(request);
    action.pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.saving = false)).subscribe({
      next: vehicle => {
        this.vehicles = [...this.vehicles.filter(v => v.id !== vehicle.id), vehicle].sort((a, b) => a.id - b.id);
        this.message = this.mode === 'create' ? 'A járművet hozzáadtuk a garázsodhoz.' : 'A jármű adatait mentettük.';
        this.dialog.nativeElement.close();
      },
      error: (error: HttpErrorResponse) => this.modalErrors = this.errors(error)
    });
  }

  modelsForBrand() {
    const brandId = this.form.controls.brandId.value;
    return this.models.filter(model => model.vehicleBrandId === brandId);
  }

  remove() {
    if (this.saving || !this.target) return;
    const id = this.target.id;
    this.saving = true;
    this.modalErrors = [];
    this.api.delete(id).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.saving = false)).subscribe({
      next: () => {
        this.vehicles = this.vehicles.filter(v => v.id !== id);
        this.message = 'A járművet töröltük a garázsodból.';
        this.dialog.nativeElement.close();
        this.closeVehicle();
      },
      error: (error: HttpErrorResponse) => this.modalErrors = this.errors(error)
    });
  }

  private errors(error: HttpErrorResponse): string[] {
    if (error.status === 409 && this.mode === 'delete') return ['A járműhöz kapcsolódó bejegyzések vagy időközbeni változások miatt nem törölhető. Előbb távolítsd el a tankolásait és egyéb kapcsolódó adatait.'];
    const details = error.error?.errors;
    if (details && typeof details === 'object') {
      const messages = Object.values(details).flat().filter((v): v is string => typeof v === 'string');
      if (messages.length) return messages;
    }
    if (error.status === 404) return ['A jármű már nem érhető el. Zárd be az ablakot, majd frissítsd a garázst.'];
    if (error.status === 0) return ['Nem sikerült kapcsolódni a szerverhez. Ellenőrizd a kapcsolatot, majd próbáld újra.'];
    if (typeof error.error?.title === 'string') return [error.error.title];
    return ['A művelet nem sikerült. Próbáld újra.'];
  }
  details(vehicle: Vehicle) {
    return [vehicle.year, this.fuelTypes.find(fuel => fuel.id === vehicle.fuelTypeId)?.name,
      vehicle.vin ? `VIN ${vehicle.vin.slice(0, 6)}…` : null].filter(Boolean).join(' · ');
  }
  mileage(vehicle: Vehicle) {
    const unit = this.profile.preferences().distanceUnit;
    return `${toDistance(vehicle.currentKm, unit).toLocaleString('hu-HU')} ${distanceLabel(unit)}`;
  }
  color(vehicle: Vehicle) { return ['blue', 'bronze', 'green'][vehicle.id % 3]; }

  openVehicle(vehicle: Vehicle) {
    void this.router.navigate(['/garage', vehicle.id]);
  }
  closeVehicle() { void this.router.navigateByUrl('/garage'); }
}
