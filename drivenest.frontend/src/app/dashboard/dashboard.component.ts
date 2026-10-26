import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, forkJoin, map, of, switchMap } from 'rxjs';
import { ProfileService } from '../services/profile.service';
import { Vehicle, VehicleService } from '../services/vehicle.service';
import { Refueling, RefuelingService } from '../services/refueling.service';
import { ServiceRecord, ServiceRecordService } from '../services/service-record.service';
import { Expense, ExpenseService } from '../services/expense.service';
import { AppShellComponent } from '../layout/app-shell.component';
import { currencyLabel, distanceLabel, toDistance } from '../shared/units';

// Egy sor a "Legutóbbi események" táblázatban (tankolás, szerviz vagy kiadás)
interface DashboardEvent {
  type: string;
  title: string;
  vehicleId: number;
  date: string;
  amount: number;
  link: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [AppShellComponent, RouterLink, DatePipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  private readonly profile = inject(ProfileService);
  private readonly vehicleApi = inject(VehicleService);
  private readonly refuelingApi = inject(RefuelingService);
  private readonly serviceApi = inject(ServiceRecordService);
  private readonly expenseApi = inject(ExpenseService);
  private readonly destroyRef = inject(DestroyRef);

  // Az aktuális hónap neve (pl. "október") és kulcsa (pl. "2026-10") a szűréshez
  readonly month = new Date().toLocaleDateString('hu-HU', { month: 'long', timeZone: 'Europe/Budapest' });
  private readonly monthKey = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Budapest' }).slice(0, 7);

  vehicles: Vehicle[] = [];
  refuelings: Refueling[] = [];
  services: ServiceRecord[] = [];
  expenses: Expense[] = [];

  loading = false;
  loadError = '';

  ngOnInit() {
    this.load();
  }

  load() {
    if (this.loading) return;
    this.loading = true;
    this.loadError = '';

    // Először a járművek és a profil (pénznem), utána járművenként a tankolások, szervizek és kiadások.
    forkJoin({
      vehicles: this.vehicleApi.list(),
      profile: this.profile.load()
    }).pipe(
      switchMap(result => {
        this.vehicles = result.vehicles;
        if (!this.vehicles.length) {
          return of({ refuelings: [] as Refueling[], services: [] as ServiceRecord[], expenses: [] as Expense[] });
        }
        return forkJoin({
          refuelings: forkJoin(this.vehicles.map(car => this.refuelingApi.list(car.id))).pipe(map(groups => groups.flat())),
          services: forkJoin(this.vehicles.map(car => this.serviceApi.list(car.id))).pipe(map(groups => groups.flat())),
          expenses: forkJoin(this.vehicles.map(car => this.expenseApi.list(car.id))).pipe(map(groups => groups.flat()))
        });
      }),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading = false)
    ).subscribe({
      next: data => {
        this.refuelings = data.refuelings;
        this.services = data.services;
        this.expenses = data.expenses;
      },
      error: () => this.loadError = 'Az adatokat nem sikerült betölteni. Próbáld újra.'
    });
  }

  // Az e havi költségek kategóriánként ("Hová ment a pénz?")
  get costs() {
    const thisMonth = (date: string) => date.startsWith(this.monthKey);
    return [
      { label: 'Tankolás', amount: this.sum(this.refuelings.filter(r => thisMonth(r.date)).map(r => r.totalAmount)) },
      { label: 'Szerviz', amount: this.sum(this.services.filter(s => thisMonth(s.date)).map(s => s.total)) },
      { label: 'Egyéb kiadás', amount: this.sum(this.expenses.filter(e => thisMonth(e.date)).map(e => e.amount)) }
    ];
  }

  get monthlyTotal() {
    return this.sum(this.costs.map(c => c.amount));
  }

  // Az összes tankolás, szerviz és kiadás összege
  get allTotal() {
    return this.sum(this.refuelings.map(r => r.totalAmount))
      + this.sum(this.services.map(s => s.total))
      + this.sum(this.expenses.map(e => e.amount));
  }

  get entryCount() {
    return this.refuelings.length + this.services.length + this.expenses.length;
  }

  // Megtett táv: járművenként az aktuális és a kezdő óraállás különbsége (a választott egységben)
  get distance() {
    const km = this.sum(this.vehicles.map(v => v.currentKm - v.initialKm));
    return toDistance(km, this.profile.preferences().distanceUnit);
  }

  // Ha még nincs megtett táv, nem tudunk km-költséget számolni.
  get costPerDistance() {
    return this.distance > 0 ? this.allTotal / this.distance : null;
  }

  get distanceUnit() {
    return distanceLabel(this.profile.preferences().distanceUnit);
  }

  // A sáv szélessége: a kategória hány százaléka a havi összegnek
  percent(amount: number) {
    return this.monthlyTotal ? amount / this.monthlyTotal * 100 : 0;
  }

  // A három lista egy közös listába, dátum szerint csökkenőben, az utolsó 8 bejegyzés
  get latestEvents(): DashboardEvent[] {
    const events: DashboardEvent[] = [
      ...this.refuelings.map(r => ({
        type: 'Tankolás', title: `Tankolás (${this.number(r.liters, 2)} l)`,
        vehicleId: r.vehicleId, date: r.date, amount: r.totalAmount, link: '/refuelings'
      })),
      ...this.services.map(s => ({
        type: 'Szerviz', title: s.items.map(i => i.categoryName).join(', '),
        vehicleId: s.vehicleId, date: s.date, amount: s.total, link: '/service'
      })),
      ...this.expenses.map(e => ({
        type: 'Egyéb kiadás', title: e.categoryName,
        vehicleId: e.vehicleId, date: e.date, amount: e.amount, link: '/expenses'
      }))
    ];
    return events.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  }

  plate(vehicleId: number) {
    return this.vehicles.find(v => v.id === vehicleId)?.licensePlate ?? '—';
  }

  get unit() {
    return currencyLabel(this.profile.preferences().currency);
  }

  number(value: number, digits = 0) {
    return value.toLocaleString('hu-HU', { maximumFractionDigits: digits });
  }

  private sum(values: number[]) {
    return values.reduce((total, value) => total + value, 0);
  }
}
