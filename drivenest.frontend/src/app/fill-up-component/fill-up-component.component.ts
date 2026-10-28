import { Component, DestroyRef, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { AbstractControl, FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppShellComponent } from '../layout/app-shell.component';
import { ProfileService } from '../services/profile.service';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { finalize, forkJoin, of, switchMap, map } from 'rxjs';
import { Vehicle, VehicleService } from '../services/vehicle.service';
import { Refueling, RefuelingService } from '../services/refueling.service';
import { Consumption, StatsService } from '../services/stats.service';
import { consumptionLabel, toConsumption } from '../shared/units';

const integer = (control: AbstractControl) => control.value === null || Number.isInteger(control.value) ? null : { integer: true };
const precision = (digits: number) => (control: AbstractControl) => control.value === null
  || (Number.isFinite(control.value) && Number(control.value.toFixed(digits)) === control.value) ? null : { precision: true };
const validDate = (control: AbstractControl) => {
  const value: string = control.value;
  const date = new Date(`${value}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value > '0001-01-01' && Number.isFinite(date.getTime())
    && date.toISOString().slice(0, 10) === value ? null : { date: true };
};

@Component({
  selector: 'app-fill-up-component', standalone: true, imports: [ReactiveFormsModule, AppShellComponent, CommonModule, RouterLink],
  templateUrl: './fill-up-component.component.html', styleUrl: './fill-up-component.component.scss'
})
export class FillUpComponentComponent implements OnInit {
  private readonly vehicleApi = inject(VehicleService);
  readonly profile = inject(ProfileService);
  vehicles: Vehicle[] = [];
  get currency() { return this.profile.preferences().currency; }
  vehicleName(id: number) { const car = this.vehicles.find(v => v.id === id); return car ? `${car.make} ${car.model} · ${car.licensePlate}` : '—'; }
  get selectedVehicle() { return this.vehicles.find(v => v.id === this.form.controls.vehicleId.value); }
  createdAt(value: string) { return new Date(value).toLocaleString('hu-HU', { timeZone: 'Europe/Budapest' }); }
  readonly unitPriceControl = new FormControl<number | null>(0, [Validators.required, Validators.min(0),
    control => control.value === null || Number.isFinite(control.value) ? null : { finite: true }]);
  private priceSource: 'total' | 'unit' = 'total';
  get unitPrice() { return this.unitPriceControl.value ?? 0; }
  @ViewChild('refuelingDialog') dialog!: ElementRef<HTMLDialogElement>;
  private readonly api = inject(RefuelingService);
  private readonly statsApi = inject(StatsService);
  private readonly destroyRef = inject(DestroyRef);
  entries: Refueling[] = [];
  consumption: Record<number, Consumption> = {};
  loading = false;
  saving = false;
  loadError = '';
  errors: string[] = [];
  message = '';
  mode: 'create' | 'edit' | 'delete' = 'create';
  target: Refueling | null = null;
  readonly form = inject(FormBuilder).nonNullable.group({
    vehicleId: [0, [Validators.required, Validators.min(1)]],
    date: ['', [Validators.required, validDate]],
    odometerKm: [0, [Validators.required, Validators.min(0), Validators.max(2147483647), integer]],
    liters: [0, [Validators.required, Validators.min(0.001), Validators.max(999999.999), precision(3)]],
    totalAmount: [0, [Validators.required, Validators.min(0), Validators.max(9999999999.99), precision(2)]],
    isFullTank: [true]
  });
  constructor() {
    this.form.controls.totalAmount.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.priceSource = 'total';
      this.calculatePrice();
    });
    this.unitPriceControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.priceSource = 'unit';
      this.calculatePrice();
    });
    this.form.controls.liters.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.calculatePrice());
  }

  private calculatePrice() {
    const liters = this.form.controls.liters.value;
    if (this.priceSource === 'unit') {
      const price = this.unitPriceControl.value;
      if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) return;
      const total = typeof liters === 'number' && Number.isFinite(liters) && liters > 0
        ? Number((price * liters).toFixed(2)) : 0;
      this.form.controls.totalAmount.setValue(total, { emitEvent: false });
    } else {
      const total = this.form.controls.totalAmount.value;
      if (typeof total !== 'number' || !Number.isFinite(total) || total < 0) return;
      this.unitPriceControl.setValue(typeof liters === 'number' && Number.isFinite(liters) && liters > 0
        ? Number((total / liters).toFixed(6)) : 0, { emitEvent: false });
    }
  }
  get title() { return this.mode === 'create' ? 'Tankolás rögzítése' : this.mode === 'edit' ? 'Tankolás szerkesztése' : 'Tankolás törlése'; }
  get unit() { return this.currency === 'HUF' ? 'Ft' : this.currency; }
  get monthlyTotal() {
    const month = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Budapest' }).slice(0, 7);
    return this.entries.filter(e => e.date.startsWith(month)).reduce((total, e) => total + e.totalAmount, 0);
  }
  get consumptionUnit() { return consumptionLabel(this.profile.preferences().consumptionUnit); }
  consumptionValue(litersPer100Km: number | null) {
    return litersPer100Km === null ? '—' : this.number(toConsumption(litersPer100Km, this.profile.preferences().consumptionUnit));
  }
  number(value: number, digits = 2) { return value.toLocaleString('hu-HU', { maximumFractionDigits: digits }); }
  invalid(field: keyof typeof this.form.controls) { const control = this.form.controls[field]; return control.touched && control.invalid; }
  ngOnInit() { this.load(); }
  load() {
    if (this.loading || this.saving) return;
    this.loading = true;
    this.loadError = '';
    forkJoin({ vehicles: this.vehicleApi.list(), profile: this.profile.load() }).pipe(
      switchMap(result => {
        this.vehicles = result.vehicles;
        return this.vehicles.length ? forkJoin(this.vehicles.map(car => this.api.list(car.id))).pipe(map(groups => groups.flat())) : of([] as Refueling[]);
      }), takeUntilDestroyed(this.destroyRef), finalize(() => this.loading = false)
    ).subscribe({ next: entries => { this.entries = this.sorted(entries); this.loadConsumption(); },
      error: () => this.loadError = 'A tankolásokat nem sikerült betölteni. Próbáld újra.' });
  }
  // A fogyasztás hibája nem állítja meg az oldalt, csak az adott jármű kártyája marad üres.
  private loadConsumption(vehicleIds = this.vehicles.map(v => v.id)) {
    for (const id of vehicleIds) {
      this.statsApi.consumption(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: result => this.consumption = { ...this.consumption, [id]: result }, error: () => {}
      });
    }
  }

  open(mode: 'create' | 'edit' | 'delete', entry: Refueling | null = null) {
    if (!this.vehicles.length || this.saving || this.loading || (mode !== 'create' && (!entry || !this.vehicles.some(v => v.id === entry.vehicleId)))) return;
    this.mode = mode;
    this.target = entry;
    this.errors = [];
    this.priceSource = 'total';
    this.unitPriceControl.reset(0, { emitEvent: false });
    this.form.reset({ vehicleId: this.vehicles[0]?.id ?? 0, date: new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Budapest' }),
      odometerKm: this.vehicles[0]?.currentKm ?? 0, liters: 0, totalAmount: 0, isFullTank: true }, { emitEvent: false });
    if (entry) this.form.patchValue(entry, { emitEvent: false });
    this.calculatePrice();
    this.dialog.nativeElement.showModal();
  }
  close() { if (!this.saving) this.dialog.nativeElement.close(); }
  cancel(event: Event) { event.preventDefault(); this.close(); }
  save() {
    if (this.saving) return;
    this.errors = [];
    if (this.form.invalid || this.unitPriceControl.invalid) { this.form.markAllAsTouched(); this.unitPriceControl.markAsTouched(); return; }
    if (!this.selectedVehicle) return;
    const { vehicleId, ...body } = this.form.getRawValue();
    this.saving = true;
    const request = this.mode === 'edit' && this.target
      ? this.api.update(this.target.vehicleId, this.target.id, body) : this.api.create(vehicleId, body);
    request.pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.saving = false)).subscribe({
      next: entry => {
        this.entries = this.sorted([...this.entries.filter(e => e.id !== entry.id), entry]);
        this.message = 'A tankolást mentettük.';
        this.dialog.nativeElement.close();
        this.refreshVehicles();
        this.loadConsumption([entry.vehicleId]);
      }, error: (error: HttpErrorResponse) => this.showError(error)
    });
  }
  remove() {
    if (this.saving || !this.target) return;
    const id = this.target.id;
    const vehicleId = this.target.vehicleId;
    this.saving = true;
    this.errors = [];
    this.api.delete(this.target.vehicleId, id).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.saving = false)).subscribe({
      next: () => {
        this.entries = this.entries.filter(e => e.id !== id);
        this.message = 'A tankolást töröltük.';
        this.dialog.nativeElement.close();
        this.refreshVehicles();
        this.loadConsumption([vehicleId]);
      }, error: (error: HttpErrorResponse) => this.showError(error)
    });
  }
  // Mentés/törlés után a szerver frissíti a jármű óraállását, ezért újratöltjük a járműveket.
  private refreshVehicles() {
    this.vehicleApi.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: vehicles => this.vehicles = vehicles, error: () => {} // ha nem sikerül, marad a régi lista
    });
  }
  private sorted(entries: Refueling[]) {
    return [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.odometerKm - a.odometerKm || b.id - a.id);
  }
  private showError(error: HttpErrorResponse) {
    const details = error.error?.errors;
    const messages = details && typeof details === 'object'
      ? Object.values(details).flat().filter((value): value is string => typeof value === 'string') : [];
    this.errors = messages.length ? messages : [error.status === 404
      ? 'A jármű vagy tankolás már nem érhető el. Zárd be az ablakot, és frissítsd az adatokat.'
      : error.status === 409 ? 'Az adatok időközben megváltoztak. Frissítsd őket, majd próbáld újra.'
      : 'A művelet nem sikerült. Ellenőrizd a kapcsolatot, majd próbáld újra.'];
  }
}
