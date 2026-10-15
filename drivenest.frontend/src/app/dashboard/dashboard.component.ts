import { Component, DestroyRef, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormControl, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { AuthService, LoginResponse } from '../services/auth.service';
import { FuelType, Vehicle, VehicleRequest, VehicleService } from '../services/vehicle.service';
import { VehicleRefuelingsComponent } from './vehicle-refuelings.component';

function mileageOrder(form: AbstractControl): ValidationErrors | null {
  return form.get('currentKm')!.value < form.get('initialKm')!.value ? { mileageOrder: true } : null;
}
const integer = (control: AbstractControl): ValidationErrors | null =>
  control.value === null || Number.isInteger(control.value) ? null : { integer: true };

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, VehicleRefuelingsComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  private readonly api = inject(VehicleService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  @ViewChild('vehicleDialog') dialog!: ElementRef<HTMLDialogElement>;
  readonly dateLabel = new Date().toLocaleDateString('hu-HU', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Europe/Budapest'
  });
  readonly month = new Date().toLocaleDateString('hu-HU', { month: 'long', timeZone: 'Europe/Budapest' });
  readonly stats = [
    { label: 'Utolsó fogyasztás', unit: 'l/100 km', detail: 'Tele tanktól tele tankig', icon: '◉' },
    { label: 'Havi kiadás', unit: 'Ft', detail: 'Minden kategória', icon: '↗' },
    { label: 'Kilométerköltség', unit: 'Ft/km', detail: 'A rögzített időszak alapján', icon: '↔' },
    { label: 'Figyelmet igényel', unit: 'teendő', detail: 'Közelgő emlékeztetők', icon: '!' }
  ];
  vehicles: Vehicle[] = [];
  fuelTypes: FuelType[] = [];
  user: LoginResponse['user'] | null = null;
  loading = true;
  saving = false;
  loadErrors: string[] = [];
  modalErrors: string[] = [];
  message = '';
  mode: 'create' | 'edit' | 'delete' = 'create';
  target: Vehicle | null = null;
  readonly form = inject(FormBuilder).nonNullable.group({
    make: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(50)]],
    model: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(50)]],
    licensePlate: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(20)]],
    fuelTypeId: [0, [Validators.required, Validators.min(1), integer]],
    vin: ['', [Validators.pattern(/^[A-Za-z0-9]{17}$/)]],
    year: new FormControl<number | null>(null, [Validators.min(1886), Validators.max(2100), integer]),
    initialKm: [0, [Validators.required, Validators.min(0), Validators.max(2147483647), integer]],
    currentKm: [0, [Validators.required, Validators.min(0), Validators.max(2147483647), integer]]
  }, { validators: mileageOrder });

  get displayName() { return this.user?.displayName || 'Saját garázs'; }
  get modalTitle() { return this.mode === 'create' ? 'Jármű hozzáadása' : this.mode === 'edit' ? 'Jármű szerkesztése' : 'Jármű törlése'; }
  name(vehicle: Vehicle) { return `${vehicle.make} ${vehicle.model}`; }
  number(value: number) { return value.toLocaleString('hu-HU'); }
  fuelName(id: number) { return this.fuelTypes.find(f => f.id === id)?.name ?? '—'; }
  invalid(field: keyof typeof this.form.controls) { const control = this.form.controls[field]; return control.touched && control.invalid; }
  ngOnInit() { this.load(); }

  load() {
    if (this.saving) return;
    this.loading = true;
    this.loadErrors = [];
    forkJoin({
      vehicles: this.api.list().pipe(catchError(() => { this.loadErrors.push('A járművek betöltése nem sikerült. Próbáld újra.'); return of(null); })),
      fuelTypes: this.api.fuelTypes().pipe(catchError(() => { this.loadErrors.push('Az üzemanyagtípusok nem érhetők el. A jármű mentéséhez próbáld újra a betöltést.'); return of(null); })),
      user: this.auth.me().pipe(catchError(() => { this.loadErrors.push('A profil betöltése nem sikerült.'); return of(null); }))
    }).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading = false)).subscribe(result => {
      if (result.vehicles !== null) {
        this.vehicles = result.vehicles;
      }
      if (result.fuelTypes !== null) this.fuelTypes = result.fuelTypes;
      if (result.user !== null) this.user = result.user;
    });
  }


  open(mode: 'create' | 'edit' | 'delete', vehicle: Vehicle | null = null) {
    if (this.saving || (mode !== 'create' && !vehicle)) return;
    this.mode = mode;
    this.target = vehicle;
    this.modalErrors = [];
    this.form.reset({ make: '', model: '', licensePlate: '', fuelTypeId: this.fuelTypes[0]?.id ?? 0,
      vin: '', year: null, initialKm: 0, currentKm: 0 });
    if (vehicle) this.form.patchValue({ ...vehicle, vin: vehicle.vin ?? '' });
    this.dialog.nativeElement.showModal();
  }

  close() { if (!this.saving) this.dialog.nativeElement.close(); }
  cancel(event: Event) { event.preventDefault(); this.close(); }

  save() {
    if (this.saving) return;
    this.modalErrors = [];
    if (this.form.invalid || !this.fuelTypes.length) { this.form.markAllAsTouched(); return; }
    const value = this.form.getRawValue();
    const request: VehicleRequest = { ...value, make: value.make.trim(), model: value.model.trim(),
      licensePlate: value.licensePlate.trim().toUpperCase(), vin: value.vin ? value.vin.toUpperCase() : null };
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

  signOut() { this.auth.logout(); void this.router.navigateByUrl('/login'); }

}
