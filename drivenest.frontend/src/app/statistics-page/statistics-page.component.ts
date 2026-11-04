import { Component, DestroyRef, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, finalize, forkJoin } from 'rxjs';
import { AppShellComponent } from '../layout/app-shell.component';
import { ProfileService } from '../services/profile.service';
import { Vehicle, VehicleService } from '../services/vehicle.service';
import { ConsumptionSegment, StatsService, StatsSummary } from '../services/stats.service';
import {
  KM_PER_MILE, LITERS_PER_GALLON, consumptionLabel, currencyLabel, distanceLabel, toConsumption, toDistance, toVolume, volumeLabel
} from '../shared/units';
import {
  ArcElement, CategoryScale, Chart, DoughnutController, LineController, LineElement, LinearScale, PointElement, Tooltip
} from 'chart.js';

Chart.register(DoughnutController, ArcElement, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip);

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
  segments: ConsumptionSegment[] = [];

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
  private trendChart?: Chart<'line'>;

  // A canvas csak akkor létezik, ha van adat, ezért itt hozzuk létre / dobjuk el a diagramot.
  @ViewChild('costChart') set costCanvas(canvas: ElementRef<HTMLCanvasElement> | undefined) {
    this.costChart?.destroy();
    this.costChart = canvas ? this.createCostChart(canvas.nativeElement) : undefined;
  }

  @ViewChild('trendChart') set trendCanvas(canvas: ElementRef<HTMLCanvasElement> | undefined) {
    this.trendChart?.destroy();
    this.trendChart = canvas ? this.createTrendChart(canvas.nativeElement) : undefined;
  }

  ngOnInit() {
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
    this.load();
    this.destroyRef.onDestroy(() => {
      this.costChart?.destroy();
      this.trendChart?.destroy();
    });
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
    this.segments = [];
    if (!this.vehicleId) return;

    this.loadingSummary = true;
    this.loadError = '';
    const range = this.range();
    this.summarySub = forkJoin({
      summary: this.statsApi.summary(this.vehicleId, range.from, range.to),
      consumption: this.statsApi.consumption(this.vehicleId)
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loadingSummary = false)
    ).subscribe({
      next: result => {
        this.summary = result.summary;
        // Ugyanúgy, mint a backendnél: az időszakban lezárult szakaszok számítanak
        this.segments = result.consumption.segments
          .filter(s => (!range.from || s.endDate >= range.from) && s.endDate <= range.to);
      },
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

  private createTrendChart(canvas: HTMLCanvasElement) {
    const values = this.segments.map(s => this.consumption(s.litersPer100Km));
    const average = this.consumption(this.summary?.averageLitersPer100Km ?? null);
    const muted = '#738491';
    const grid = '#e1e7ec';

    return new Chart(canvas, {
      type: 'line',
      data: {
        labels: this.segments.map(s => this.date(s.endDate)),
        datasets: [
          {
            label: 'Fogyasztás',
            data: values,
            borderColor: '#d9943b',
            backgroundColor: '#d9943b',
            borderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2
          },
          {
            label: 'Átlag',
            data: values.map(() => average),
            borderColor: muted,
            backgroundColor: muted,
            borderWidth: 1.5,
            borderDash: [6, 4],
            pointRadius: 0,
            pointHoverRadius: 0
          }
        ]
      },
      options: {
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { grid: { display: false }, border: { color: grid }, ticks: { color: muted, maxRotation: 0, autoSkip: true } },
          y: { grid: { color: grid }, border: { display: false }, ticks: { color: muted, maxTicksLimit: 5 } }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: item => ` ${item.dataset.label}: ${this.number(item.parsed.y, 2)} ${this.consumptionUnit}`,
              footer: items => {
                const s = this.segments[items[0].dataIndex];
                return `${this.number(this.distance(s.distanceKm))} ${this.distanceUnit}, ${this.number(this.volume(s.liters), 2)} ${this.volumeUnit}`;
              }
            }
          }
        }
      }
    });
  }

  // "2026-04-25" -> "2026. 04. 25."
  private date(value: string) {
    return value.split('-').join('. ') + '.';
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
