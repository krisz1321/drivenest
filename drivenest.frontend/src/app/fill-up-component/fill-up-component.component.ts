import { Component, DestroyRef, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppShellComponent } from '../layout/app-shell.component';
import { ProfileService } from '../services/profile.service';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { finalize, forkJoin, of, switchMap, map } from 'rxjs';
import { Vehicle, VehicleService } from '../services/vehicle.service';
import { Refueling, RefuelingService } from '../services/refueling.service';

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
  get unitPrice() { const { liters, totalAmount } = this.form.getRawValue(); return liters > 0 ? totalAmount / liters : 0; }
  @ViewChild('refuelingDialog') dialog!: ElementRef<HTMLDialogElement>;
  private readonly api = inject(RefuelingService);
  private readonly destroyRef = inject(DestroyRef);
  entries: Refueling[] = [];
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
  get title() { return this.mode === 'create' ? 'Tankolás rögzítése' : this.mode === 'edit' ? 'Tankolás szerkesztése' : 'Tankolás törlése'; }
  get unit() { return this.currency === 'HUF' ? 'Ft' : this.currency; }
  get monthlyTotal() {
    const month = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Budapest' }).slice(0, 7);
    return this.entries.filter(e => e.date.startsWith(month)).reduce((total, e) => total + e.totalAmount, 0);
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
    ).subscribe({ next: entries => this.entries = this.sorted(entries),
      error: () => this.loadError = 'A tankolásokat nem sikerült betölteni. Próbáld újra.' });
  }

  open(mode: 'create' | 'edit' | 'delete', entry: Refueling | null = null) {
    if (!this.vehicles.length || this.saving || this.loading || (mode !== 'create' && (!entry || !this.vehicles.some(v => v.id === entry.vehicleId)))) return;
    this.mode = mode;
    this.target = entry;
    this.errors = [];
    this.form.reset({ vehicleId: this.vehicles[0]?.id ?? 0, date: new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Budapest' }),
      odometerKm: this.vehicles[0]?.currentKm ?? 0, liters: 0, totalAmount: 0, isFullTank: true });
    if (entry) this.form.patchValue(entry);
    this.dialog.nativeElement.showModal();
  }
  close() { if (!this.saving) this.dialog.nativeElement.close(); }
  cancel(event: Event) { event.preventDefault(); this.close(); }
  save() {
    if (this.saving) return;
    this.errors = [];
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
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
      }, error: (error: HttpErrorResponse) => this.showError(error)
    });
  }
  remove() {
    if (this.saving || !this.target) return;
    const id = this.target.id;
    this.saving = true;
    this.errors = [];
    this.api.delete(this.target.vehicleId, id).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.saving = false)).subscribe({
      next: () => {
        this.entries = this.entries.filter(e => e.id !== id);
        this.message = 'A tankolást töröltük.';
        this.dialog.nativeElement.close();
      }, error: (error: HttpErrorResponse) => this.showError(error)
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
