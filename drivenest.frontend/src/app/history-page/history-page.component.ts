import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subscription, forkJoin, of, switchMap, tap } from 'rxjs';
import { AppShellComponent } from '../layout/app-shell.component';
import { ProfileService } from '../services/profile.service';
import { Vehicle, VehicleService } from '../services/vehicle.service';
import { SelectedVehicleService } from '../services/selected-vehicle.service';
import { Refueling, RefuelingService } from '../services/refueling.service';
import { ServiceRecord, ServiceRecordService } from '../services/service-record.service';
import { Expense, ExpenseService } from '../services/expense.service';
import { Consumption, ConsumptionSegment, StatsService } from '../services/stats.service';
import { Reminder, ReminderService, reminderStatus, remainingText } from '../services/reminder.service';
import { consumptionLabel, currencyLabel, distanceLabel, toConsumption, toDistance, toVolume, volumeLabel } from '../shared/units';

// Egy sor az idővonalon (tankolás, szerviz vagy kiadás)
interface HistoryEntry {
  id: string;
  kind: 'fuel' | 'service' | 'expense';
  title: string;
  details: string;
  // A kibontott sor részletei és a szerkesztés helye (ott van a dialógus)
  rows: { label: string; value: string }[];
  editLink: (string | number)[];
  date: string;
  odometerKm: number;
  amount: number;
}

interface HistoryMonth {
  key: string;
  label: string;
  entries: HistoryEntry[];
  total: number;
  distanceKm: number;
  litersPer100Km: number | null;
}

// "mint októberben" - a hónapnevek -ban/-ben raggal
const MONTHS_IN = ['januárban', 'februárban', 'márciusban', 'áprilisban', 'májusban', 'júniusban',
  'júliusban', 'augusztusban', 'szeptemberben', 'októberben', 'novemberben', 'decemberben'];

@Component({
  selector: 'app-history-page',
  standalone: true,
  imports: [AppShellComponent, RouterLink],
  templateUrl: './history-page.component.html',
  styleUrl: './history-page.component.scss'
})
export class HistoryPageComponent implements OnInit {
  private readonly profile = inject(ProfileService);
  private readonly vehicleApi = inject(VehicleService);
  private readonly selected = inject(SelectedVehicleService);
  private readonly refuelingApi = inject(RefuelingService);
  private readonly serviceApi = inject(ServiceRecordService);
  private readonly expenseApi = inject(ExpenseService);
  private readonly statsApi = inject(StatsService);
  private readonly reminderApi = inject(ReminderService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly vehicleId$ = toObservable(this.selected.vehicleId);
  private subscription?: Subscription;

  vehicles: Vehicle[] = [];
  months: HistoryMonth[] = [];
  reminders: Reminder[] = [];
  loading = false;
  loadError = '';
  // Egyszerre egy sor lehet kibontva
  openId: string | null = null;

  get vehicle() { return this.vehicles.find(v => v.id === this.selected.vehicleId()) ?? null; }
  private get prefs() { return this.profile.preferences(); }

  ngOnInit() {
    this.load();
  }

  // A fejlécben választott autó változásakor újratölt.
  load() {
    this.subscription?.unsubscribe();
    this.loading = true;
    this.loadError = '';
    this.subscription = forkJoin({ vehicles: this.vehicleApi.list(), profile: this.profile.load() }).pipe(
      switchMap(result => {
        this.vehicles = result.vehicles;
        this.selected.pick(result.vehicles);
        return this.vehicleId$;
      }),
      tap(() => this.loading = true),
      switchMap(id => id === null
        ? of({ refuelings: [] as Refueling[], services: [] as ServiceRecord[], expenses: [] as Expense[], consumption: null, reminders: [] as Reminder[] })
        : forkJoin({
          refuelings: this.refuelingApi.list(id),
          services: this.serviceApi.list(id),
          expenses: this.expenseApi.list(id),
          consumption: this.statsApi.consumption(id),
          reminders: this.reminderApi.list(id)
        })),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: data => {
        this.months = this.buildMonths(data.refuelings, data.services, data.expenses, data.consumption);
        this.reminders = data.reminders;
        this.openId = null;
        this.loading = false;
      },
      error: () => {
        this.loadError = 'Az előzményeket nem sikerült betölteni. Próbáld újra.';
        this.loading = false;
      }
    });
  }

  monthSummary(month: HistoryMonth) {
    const parts = [this.money(month.total)];
    if (month.distanceKm > 0) parts.push(this.distance(month.distanceKm));
    if (month.litersPer100Km !== null) parts.push(this.consumption(month.litersPer100Km));
    return parts.join(' · ');
  }

  // Összevetés az előző naptári hónappal, ha abban is volt költség.
  monthChange(month: HistoryMonth) {
    const [year, m] = month.key.split('-').map(Number);
    const prevKey = m === 1 ? `${year - 1}-12` : `${year}-${String(m - 1).padStart(2, '0')}`;
    const prev = this.months.find(x => x.key === prevKey);
    if (!prev || !prev.total) return null;
    const percent = Math.round((month.total - prev.total) / prev.total * 100);
    const name = MONTHS_IN[(m + 10) % 12];
    if (percent === 0) return { text: 'ugyanannyi', name };
    return { text: `${Math.abs(percent)}%-kal ${percent > 0 ? 'több' : 'kevesebb'}`, name };
  }

  // A nyitott emlékeztetők: elöl a lejártak, aztán a hamarosan esedékesek, azon belül dátum szerint
  get reminderCards() {
    const order = { overdue: 0, soon: 1, ok: 2, completed: 3 };
    const km = this.vehicle?.currentKm ?? 0;
    return this.reminders
      .filter(entry => !entry.isCompleted)
      .map(entry => ({ entry, status: reminderStatus(entry, km), remaining: remainingText(entry, km, this.prefs.distanceUnit) }))
      .sort((a, b) => order[a.status] - order[b.status]
        || (a.entry.dueDate ?? '9999').localeCompare(b.entry.dueDate ?? '9999')
        || (a.entry.dueOdometerKm ?? 0) - (b.entry.dueOdometerKm ?? 0));
  }

  // Pl. "145 000 km vagy 2026. dec. 7."
  dueText(entry: Reminder) {
    const parts: string[] = [];
    if (entry.dueOdometerKm !== null) parts.push(this.distance(entry.dueOdometerKm));
    if (entry.dueDate) parts.push(new Date(entry.dueDate).toLocaleDateString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }));
    return parts.join(' vagy ');
  }

  toggle(entry: HistoryEntry) { this.openId = this.openId === entry.id ? null : entry.id; }

  money(amount: number) { return `${this.number(amount)} ${currencyLabel(this.prefs.currency)}`; }

  private buildMonths(refuelings: Refueling[], services: ServiceRecord[], expenses: Expense[], consumption: Consumption | null) {
    const segments = consumption?.segments ?? [];
    const entries: HistoryEntry[] = [
      ...refuelings.map(r => this.fuelEntry(r, segments.find(s => s.endRefuelingId === r.id))),
      ...services.map(s => this.serviceEntry(s)),
      ...expenses.map(e => this.expenseEntry(e))
    ].sort((a, b) => b.date.localeCompare(a.date) || b.odometerKm - a.odometerKm);

    const months: HistoryMonth[] = [];
    for (const entry of entries) {
      const key = entry.date.slice(0, 7);
      let month = months.find(m => m.key === key);
      if (!month) {
        month = { key, label: this.monthLabel(key), entries: [], total: 0, distanceKm: 0, litersPer100Km: null };
        months.push(month);
      }
      month.entries.push(entry);
      month.total += entry.amount;
    }

    for (const month of months) {
      const km = month.entries.map(e => e.odometerKm).filter(km => km > 0);
      month.distanceKm = km.length ? Math.max(...km) - Math.min(...km) : 0;
      // Átlagfogyasztás: a hónapban lezárt szakaszokból
      const closed = segments.filter(s => s.endDate.startsWith(month.key));
      const distance = closed.reduce((sum, s) => sum + s.distanceKm, 0);
      const liters = closed.reduce((sum, s) => sum + s.liters, 0);
      month.litersPer100Km = distance > 0 ? liters / distance * 100 : null;
    }
    return months;
  }

  private fuelEntry(r: Refueling, segment: ConsumptionSegment | undefined): HistoryEntry {
    const unit = this.prefs.volumeUnit;
    const volume = toVolume(r.liters, unit);
    const quantity = `${this.number(volume, 2)} ${volumeLabel(unit)}`;
    const details = [this.distance(r.odometerKm)];
    if (segment) details.push(this.consumption(segment.litersPer100Km));
    else if (!r.isFullTank) details.push('részleges');
    details.push(quantity);

    const rows = [
      { label: 'Mennyiség', value: quantity },
      { label: 'Egységár', value: `${this.number(r.totalAmount / volume, 1)} ${currencyLabel(this.prefs.currency)}/${volumeLabel(unit)}` },
      { label: 'Fogyasztás', value: segment ? this.consumption(segment.litersPer100Km) : '—' },
      { label: 'Megtett táv', value: segment ? this.distance(segment.distanceKm) : '—' },
      { label: 'Tele tank', value: r.isFullTank ? 'Igen' : 'Nem' }
    ];
    return {
      id: `fuel-${r.id}`, kind: 'fuel', title: 'Tankolás', details: details.join(' · '), rows,
      editLink: ['/garage', r.vehicleId], date: r.date, odometerKm: r.odometerKm, amount: r.totalAmount
    };
  }

  private serviceEntry(s: ServiceRecord): HistoryEntry {
    const rows = s.items.map(i => ({ label: i.categoryName, value: this.money(i.amount) }));
    if (s.provider) rows.push({ label: 'Szerviz / helyszín', value: s.provider });
    if (s.description) rows.push({ label: 'Megjegyzés', value: s.description });
    return {
      id: `service-${s.id}`, kind: 'service', title: s.items.map(i => i.categoryName).join(', ') || 'Szerviz',
      details: `Szerviz · ${this.distance(s.odometerKm)}`, rows, editLink: ['/service'],
      date: s.date, odometerKm: s.odometerKm, amount: s.total
    };
  }

  private expenseEntry(e: Expense): HistoryEntry {
    return {
      id: `expense-${e.id}`, kind: 'expense', title: e.categoryName,
      details: ['Kiadás', e.location].filter(Boolean).join(' · '),
      rows: [
        { label: 'Kilométeróra', value: this.distance(e.odometerKm) },
        { label: 'Megjegyzés', value: e.description || '—' }
      ],
      editLink: ['/expenses'], date: e.date, odometerKm: e.odometerKm, amount: e.amount
    };
  }

  dateLabel(date: string) {
    return new Date(date).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }

  private monthLabel(key: string) {
    return new Date(`${key}-01`).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', timeZone: 'UTC' });
  }

  private distance(km: number) {
    return `${this.number(toDistance(km, this.prefs.distanceUnit))} ${distanceLabel(this.prefs.distanceUnit)}`;
  }

  private consumption(litersPer100Km: number) {
    return `${this.number(toConsumption(litersPer100Km, this.prefs.consumptionUnit), 1)} ${consumptionLabel(this.prefs.consumptionUnit)}`;
  }

  private number(value: number, digits = 0) {
    return value.toLocaleString('hu-HU', { maximumFractionDigits: digits });
  }
}
