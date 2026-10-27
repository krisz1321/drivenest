import { Component, DestroyRef, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, forkJoin, map, of, switchMap } from 'rxjs';
import { AppShellComponent } from '../layout/app-shell.component';
import { ProfileService } from '../services/profile.service';
import { Vehicle, VehicleService } from '../services/vehicle.service';
import { Reminder, ReminderService, ReminderStatus, WARNING_DAYS, WARNING_KM, reminderStatus, remainingText } from '../services/reminder.service';
import { distanceLabel, toDistance } from '../shared/units';
import { ReminderDialogComponent } from './reminder-dialog.component';

// A sürgősebb állapot kerül előre a listában.
const STATUS_ORDER: Record<ReminderStatus, number> = { overdue: 0, soon: 1, ok: 2 };

@Component({
  selector: 'app-reminders-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AppShellComponent, ReminderDialogComponent],
  templateUrl: './reminders-page.component.html',
  styleUrl: './reminders-page.component.scss'
})
export class RemindersPageComponent implements OnInit {
  private readonly vehicleApi = inject(VehicleService);
  private readonly api = inject(ReminderService);
  private readonly profile = inject(ProfileService);
  private readonly destroyRef = inject(DestroyRef);

  readonly warningDays = WARNING_DAYS;

  vehicles: Vehicle[] = [];
  entries: Reminder[] = [];

  loading = false;
  loadError = '';
  message = '';
  error = '';
  completingId: number | null = null; // amelyik emlékeztetőnél épp fut az "Elvégezve"

  // Szűrők: 0 / '' = mindegyik
  vehicleFilter = 0;
  statusFilter: ReminderStatus | '' = '';

  // Az új emlékeztető / szerkesztés / törlés ablaka külön komponensben van.
  @ViewChild(ReminderDialogComponent) dialog!: ReminderDialogComponent;

  ngOnInit() {
    this.load();
  }

  openCreate() {
    if (!this.vehicles.length || this.loading) return;

    // Ha a listában ki van szűrve egy jármű, azzal nyitjuk meg az űrlapot.
    const car = this.vehicles.find(v => v.id === this.vehicleFilter) ?? this.vehicles[0];
    this.dialog.openCreate(car.id);
  }

  // A régi változatot (ha volt) kicseréljük az újra, a sorrendet a filtered getter intézi.
  onSaved(result: { entry: Reminder; edited: boolean }) {
    this.entries = [...this.entries.filter(e => e.id !== result.entry.id), result.entry];
    this.message = result.edited ? 'Az emlékeztetőt módosítottuk.' : 'Az emlékeztetőt elmentettük.';
    this.error = '';
  }

  // Ismétlődőnél a szerver kiszámolja a következő esedékességet, az egyszerit törlésre ajánljuk fel.
  complete(entry: Reminder) {
    if (this.completingId !== null) return;
    if (!entry.intervalMonths && !entry.intervalKm) {
      this.dialog.openDelete(entry);
      return;
    }

    this.completingId = entry.id;
    this.message = '';
    this.error = '';
    this.api.complete(entry.vehicleId, entry.id).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.completingId = null)
    ).subscribe({
      next: updated => {
        this.entries = this.entries.map(e => e.id === updated.id ? updated : e);
        this.message = `${updated.title}: elvégezve. Következő esedékesség: ${this.nextDue(updated)}.`;
      },
      error: () => this.error = 'Nem sikerült elvégzettnek jelölni. Frissítsd az adatokat, majd próbáld újra.'
    });
  }

  // Pl. "2027. 10. 26. · 57 770 km"
  private nextDue(entry: Reminder) {
    const parts: string[] = [];
    if (entry.dueDate) parts.push(entry.dueDate.replaceAll('-', '. ') + '.');
    if (entry.dueOdometerKm !== null) parts.push(this.distance(entry.dueOdometerKm));
    return parts.join(' · ');
  }

  onDeleted(id: number) {
    this.entries = this.entries.filter(e => e.id !== id);
    this.message = 'Az emlékeztetőt töröltük.';
    this.error = '';
  }

  load() {
    if (this.loading) return;
    this.loading = true;
    this.loadError = '';

    // Először a járművek és a profil (mértékegység), utána járművenként az emlékeztetők.
    forkJoin({
      vehicles: this.vehicleApi.list(),
      profile: this.profile.load()
    }).pipe(
      switchMap(result => {
        this.vehicles = result.vehicles;
        if (!this.vehicles.length) return of([] as Reminder[]);
        return forkJoin(this.vehicles.map(car => this.api.list(car.id))).pipe(map(groups => groups.flat()));
      }),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading = false)
    ).subscribe({
      next: entries => this.entries = entries,
      error: () => this.loadError = 'Az emlékeztetőket nem sikerült betölteni. Próbáld újra.'
    });
  }

  status(entry: Reminder) {
    const car = this.vehicles.find(v => v.id === entry.vehicleId);
    return reminderStatus(entry, car?.currentKm ?? 0);
  }

  // A jármű szűrő után látható emlékeztetők (ebből számoljuk a kártyákat is)
  get vehicleEntries() {
    return this.entries.filter(e => this.vehicleFilter === 0 || e.vehicleId === this.vehicleFilter);
  }

  // Elöl a lejártak, utána a hamarosan esedékesek, azon belül dátum szerint.
  get filtered() {
    return this.vehicleEntries
      .filter(e => this.statusFilter === '' || this.status(e) === this.statusFilter)
      .sort((a, b) => STATUS_ORDER[this.status(a)] - STATUS_ORDER[this.status(b)]
        || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999')
        || (a.dueOdometerKm ?? 0) - (b.dueOdometerKm ?? 0));
  }

  count(status: ReminderStatus) {
    return this.vehicleEntries.filter(e => this.status(e) === status).length;
  }

  get hasFilter() {
    return this.vehicleFilter !== 0 || this.statusFilter !== '';
  }

  clearFilters() {
    this.vehicleFilter = 0;
    this.statusFilter = '';
  }

  remaining(entry: Reminder) {
    const car = this.vehicles.find(v => v.id === entry.vehicleId);
    return remainingText(entry, car?.currentKm ?? 0, this.distanceUnit);
  }

  // Pl. "12 havonta · 10 000 km-enként"
  repeat(entry: Reminder) {
    const parts: string[] = [];
    if (entry.intervalMonths) parts.push(`${entry.intervalMonths} havonta`);
    if (entry.intervalKm) parts.push(`${this.distance(entry.intervalKm)}-enként`);
    return parts.length ? parts.join(' · ') : 'Egyszeri';
  }

  // km érték a választott mértékegységben, pl. "1 000 km"
  distance(km: number) {
    const unit = this.profile.preferences().distanceUnit;
    return `${toDistance(km, unit).toLocaleString('hu-HU')} ${distanceLabel(unit)}`;
  }

  get distanceUnit() {
    return this.profile.preferences().distanceUnit;
  }

  get warningDistance() {
    return this.distance(WARNING_KM);
  }

  vehicleName(id: number) {
    const car = this.vehicles.find(v => v.id === id);
    return car ? `${car.make} ${car.model} · ${car.licensePlate}` : '—';
  }
}
