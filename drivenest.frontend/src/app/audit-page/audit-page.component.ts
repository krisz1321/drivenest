import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, finalize, forkJoin, of } from 'rxjs';
import { AppShellComponent } from '../layout/app-shell.component';
import { AuditAction, AuditChange, AuditChangeField, AuditEntry, AuditEntryType, AuditService } from '../services/audit.service';
import { ProfileService } from '../services/profile.service';
import { Vehicle, VehicleService } from '../services/vehicle.service';
import { currencyLabel, distanceLabel, toDistance, toVolume, volumeLabel } from '../shared/units';

// A naplózott mezők neve a felületen, ugyanazokkal a szavakkal, mint az űrlapokon.
const FIELD_LABELS: Record<string, string> = {
  date: 'Dátum',
  time: 'Időpont',
  odometerKm: 'Kilométeróra',
  liters: 'Betöltött üzemanyag',
  amount: 'Összeg',
  isFullTank: 'Tele tank',
  provider: 'Szerviz / helyszín',
  location: 'Helyszín',
  description: 'Megjegyzés',
  category: 'Kategória',
  licensePlate: 'Rendszám',
  vin: 'Alvázszám',
  make: 'Márka',
  model: 'Modell',
  year: 'Évjárat',
  fuelType: 'Üzemanyagtípus',
  initialKm: 'Kezdő óraállás',
  currentKm: 'Aktuális óraállás'
};

const DISTANCE_FIELDS = ['odometerKm', 'initialKm', 'currentKm'];

@Component({
  selector: 'app-audit-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AppShellComponent],
  templateUrl: './audit-page.component.html',
  styleUrl: './audit-page.component.scss'
})
export class AuditPageComponent implements OnInit {
  private readonly api = inject(AuditService);
  private readonly vehicleApi = inject(VehicleService);
  private readonly profile = inject(ProfileService);
  private readonly destroyRef = inject(DestroyRef);

  private request?: Subscription;

  readonly types: { value: AuditEntryType; label: string }[] = [
    { value: 'vehicle', label: 'Jármű' },
    { value: 'refueling', label: 'Tankolás' },
    { value: 'service', label: 'Szerviz' },
    { value: 'expense', label: 'Kiadás' }
  ];

  readonly actions: { value: AuditAction; label: string; badge: string }[] = [
    { value: 'added', label: 'Hozzáadva', badge: 'badge-success' },
    { value: 'updated', label: 'Módosítva', badge: 'badge-warning' },
    { value: 'deleted', label: 'Törölve', badge: 'badge-danger' }
  ];

  tab: 'changes' | 'entries' = 'changes';

  vehicles: Vehicle[] = [];
  entries: AuditEntry[] = [];
  changes: AuditChange[] = [];

  loading = false;
  loadError = '';

  // Szűrők: alapból minden látszik (0 = összes jármű)
  vehicleFilter = 0;
  selectedTypes = this.types.map(t => t.value);
  selectedActions = this.actions.map(a => a.value);

  ngOnInit() {
    this.load();
  }

  // Mindkét fül adatát betöltjük, így fülváltáskor nem kell újra kérni.
  load() {
    // Gyors szűrőváltásnál a korábbi kérés válasza már nem kell.
    this.request?.unsubscribe();
    this.loadError = '';

    // Üres szűrőre a szerver mindent visszaadna, ezért ilyenkor nincs kérés.
    if (!this.selectedTypes.length) {
      this.entries = [];
      this.changes = [];
      return;
    }

    this.loading = true;
    this.request = forkJoin({
      vehicles: this.vehicleApi.list(),
      entries: this.api.list(this.vehicleFilter, this.selectedTypes),
      changes: this.selectedActions.length
        ? this.api.changes(this.vehicleFilter, this.selectedTypes, this.selectedActions)
        : of([] as AuditChange[]),
      profile: this.profile.load()
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading = false)
    ).subscribe({
      next: result => {
        this.vehicles = result.vehicles;
        this.entries = result.entries;
        this.changes = result.changes;
      },
      error: () => this.loadError = 'A változásnaplót nem sikerült betölteni. Próbáld újra.'
    });
  }

  toggleType(type: AuditEntryType) {
    this.selectedTypes = this.toggled(this.types.map(t => t.value), this.selectedTypes, type);
    this.load();
  }

  toggleAction(action: AuditAction) {
    this.selectedActions = this.toggled(this.actions.map(a => a.value), this.selectedActions, action);
    this.load();
  }

  // A sorrend mindig az eredeti marad.
  private toggled<T>(all: T[], selected: T[], value: T) {
    return selected.includes(value) ? selected.filter(v => v !== value) : all.filter(v => v === value || selected.includes(v));
  }

  selectVehicle(vehicleId: number) {
    this.vehicleFilter = vehicleId;
    this.load();
  }

  get hasFilter() {
    return this.vehicleFilter !== 0 || this.selectedTypes.length !== this.types.length
      || (this.tab === 'changes' && this.selectedActions.length !== this.actions.length);
  }

  clearFilters() {
    this.vehicleFilter = 0;
    this.selectedTypes = this.types.map(t => t.value);
    this.selectedActions = this.actions.map(a => a.value);
    this.load();
  }

  typeLabel(type: AuditEntryType) {
    return this.types.find(t => t.value === type)?.label ?? type;
  }

  actionInfo(action: AuditAction) {
    return this.actions.find(a => a.value === action)!;
  }

  // Tankolásnál a mennyiség, szerviznél a tételek, kiadásnál a kategória a bejegyzés neve.
  title(entry: Pick<AuditEntry, 'type' | 'summary' | 'liters'>) {
    if (entry.type === 'vehicle') return 'Járműadatok';
    if (entry.type === 'refueling') return this.volume(entry.liters ?? 0);
    return entry.summary ?? '—';
  }

  // A törölt jármű oldala már nem nyitható meg.
  hasVehicle(vehicleId: number) {
    return this.vehicles.some(v => v.id === vehicleId);
  }

  // Hány nappal a saját dátuma után rögzítette (a járműnek nincs dátuma).
  lateDays(entry: AuditEntry) {
    if (!entry.date) return 0;
    return Math.round((Date.parse(entry.createdAt.slice(0, 10)) - Date.parse(entry.date)) / 86400000);
  }

  fieldLabel(field: string) {
    return field.startsWith('item:') ? field.slice('item:'.length) : FIELD_LABELS[field] ?? field;
  }

  // Módosításnál a régi és az új érték, törlésnél a törölt érték.
  changeText(change: AuditChange, field: AuditChangeField) {
    const oldText = this.formatValue(field.field, field.oldValue);
    const newText = this.formatValue(field.field, field.newValue);
    if (change.action === 'deleted') return oldText;
    if (field.field.startsWith('item:')) {
      if (field.oldValue === null) return `új tétel, ${newText}`;
      if (field.newValue === null) return `kivett tétel, ${oldText}`;
    }
    return `${oldText} → ${newText}`;
  }

  private formatValue(field: string, value: string | null) {
    if (value === null) return '—';
    if (field === 'date') return `${value.replaceAll('-', '. ')}.`;
    if (field === 'isFullTank') return value === 'true' ? 'igen' : 'nem';
    if (field === 'liters') return this.volume(Number(value));
    if (DISTANCE_FIELDS.includes(field)) return this.distance(Number(value));
    if (field === 'amount' || field.startsWith('item:')) return `${this.number(Number(value))} ${this.unit}`;
    return value;
  }

  private volume(liters: number) {
    const unit = this.profile.preferences().volumeUnit;
    return `${this.number(toVolume(liters, unit))} ${volumeLabel(unit)}`;
  }

  private distance(km: number) {
    const unit = this.profile.preferences().distanceUnit;
    return `${this.number(toDistance(km, unit))} ${distanceLabel(unit)}`;
  }

  get unit() {
    return currencyLabel(this.profile.preferences().currency);
  }

  number(value: number) {
    return value.toLocaleString('hu-HU', { maximumFractionDigits: 2 });
  }
}
