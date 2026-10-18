import { Component, DestroyRef, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, forkJoin, map, of, switchMap } from 'rxjs';
import { AppShellComponent } from '../layout/app-shell.component';
import { ProfileService } from '../services/profile.service';
import { Vehicle, VehicleService } from '../services/vehicle.service';
import { Expense, ExpenseCategory, ExpenseRequest, ExpenseService } from '../services/expense.service';
import { currencyLabel } from '../shared/units';

// Egész szám (a km-hez)
const integer = (control: AbstractControl) =>
  control.value === null || Number.isInteger(control.value) ? null : { integer: true };

// Legfeljebb 2 tizedesjegy (az összeghez)
const twoDecimals = (control: AbstractControl) =>
  control.value === null || Number(Number(control.value).toFixed(2)) === control.value ? null : { precision: true };

const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Budapest' });

@Component({
  selector: 'app-expenses-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, AppShellComponent],
  templateUrl: './expenses-page.component.html',
  styleUrl: './expenses-page.component.scss'
})
export class ExpensesPageComponent implements OnInit {
  private readonly vehicleApi = inject(VehicleService);
  private readonly api = inject(ExpenseService);
  private readonly profile = inject(ProfileService);
  private readonly destroyRef = inject(DestroyRef);

  vehicles: Vehicle[] = [];
  categories: ExpenseCategory[] = [];
  entries: Expense[] = [];

  loading = false;
  loadError = '';

  // Szűrők: 0 = mindegyik
  vehicleFilter = 0;
  categoryFilter = 0;

  // Felugró ablak: ugyanazt használjuk új kiadáshoz, szerkesztéshez és törléshez is.
  @ViewChild('expenseDialog') dialog!: ElementRef<HTMLDialogElement>;
  mode: 'create' | 'edit' | 'delete' = 'create';
  target: Expense | null = null; // szerkesztésnél / törlésnél a kiválasztott kiadás
  saving = false;
  errors: string[] = [];
  message = '';

  readonly form = inject(FormBuilder).nonNullable.group({
    vehicleId: [0, [Validators.required, Validators.min(1)]],
    date: ['', Validators.required],
    categoryId: [0, [Validators.required, Validators.min(1)]],
    odometerKm: [0, [Validators.required, Validators.min(0), Validators.max(2147483647), integer]],
    amount: [0, [Validators.required, Validators.min(0), Validators.max(9999999999.99), twoDecimals]],
    location: ['', Validators.maxLength(200)],
    description: ['', Validators.maxLength(500)]
  });

  ngOnInit() {
    this.load();
  }

  // A kategória legördülőben külön csoportban vannak a beépített és a saját kategóriák.
  get builtInCategories() {
    return this.categories.filter(c => !c.isCustom);
  }

  get customCategories() {
    return this.categories.filter(c => c.isCustom);
  }

  get selectedVehicle() {
    return this.vehicles.find(v => v.id === this.form.controls.vehicleId.value);
  }

  invalid(field: keyof typeof this.form.controls) {
    const control = this.form.controls[field];
    return control.touched && control.invalid;
  }

  get title() {
    if (this.mode === 'edit') return 'Kiadás szerkesztése';
    if (this.mode === 'delete') return 'Kiadás törlése';
    return 'Új kiadás';
  }

  openCreate() {
    if (!this.vehicles.length || this.loading || this.saving) return;

    this.mode = 'create';
    this.target = null;
    this.errors = [];
    this.form.controls.vehicleId.enable();

    // Ha a listában ki van szűrve egy jármű, azzal nyitjuk meg az űrlapot.
    const car = this.vehicles.find(v => v.id === this.vehicleFilter) ?? this.vehicles[0];
    this.form.reset({
      vehicleId: car.id,
      date: today(),
      categoryId: this.categoryFilter,
      odometerKm: car.currentKm,
      amount: 0,
      location: '',
      description: ''
    });
    this.dialog.nativeElement.showModal();
  }

  openEdit(entry: Expense) {
    if (this.saving) return;

    this.mode = 'edit';
    this.target = entry;
    this.errors = [];
    // Szerkesztésnél a jármű nem változtatható (a backend sem engedi átrakni).
    this.form.controls.vehicleId.disable();

    this.form.reset({
      vehicleId: entry.vehicleId,
      date: entry.date,
      categoryId: entry.categoryId,
      odometerKm: entry.odometerKm,
      amount: entry.amount,
      location: entry.location ?? '',
      description: entry.description ?? ''
    });
    this.dialog.nativeElement.showModal();
  }

  openDelete(entry: Expense) {
    if (this.saving) return;

    this.mode = 'delete';
    this.target = entry;
    this.errors = [];
    this.dialog.nativeElement.showModal();
  }

  // Járműváltáskor a km-et a kiválasztott autó aktuális km-ére állítjuk.
  onVehicleChange() {
    this.form.controls.odometerKm.setValue(this.selectedVehicle?.currentKm ?? 0);
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
    const body: ExpenseRequest = {
      date: value.date,
      categoryId: value.categoryId,
      odometerKm: value.odometerKm,
      amount: value.amount,
      location: value.location.trim() || null,
      description: value.description.trim() || null
    };

    // Szerkesztésnél PUT, egyébként POST
    const request = this.mode === 'edit' && this.target
      ? this.api.update(this.target.vehicleId, this.target.id, body)
      : this.api.create(value.vehicleId, body);

    this.saving = true;
    request.pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.saving = false)
    ).subscribe({
      next: entry => {
        // A régi változatot (ha volt) kicseréljük az újra.
        this.entries = this.sorted([...this.entries.filter(e => e.id !== entry.id), entry]);
        this.message = this.mode === 'edit' ? 'A kiadást módosítottuk.' : 'A kiadást elmentettük.';
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
        this.entries = this.entries.filter(e => e.id !== id);
        this.message = 'A kiadást töröltük.';
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
      this.errors = ['A jármű vagy a kiadás már nem érhető el. Zárd be az ablakot, és frissítsd az adatokat.'];
    } else if (error.status === 409) {
      this.errors = ['Az adatok időközben megváltoztak. Frissítsd őket, majd próbáld újra.'];
    } else {
      this.errors = ['A mentés nem sikerült. Ellenőrizd a kapcsolatot, majd próbáld újra.'];
    }
  }

  load() {
    if (this.loading) return;
    this.loading = true;
    this.loadError = '';

    // Először a járművek, kategóriák és a profil (pénznem), utána járművenként a kiadások.
    forkJoin({
      vehicles: this.vehicleApi.list(),
      categories: this.api.categories(),
      profile: this.profile.load()
    }).pipe(
      switchMap(result => {
        this.vehicles = result.vehicles;
        this.categories = result.categories;
        if (!this.vehicles.length) return of([] as Expense[]);
        return forkJoin(this.vehicles.map(car => this.api.list(car.id))).pipe(map(groups => groups.flat()));
      }),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading = false)
    ).subscribe({
      next: entries => this.entries = this.sorted(entries),
      error: () => this.loadError = 'A kiadásokat nem sikerült betölteni. Próbáld újra.'
    });
  }

  // A szűrők alapján látható kiadások
  get filtered() {
    return this.entries.filter(e =>
      (this.vehicleFilter === 0 || e.vehicleId === this.vehicleFilter) &&
      (this.categoryFilter === 0 || e.categoryId === this.categoryFilter));
  }

  get total() {
    return this.sum(this.filtered);
  }

  get monthlyTotal() {
    const month = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Budapest' }).slice(0, 7);
    return this.sum(this.filtered.filter(e => e.date.startsWith(month)));
  }

  // Melyik kategóriára ment el a legtöbb pénz (a szűrt listából)
  get topCategory() {
    const totals = new Map<string, number>();
    for (const e of this.filtered) {
      totals.set(e.categoryName, (totals.get(e.categoryName) ?? 0) + e.amount);
    }

    let best: { name: string, amount: number } | null = null;
    for (const [name, amount] of totals) {
      if (!best || amount > best.amount) best = { name, amount };
    }
    return best;
  }

  get hasFilter() {
    return this.vehicleFilter !== 0 || this.categoryFilter !== 0;
  }

  clearFilters() {
    this.vehicleFilter = 0;
    this.categoryFilter = 0;
  }

  get unit() {
    return currencyLabel(this.profile.preferences().currency);
  }

  vehicleName(id: number) {
    const car = this.vehicles.find(v => v.id === id);
    return car ? `${car.make} ${car.model} · ${car.licensePlate}` : '—';
  }

  number(value: number, digits = 2) {
    return value.toLocaleString('hu-HU', { maximumFractionDigits: digits });
  }

  private sum(list: Expense[]) {
    return list.reduce((total, e) => total + e.amount, 0);
  }

  private sorted(entries: Expense[]) {
    return [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.odometerKm - a.odometerKm || b.id - a.id);
  }
}
