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
import { ServiceCategory, ServiceRecord, ServiceRecordRequest, ServiceRecordService } from '../services/service-record.service';
import { currencyLabel } from '../shared/units';

// Egész szám (a km-hez)
const integer = (control: AbstractControl) =>
  control.value === null || Number.isInteger(control.value) ? null : { integer: true };

// Legfeljebb 2 tizedesjegy (az összeghez)
const twoDecimals = (control: AbstractControl) =>
  control.value === null || Number(Number(control.value).toFixed(2)) === control.value ? null : { precision: true };

const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Budapest' });

// Kereséshez: kisbetűs, ékezet nélküli szöveg, így a "fek" is megtalálja a "Fékbetét"-et.
const simplify = (text: string) =>
  text.toLocaleLowerCase('hu').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

@Component({
  selector: 'app-service-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, AppShellComponent],
  templateUrl: './service-page.component.html',
  styleUrl: './service-page.component.scss'
})
export class ServicePageComponent implements OnInit {
  private readonly vehicleApi = inject(VehicleService);
  private readonly api = inject(ServiceRecordService);
  private readonly profile = inject(ProfileService);
  private readonly destroyRef = inject(DestroyRef);

  vehicles: Vehicle[] = [];
  categories: ServiceCategory[] = [];
  entries: ServiceRecord[] = [];

  loading = false;
  loadError = '';

  // Szűrők: 0 = mindegyik
  vehicleFilter = 0;
  categoryFilter = 0;

  // Felugró ablak: ugyanazt használjuk új szervizhez, szerkesztéshez és törléshez is.
  @ViewChild('serviceDialog') dialog!: ElementRef<HTMLDialogElement>;
  mode: 'create' | 'edit' | 'delete' = 'create';
  target: ServiceRecord | null = null; // szerkesztésnél / törlésnél a kiválasztott szerviz
  saving = false;
  errors: string[] = [];
  message = '';

  // A típuslista keresőmezője (nem része a formnak, csak szűri a listát)
  categorySearch = '';

  readonly form = inject(FormBuilder).nonNullable.group({
    vehicleId: [0, [Validators.required, Validators.min(1)]],
    date: ['', Validators.required],
    categoryId: [0, [Validators.required, Validators.min(1)]],
    odometerKm: [0, [Validators.required, Validators.min(0), Validators.max(2147483647), integer]],
    amount: [0, [Validators.required, Validators.min(0), Validators.max(9999999999.99), twoDecimals]],
    provider: ['', Validators.maxLength(150)],
    description: ['', Validators.maxLength(2000)]
  });

  ngOnInit() {
    this.load();
  }

  // A keresőmező alapján látható típusok
  get visibleCategories() {
    const search = simplify(this.categorySearch.trim());
    return this.categories.filter(c => simplify(c.name).includes(search));
  }

  // A listában külön csoportban vannak a beépített és a saját típusok.
  get builtInCategories() {
    return this.visibleCategories.filter(c => !c.isCustom);
  }

  get customCategories() {
    return this.visibleCategories.filter(c => c.isCustom);
  }

  // Keresés közben is látszódjon, mi van kiválasztva.
  get selectedCategoryName() {
    return this.categories.find(c => c.id === this.form.controls.categoryId.value)?.name ?? '';
  }

  get selectedVehicle() {
    return this.vehicles.find(v => v.id === this.form.controls.vehicleId.value);
  }

  invalid(field: keyof typeof this.form.controls) {
    const control = this.form.controls[field];
    return control.touched && control.invalid;
  }

  get title() {
    if (this.mode === 'edit') return 'Szerviz szerkesztése';
    if (this.mode === 'delete') return 'Szerviz törlése';
    return 'Új szerviz';
  }

  openCreate() {
    if (!this.vehicles.length || this.loading || this.saving) return;

    this.mode = 'create';
    this.target = null;
    this.errors = [];
    this.categorySearch = '';
    this.form.controls.vehicleId.enable();
    // Ha a listában ki van szűrve egy jármű vagy típus, azzal nyitjuk meg az űrlapot.
    const car = this.vehicles.find(v => v.id === this.vehicleFilter) ?? this.vehicles[0];
    this.form.reset({
      vehicleId: car.id,
      date: today(),
      categoryId: this.categoryFilter,
      odometerKm: car.currentKm,
      amount: 0,
      provider: '',
      description: ''
    });
    this.dialog.nativeElement.showModal();
  }

  openEdit(entry: ServiceRecord) {
    if (this.saving) return;

    this.mode = 'edit';
    this.target = entry;
    this.errors = [];
    this.categorySearch = '';
    // Szerkesztésnél a jármű nem változtatható (a backend sem engedi átrakni).
    this.form.controls.vehicleId.disable();

    this.form.reset({
      vehicleId: entry.vehicleId,
      date: entry.date,
      categoryId: entry.categoryId,
      odometerKm: entry.odometerKm,
      amount: entry.amount,
      provider: entry.provider ?? '',
      description: entry.description ?? ''
    });
    this.dialog.nativeElement.showModal();
  }

  openDelete(entry: ServiceRecord) {
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
    const body: ServiceRecordRequest = {
      date: value.date,
      categoryId: value.categoryId,
      odometerKm: value.odometerKm,
      amount: value.amount,
      provider: value.provider.trim() || null,
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
        this.message = this.mode === 'edit' ? 'A szervizt módosítottuk.' : 'A szervizt elmentettük.';
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
        this.message = 'A szervizt töröltük.';
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
      this.errors = ['A jármű vagy a szerviz már nem érhető el. Zárd be az ablakot, és frissítsd az adatokat.'];
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

    // Először a járművek, a szerviztípusok és a profil (pénznem), utána járművenként a szervizek.
    forkJoin({
      vehicles: this.vehicleApi.list(),
      categories: this.api.categories(),
      profile: this.profile.load()
    }).pipe(
      switchMap(result => {
        this.vehicles = result.vehicles;
        this.categories = result.categories;
        if (!this.vehicles.length) return of([] as ServiceRecord[]);
        return forkJoin(this.vehicles.map(car => this.api.list(car.id))).pipe(map(groups => groups.flat()));
      }),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading = false)
    ).subscribe({
      next: entries => this.entries = this.sorted(entries),
      error: () => this.loadError = 'A szervizeket nem sikerült betölteni. Próbáld újra.'
    });
  }

  // A szűrőben csak azok a típusok jelennek meg, amikhez már van bejegyzés (különben 119 elem lenne benne).
  get usedCategories() {
    return this.categories.filter(c => this.entries.some(e => e.categoryId === c.id));
  }

  // A szűrők alapján látható szervizek
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

  // A lista dátum szerint csökkenő, így az első elem a legutóbbi szerviz.
  get lastService() {
    return this.filtered[0] ?? null;
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

  private sum(list: ServiceRecord[]) {
    return list.reduce((total, e) => total + e.amount, 0);
  }

  private sorted(entries: ServiceRecord[]) {
    return [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.odometerKm - a.odometerKm || b.id - a.id);
  }
}
