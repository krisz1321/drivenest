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
import { consumptionLabel, currencyLabel, distanceLabel, toConsumption, toDistance, toVolume, volumeLabel } from '../shared/units';

// Egy sor az idővonalon (tankolás, szerviz vagy kiadás)
interface HistoryEntry {
  id: string;
  kind: 'fuel' | 'service' | 'expense';
  title: string;
  details: string;
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
  private readonly destroyRef = inject(DestroyRef);
  private readonly vehicleId$ = toObservable(this.selected.vehicleId);
  private subscription?: Subscription;

  vehicles: Vehicle[] = [];
  months: HistoryMonth[] = [];
  loading = false;
  loadError = '';

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
        ? of({ refuelings: [] as Refueling[], services: [] as ServiceRecord[], expenses: [] as Expense[], consumption: null })
        : forkJoin({
          refuelings: this.refuelingApi.list(id),
          services: this.serviceApi.list(id),
          expenses: this.expenseApi.list(id),
          consumption: this.statsApi.consumption(id)
        })),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: data => {
        this.months = this.buildMonths(data.refuelings, data.services, data.expenses, data.consumption);
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

  money(amount: number) { return `${this.number(amount)} ${currencyLabel(this.prefs.currency)}`; }

  private buildMonths(refuelings: Refueling[], services: ServiceRecord[], expenses: Expense[], consumption: Consumption | null) {
    const segments = consumption?.segments ?? [];
    const entries: HistoryEntry[] = [
      ...refuelings.map(r => ({
        id: `fuel-${r.id}`, kind: 'fuel' as const, title: 'Tankolás', details: this.fuelDetails(r, segments.find(s => s.endRefuelingId === r.id)),
        date: r.date, odometerKm: r.odometerKm, amount: r.totalAmount
      })),
      ...services.map(s => ({
        id: `service-${s.id}`, kind: 'service' as const, title: s.items.map(i => i.categoryName).join(', ') || 'Szerviz',
        details: `Szerviz · ${this.distance(s.odometerKm)}`, date: s.date, odometerKm: s.odometerKm, amount: s.total
      })),
      ...expenses.map(e => ({
        id: `expense-${e.id}`, kind: 'expense' as const, title: e.categoryName,
        details: ['Kiadás', e.location].filter(Boolean).join(' · '), date: e.date, odometerKm: e.odometerKm, amount: e.amount
      }))
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

  private fuelDetails(r: Refueling, segment: ConsumptionSegment | undefined) {
    const parts = [this.distance(r.odometerKm)];
    if (segment) parts.push(this.consumption(segment.litersPer100Km));
    else if (!r.isFullTank) parts.push('részleges');
    parts.push(`${this.number(toVolume(r.liters, this.prefs.volumeUnit), 2)} ${volumeLabel(this.prefs.volumeUnit)}`);
    return parts.join(' · ');
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
