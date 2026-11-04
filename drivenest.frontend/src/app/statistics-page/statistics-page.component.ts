import { Component, DestroyRef, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, finalize, forkJoin } from 'rxjs';
import { AppShellComponent } from '../layout/app-shell.component';
import { ProfileService } from '../services/profile.service';
import { Vehicle, VehicleService } from '../services/vehicle.service';
import { StatsService, StatsSummary } from '../services/stats.service';
import {
  KM_PER_MILE, LITERS_PER_GALLON, consumptionLabel, currencyLabel, distanceLabel, toConsumption, toDistance, toVolume, volumeLabel
} from '../shared/units';
import { ArcElement, Chart, DoughnutController, Tooltip } from 'chart.js';

Chart.register(DoughnutController, ArcElement, Tooltip);

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

  readonly periods = [
    { value: 'month', label: 'Ez a hónap' },
    { value: '30days', label: 'Elmúlt 30 nap' },
    { value: 'year', label: 'Idei év' },
    { value: 'all', label: 'Összes' }
  ];
  period = 'all';

  loading = false;
  loadingSummary = false;
  loadError = '';
  private summarySub?: Subscription;
  private costChart?: Chart<'doughnut'>;

  // A canvas csak akkor létezik, ha van adat, ezért itt hozzuk létre / dobjuk el a diagramot.
  @ViewChild('costChart') set costCanvas(canvas: ElementRef<HTMLCanvasElement> | undefined) {
    this.costChart?.destroy();
    this.costChart = canvas ? this.createCostChart(canvas.nativeElement) : undefined;
  }

  ngOnInit() {
    this.load();
    this.destroyRef.onDestroy(() => this.costChart?.destroy());
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
    this.loadError = '';
    const range = this.range();
    this.summarySub = this.statsApi.summary(this.vehicleId, range.from, range.to).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loadingSummary = false)
    ).subscribe({
      next: summary => this.summary = summary,
      error: () => this.loadError = 'A statisztikát nem sikerült betölteni. Próbáld újra.'
    });
  }

  // A kiválasztott időszak kezdete és vége (yyyy-MM-dd), magyar idő szerint
  private range() {
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Budapest' });
    switch (this.period) {
      case 'month': return { from: today.slice(0, 7) + '-01', to: today };
      case 'year': return { from: today.slice(0, 4) + '-01-01', to: today };
      case '30days': {
        const start = new Date(today + 'T00:00:00Z');
        start.setUTCDate(start.getUTCDate() - 29);
        return { from: start.toISOString().slice(0, 10), to: today };
      }
      default: return { from: undefined, to: today };
    }
  }

  // Költségmegoszlás sávokhoz és a fánkdiagramhoz
  get costs() {
    if (!this.summary) return [];
    return [
      { label: 'Tankolás', amount: this.summary.refuelingCost, color: '#d9943b' },
      { label: 'Szerviz', amount: this.summary.serviceCost, color: '#2a78d6' },
      { label: 'Egyéb kiadás', amount: this.summary.expenseCost, color: '#1baf7a' }
    ];
  }

  private createCostChart(canvas: HTMLCanvasElement) {
    const costs = this.costs;
    return new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: costs.map(c => c.label),
        datasets: [{
          data: costs.map(c => c.amount),
          backgroundColor: costs.map(c => c.color),
          borderColor: '#ffffff',
          borderWidth: 2
        }]
      },
      options: {
        cutout: '65%',
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              label: item => ` ${this.number(item.parsed)} ${this.unit} (${this.number(this.percent(item.parsed), 1)}%)`
            }
          }
        }
      }
    });
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

  volume(liters: number | null) {
    return liters === null ? null : toVolume(liters, this.profile.preferences().volumeUnit);
  }

  pricePerVolume(pricePerLiter: number | null) {
    if (pricePerLiter === null) return null;
    return this.profile.preferences().volumeUnit === 'gal' ? pricePerLiter * LITERS_PER_GALLON : pricePerLiter;
  }

  // km/l-nél és mpg-nél a legjobb a legnagyobb szám, de a backend l/100 km-ben adja, így ez is jó marad.
  consumption(litersPer100Km: number | null) {
    return litersPer100Km === null ? null : toConsumption(litersPer100Km, this.profile.preferences().consumptionUnit);
  }

  get unit() {
    return currencyLabel(this.profile.preferences().currency);
  }

  get distanceUnit() {
    return distanceLabel(this.profile.preferences().distanceUnit);
  }

  get volumeUnit() {
    return volumeLabel(this.profile.preferences().volumeUnit);
  }

  get consumptionUnit() {
    return consumptionLabel(this.profile.preferences().consumptionUnit);
  }

  number(value: number | null, digits = 0) {
    return value === null ? '—' : value.toLocaleString('hu-HU', { maximumFractionDigits: digits });
  }
}
