import { Component, DestroyRef, ElementRef, EventEmitter, Input, Output, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormArray, FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { Vehicle } from '../services/vehicle.service';
import { ServiceCategory, ServiceRecord, ServiceRecordItemRequest, ServiceRecordRequest, ServiceRecordService } from '../services/service-record.service';

// Egész szám (a km-hez)
const integer = (control: AbstractControl) =>
  control.value === null || Number.isInteger(control.value) ? null : { integer: true };

// Legfeljebb 2 tizedesjegy (az összeghez)
const twoDecimals = (control: AbstractControl) =>
  control.value === null || Number(Number(control.value).toFixed(2)) === control.value ? null : { precision: true };

// Legalább egy tétel legyen kiválasztva
const atLeastOne = (control: AbstractControl) =>
  (control as FormArray).length ? null : { required: true };

const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Budapest' });

// Kereséshez: kisbetűs, ékezet nélküli szöveg, így a "fek" is megtalálja a "Fékbetét"-et.
const simplify = (text: string) =>
  text.toLocaleLowerCase('hu').normalize('NFD').replace(/[̀-ͯ]/g, '');

// Egy tétel a formban: típus + összeg
type ItemForm = FormGroup<{ categoryId: FormControl<number>; amount: FormControl<number> }>;

// A szerviz felugró ablaka (új / szerkesztés / törlés).
// A Szerviz oldal és a jármű oldala (Járműveim) is ezt használja, a listát a szülő frissíti.
@Component({
  selector: 'app-service-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './service-dialog.component.html',
  styleUrl: './service-dialog.component.scss'
})
export class ServiceDialogComponent {
  private readonly api = inject(ServiceRecordService);
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) vehicles: Vehicle[] = [];
  @Input({ required: true }) categories: ServiceCategory[] = [];
  @Input() unit = 'Ft';

  // Mentés / törlés után szólunk a szülőnek
  @Output() saved = new EventEmitter<{ entry: ServiceRecord; edited: boolean }>();
  @Output() deleted = new EventEmitter<number>();

  @ViewChild('serviceDialog') dialog!: ElementRef<HTMLDialogElement>;
  mode: 'create' | 'edit' | 'delete' = 'create';
  target: ServiceRecord | null = null; // szerkesztésnél / törlésnél a kiválasztott szerviz
  saving = false;
  errors: string[] = [];

  // A típuslista keresőmezője (nem része a formnak, csak szűri a listát)
  categorySearch = '';

  readonly form = inject(FormBuilder).nonNullable.group({
    vehicleId: [0, [Validators.required, Validators.min(1)]],
    date: ['', Validators.required],
    odometerKm: [0, [Validators.required, Validators.min(0), Validators.max(2147483647), integer]],
    provider: ['', Validators.maxLength(150)],
    description: ['', Validators.maxLength(2000)],
    // A kipipált típusok, mindegyikhez egy összeg
    items: new FormArray<ItemForm>([], atLeastOne)
  });

  get items() {
    return this.form.controls.items;
  }

  private newItem(categoryId: number, amount = 0): ItemForm {
    return new FormGroup({
      categoryId: new FormControl(categoryId, { nonNullable: true }),
      amount: new FormControl(amount, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(0), Validators.max(9999999999.99), twoDecimals]
      })
    });
  }

  // A form tételeinek lecserélése (megnyitáskor)
  private setItems(list: ServiceRecordItemRequest[]) {
    this.items.clear();
    for (const item of list) this.items.push(this.newItem(item.categoryId, item.amount));
  }

  isSelected(categoryId: number) {
    return this.items.controls.some(i => i.controls.categoryId.value === categoryId);
  }

  // Pipáláskor bekerül a tételek közé, pipa levételekor kikerül.
  toggleCategory(categoryId: number) {
    const index = this.items.controls.findIndex(i => i.controls.categoryId.value === categoryId);
    if (index >= 0) {
      this.items.removeAt(index);
    } else {
      this.items.push(this.newItem(categoryId));
    }
    this.items.markAsTouched();
  }

  removeItem(index: number) {
    this.items.removeAt(index);
    this.items.markAsTouched();
  }

  // Az ablak alján látható végösszeg
  get itemsTotal() {
    return this.items.controls.reduce((total, i) => total + (Number(i.controls.amount.value) || 0), 0);
  }

  categoryName(id: number) {
    return this.categories.find(c => c.id === id)?.name ?? '—';
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

  get selectedVehicle() {
    return this.vehicles.find(v => v.id === this.form.controls.vehicleId.value);
  }

  invalid(field: keyof typeof this.form.controls) {
    const control = this.form.controls[field];
    return control.touched && control.invalid;
  }

  itemInvalid(index: number) {
    const control = this.items.at(index).controls.amount;
    return control.touched && control.invalid;
  }

  get title() {
    if (this.mode === 'edit') return 'Szerviz szerkesztése';
    if (this.mode === 'delete') return 'Szerviz törlése';
    return 'Új szerviz';
  }

  // categoryId: ha meg van adva, ez a típus már ki lesz pipálva
  openCreate(vehicleId: number, categoryId = 0) {
    const car = this.vehicles.find(v => v.id === vehicleId);
    if (!car || this.saving) return;

    this.mode = 'create';
    this.target = null;
    this.errors = [];
    this.categorySearch = '';
    // Ha csak egy jármű közül lehet választani (pl. a jármű oldalán), nem kell választó.
    if (this.vehicles.length > 1) {
      this.form.controls.vehicleId.enable();
    } else {
      this.form.controls.vehicleId.disable();
    }

    this.form.reset({
      vehicleId: car.id,
      date: today(),
      odometerKm: car.currentKm,
      provider: '',
      description: ''
    });
    this.setItems(categoryId ? [{ categoryId, amount: 0 }] : []);
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
      odometerKm: entry.odometerKm,
      provider: entry.provider ?? '',
      description: entry.description ?? ''
    });
    this.setItems(entry.items);
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
      odometerKm: value.odometerKm,
      provider: value.provider.trim() || null,
      description: value.description.trim() || null,
      items: value.items
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
      this.errors = ['A jármű vagy a szerviz már nem érhető el. Zárd be az ablakot, és frissítsd az adatokat.'];
    } else if (error.status === 409) {
      this.errors = ['Az adatok időközben megváltoztak. Frissítsd őket, majd próbáld újra.'];
    } else {
      this.errors = ['A mentés nem sikerült. Ellenőrizd a kapcsolatot, majd próbáld újra.'];
    }
  }

  // Egy szerviz típusai vesszővel elválasztva (törlésnél)
  typeNames(entry: ServiceRecord) {
    return entry.items.map(i => i.categoryName).join(', ');
  }

  vehicleName(id: number) {
    const car = this.vehicles.find(v => v.id === id);
    return car ? `${car.make} ${car.model} · ${car.licensePlate}` : '—';
  }

  number(value: number, digits = 2) {
    return value.toLocaleString('hu-HU', { maximumFractionDigits: digits });
  }
}
