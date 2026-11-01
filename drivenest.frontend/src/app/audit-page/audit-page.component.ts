import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, finalize, forkJoin } from 'rxjs';
import { AppShellComponent } from '../layout/app-shell.component';
import { AuditEntry, AuditEntryType, AuditService } from '../services/audit.service';
import { ProfileService } from '../services/profile.service';
import { Vehicle, VehicleService } from '../services/vehicle.service';
import { currencyLabel, toVolume, volumeLabel } from '../shared/units';

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

  vehicles: Vehicle[] = [];
  entries: AuditEntry[] = [];

  loading = false;
  loadError = '';

  // Szűrők: alapból minden látszik (0 = összes jármű)
  vehicleFilter = 0;
  selectedTypes = this.types.map(t => t.value);

  ngOnInit() {
    this.load();
  }

  load() {
    // Gyors szűrőváltásnál a korábbi kérés válasza már nem kell.
    this.request?.unsubscribe();
    this.loadError = '';

    // Üres típuslistára a szerver mindent visszaadna, ezért ilyenkor nincs kérés.
    if (!this.selectedTypes.length) {
      this.entries = [];
      return;
    }

    this.loading = true;
    this.request = forkJoin({
      vehicles: this.vehicleApi.list(),
      entries: this.api.list(this.vehicleFilter, this.selectedTypes),
      profile: this.profile.load()
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading = false)
    ).subscribe({
      next: result => {
        this.vehicles = result.vehicles;
        this.entries = result.entries;
      },
      error: () => this.loadError = 'A változásnaplót nem sikerült betölteni. Próbáld újra.'
    });
  }

  isSelected(type: AuditEntryType) {
    return this.selectedTypes.includes(type);
  }

  toggleType(type: AuditEntryType) {
    this.selectedTypes = this.isSelected(type)
      ? this.selectedTypes.filter(t => t !== type)
      : this.types.map(t => t.value).filter(t => t === type || this.isSelected(t));
    this.load();
  }

  selectVehicle(vehicleId: number) {
    this.vehicleFilter = vehicleId;
    this.load();
  }

  get hasFilter() {
    return this.vehicleFilter !== 0 || this.selectedTypes.length !== this.types.length;
  }

  clearFilters() {
    this.vehicleFilter = 0;
    this.selectedTypes = this.types.map(t => t.value);
    this.load();
  }

  typeLabel(type: AuditEntryType) {
    return this.types.find(t => t.value === type)?.label ?? type;
  }

  // Tankolásnál a mennyiség, szerviznél a tételek, kiadásnál a kategória a bejegyzés neve.
  title(entry: AuditEntry) {
    if (entry.type === 'vehicle') return 'Járműadatok';
    if (entry.type === 'refueling') {
      const unit = this.profile.preferences().volumeUnit;
      return `${this.number(toVolume(entry.liters ?? 0, unit))} ${volumeLabel(unit)}`;
    }
    return entry.summary ?? '—';
  }

  get unit() {
    return currencyLabel(this.profile.preferences().currency);
  }

  number(value: number) {
    return value.toLocaleString('hu-HU', { maximumFractionDigits: 2 });
  }
}
