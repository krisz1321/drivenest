import { Component, DestroyRef, ElementRef, EventEmitter, Input, Output, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { Vehicle } from '../services/vehicle.service';
import { Reminder, ReminderRequest, ReminderService } from '../services/reminder.service';
import { DistanceUnit, distanceLabel, fromDistance, maxOdometer, toDistance } from '../shared/units';

// Egész szám (üres mező is jó)
const integer = (control: AbstractControl) =>
  control.value === null || Number.isInteger(control.value) ? null : { integer: true };

// Dátum vagy km közül legalább az egyik kell (ugyanaz, mint a backend szabálya)
const dueRequired = (group: AbstractControl) =>
  group.get('dueDate')?.value || group.get('dueOdometer')?.value !== null ? null : { due: true };

// Az emlékeztető felugró ablaka (új / szerkesztés / törlés), a listát a szülő frissíti.
@Component({
  selector: 'app-reminder-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './reminder-dialog.component.html',
  styleUrl: './reminder-dialog.component.scss'
})
export class ReminderDialogComponent {
  private readonly api = inject(ReminderService);
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) vehicles: Vehicle[] = [];
  @Input() distanceUnit: DistanceUnit = 'km';

  @Output() saved = new EventEmitter<{ entry: Reminder; edited: boolean }>();
  @Output() deleted = new EventEmitter<number>();

  @ViewChild('reminderDialog') dialog!: ElementRef<HTMLDialogElement>;
  mode: 'create' | 'edit' | 'delete' = 'create';
  target: Reminder | null = null;
  saving = false;
  errors: string[] = [];

  // Gyakori teendők a cím mezőhöz (csak javaslat, bármi beírható)
  readonly suggestions = ['Olajcsere', 'Műszaki vizsga', 'Gumicsere', 'Biztosítás évforduló', 'Vezérlés csere', 'Fékfolyadék csere'];

  // A km mezők a választott mértékegységben vannak (km vagy mi), mentéskor km-re váltjuk.
  readonly form = inject(FormBuilder).nonNullable.group({
    vehicleId: [0, [Validators.required, Validators.min(1)]],
    title: ['', [Validators.required, Validators.maxLength(150), Validators.pattern(/\S/)]],
    dueDate: [''],
    dueOdometer: [null as number | null, [Validators.min(0), integer]],
    intervalMonths: [null as number | null, [Validators.min(1), Validators.max(120), integer]],
    intervalDistance: [null as number | null, [Validators.min(1), integer]]
  }, { validators: dueRequired });

  get unit() {
    return distanceLabel(this.distanceUnit);
  }

  get maxDistance() {
    return maxOdometer(this.distanceUnit);
  }

  invalid(field: keyof typeof this.form.controls) {
    const control = this.form.controls[field];
    return control.touched && control.invalid;
  }

  // A "dátum vagy km" hiba csak akkor látszik, ha már hozzányúlt valamelyikhez (vagy mentett).
  get dueMissing() {
    const { dueDate, dueOdometer } = this.form.controls;
    return this.form.hasError('due') && (dueDate.touched || dueOdometer.touched);
  }

  get title() {
    if (this.mode === 'edit') return 'Emlékeztető szerkesztése';
    if (this.mode === 'delete') return 'Emlékeztető törlése';
    return 'Új emlékeztető';
  }

  openCreate(vehicleId: number) {
    if (!this.vehicles.some(v => v.id === vehicleId) || this.saving) return;

    this.mode = 'create';
    this.target = null;
    this.errors = [];
    this.form.controls.vehicleId.enable();
    this.form.reset({
      vehicleId,
      title: '',
      dueDate: '',
      dueOdometer: null,
      intervalMonths: null,
      intervalDistance: null
    });
    this.dialog.nativeElement.showModal();
  }

  openEdit(entry: Reminder) {
    if (this.saving) return;

    this.mode = 'edit';
    this.target = entry;
    this.errors = [];
    // Szerkesztésnél a jármű nem változtatható.
    this.form.controls.vehicleId.disable();
    this.form.reset({
      vehicleId: entry.vehicleId,
      title: entry.title,
      dueDate: entry.dueDate ?? '',
      dueOdometer: entry.dueOdometerKm === null ? null : toDistance(entry.dueOdometerKm, this.distanceUnit),
      intervalMonths: entry.intervalMonths,
      intervalDistance: entry.intervalKm === null ? null : toDistance(entry.intervalKm, this.distanceUnit)
    });
    this.dialog.nativeElement.showModal();
  }

  openDelete(entry: Reminder) {
    if (this.saving) return;

    this.mode = 'delete';
    this.target = entry;
    this.errors = [];
    this.dialog.nativeElement.showModal();
  }

  close() {
    if (!this.saving) this.dialog.nativeElement.close();
  }

  cancel(event: Event) {
    event.preventDefault();
    this.close();
  }

  save() {
    if (this.saving) return;
    this.errors = [];
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const body: ReminderRequest = {
      title: value.title.trim(),
      dueDate: value.dueDate || null,
      dueOdometerKm: value.dueOdometer === null ? null : fromDistance(value.dueOdometer, this.distanceUnit),
      intervalMonths: value.intervalMonths,
      intervalKm: value.intervalDistance === null ? null : fromDistance(value.intervalDistance, this.distanceUnit)
    };

    // Szerkesztésnél PUT, egyébként POST
    const target = this.mode === 'edit' ? this.target : null;
    const edited = target !== null;
    const request = target
      ? this.api.update(target.vehicleId, target.id, body)
      : this.api.create(value.vehicleId, body);

    this.saving = true;
    request.pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.saving = false)
    ).subscribe({
      next: entry => {
        this.saved.emit({ entry, edited });
        this.dialog.nativeElement.close();
      },
      error: (error: HttpErrorResponse) => this.showError(error)
    });
  }

  remove() {
    if (this.saving || !this.target) return;
    const id = this.target.id;

    this.saving = true;
    this.errors = [];
    this.api.delete(this.target.vehicleId, id).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.saving = false)
    ).subscribe({
      next: () => {
        this.deleted.emit(id);
        this.dialog.nativeElement.close();
      },
      error: (error: HttpErrorResponse) => this.showError(error)
    });
  }

  private showError(error: HttpErrorResponse) {
    // 400-nál a backend mezőnkénti hibákat küld, ezeket kiírjuk.
    const details = error.error?.errors;
    const messages = details && typeof details === 'object'
      ? Object.values(details).flat().filter((value): value is string => typeof value === 'string')
      : [];

    if (messages.length) {
      this.errors = messages;
    } else if (error.status === 404) {
      this.errors = ['A jármű vagy az emlékeztető már nem érhető el. Zárd be az ablakot, és frissítsd az adatokat.'];
    } else if (error.status === 409) {
      this.errors = ['Az adatok időközben megváltoztak. Frissítsd őket, majd próbáld újra.'];
    } else {
      this.errors = ['A mentés nem sikerült. Ellenőrizd a kapcsolatot, majd próbáld újra.'];
    }
  }

  vehicleName(id: number) {
    const car = this.vehicles.find(v => v.id === id);
    return car ? `${car.make} ${car.model} · ${car.licensePlate}` : '—';
  }

  // A kiválasztott jármű jelenlegi óraállása, segítségnek a km mező alatt
  get currentDistance() {
    const car = this.vehicles.find(v => v.id === this.form.controls.vehicleId.value);
    return car ? toDistance(car.currentKm, this.distanceUnit).toLocaleString('hu-HU') : null;
  }
}
