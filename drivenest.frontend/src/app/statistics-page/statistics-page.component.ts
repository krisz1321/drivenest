import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, finalize, forkJoin } from 'rxjs';
import { AppShellComponent } from '../layout/app-shell.component';
import { ProfileService } from '../services/profile.service';
import { Vehicle, VehicleService } from '../services/vehicle.service';
import { StatsService, StatsSummary } from '../services/stats.service';
import { KM_PER_MILE, currencyLabel, distanceLabel, toDistance } from '../shared/units';

@Component({
  selector: 'app-statistics-page',
  standalone: true,
  imports: [FormsModule, RouterLink, AppShellComponent],
  templateUrl: './statistics-page.component.html',
  styleUrl: './statistics-page.component.scss'
})
export class StatisticsPageComponent implements OnInit {
  private readonly vehicleApi = inject(VehicleService);
  private readonly statsApi = inject(StatsService);
  private readonly profile = inject(ProfileService);
  private readonly destroyRef = inject(DestroyRef);

  vehicles: Vehicle[] = [];
  vehicleId = 0;
  summary: StatsSummary | null = null;

  loading = false;
  loadingSummary = false;
  loadError = '';
  private summarySub?: Subscription;

  ngOnInit() {
    this.load();
  }

  load() {
    if (this.loading) return;
    this.loading = true;
    this.loadError = '';

    forkJoin({
      vehicles: this.vehicleApi.list(),
      profile: this.profile.load()
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading = false)
    ).subscribe({
      next: result => {
        this.vehicles = result.vehicles;
        if (!this.vehicles.some(v => v.id === this.vehicleId)) this.vehicleId = this.vehicles[0]?.id ?? 0;
        this.loadSummary();
      },
      error: () => this.loadError = 'Az adatokat nem sikerült betölteni. Próbáld újra.'
    });
  }

  // Járműváltáskor a régi kérést eldobjuk, hogy ne az jöjjön meg később.
  loadSummary() {
    this.summarySub?.unsubscribe();
    this.summary = null;
    if (!this.vehicleId) return;

    this.loadingSummary = true;
    this.summarySub = this.statsApi.summary(this.vehicleId).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loadingSummary = false)
    ).subscribe({
      next: summary => this.summary = summary,
      error: () => this.loadError = 'A statisztikát nem sikerült betölteni. Próbáld újra.'
    });
  }

  // Költségmegoszlás sávokhoz
  get costs() {
    if (!this.summary) return [];
    return [
      { label: 'Tankolás', amount: this.summary.refuelingCost },
      { label: 'Szerviz', amount: this.summary.serviceCost },
      { label: 'Egyéb kiadás', amount: this.summary.expenseCost }
    ];
  }

  percent(amount: number) {
    return this.summary?.totalCost ? amount / this.summary.totalCost * 100 : 0;
  }

  distance(km: number) {
    return toDistance(km, this.profile.preferences().distanceUnit);
  }

  // A backend km-ben számol, mérföldnél át kell váltani.
  costPerDistance(costPerKm: number | null) {
    if (costPerKm === null) return null;
    return this.profile.preferences().distanceUnit === 'mi' ? costPerKm * KM_PER_MILE : costPerKm;
  }

  distancePerDay(kmPerDay: number | null) {
    if (kmPerDay === null) return null;
    return this.profile.preferences().distanceUnit === 'mi' ? kmPerDay / KM_PER_MILE : kmPerDay;
  }

  get unit() {
    return currencyLabel(this.profile.preferences().currency);
  }

  get distanceUnit() {
    return distanceLabel(this.profile.preferences().distanceUnit);
  }

  number(value: number | null, digits = 0) {
    return value === null ? '—' : value.toLocaleString('hu-HU', { maximumFractionDigits: digits });
  }
}
