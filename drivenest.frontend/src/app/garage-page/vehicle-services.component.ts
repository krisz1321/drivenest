import { Component, DestroyRef, Input, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, forkJoin } from 'rxjs';
import { Vehicle } from '../services/vehicle.service';
import { ServiceCategory, ServiceRecord, ServiceRecordService } from '../services/service-record.service';
import { ServiceDialogComponent } from '../service-page/service-dialog.component';
import { Currency, currencyLabel } from '../shared/units';

// Egy jármű szervizei a jármű oldalán (mint a VehicleRefuelingsComponent a tankolásokhoz).
// A felugró ablak ugyanaz, mint a Szerviz oldalon.
@Component({
  selector: 'app-vehicle-services', standalone: true, imports: [ServiceDialogComponent],
  templateUrl: './vehicle-services.component.html', styleUrl: './vehicle-services.component.scss'
})
export class VehicleServicesComponent implements OnInit {
  @Input({ required: true }) vehicle!: Vehicle;
  @Input() currency: Currency = 'HUF';
  @ViewChild(ServiceDialogComponent) dialog!: ServiceDialogComponent;
  private readonly api = inject(ServiceRecordService);
  private readonly destroyRef = inject(DestroyRef);
  entries: ServiceRecord[] = [];
  categories: ServiceCategory[] = [];
  loading = false;
  loadError = '';
  message = '';

  get unit() { return currencyLabel(this.currency); }
  get monthlyTotal() {
    const month = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Budapest' }).slice(0, 7);
    return this.entries.filter(e => e.date.startsWith(month)).reduce((total, e) => total + e.total, 0);
  }
  number(value: number, digits = 2) { return value.toLocaleString('hu-HU', { maximumFractionDigits: digits }); }
  typeNames(entry: ServiceRecord) { return entry.items.map(i => i.categoryName).join(', '); }
  ngOnInit() { this.load(); }

  load() {
    if (this.loading) return;
    this.loading = true;
    this.loadError = '';
    forkJoin({ entries: this.api.list(this.vehicle.id), categories: this.api.categories() })
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading = false)).subscribe({
        next: result => {
          this.entries = this.sorted(result.entries);
          this.categories = result.categories;
        },
        error: () => this.loadError = 'A szervizeket nem sikerült betölteni. Próbáld újra.'
      });
  }

  // A jármű oldalán a Gyors rögzítés gombja hívja.
  openCreate() {
    if (this.loading || !this.categories.length) return;
    this.dialog.openCreate(this.vehicle.id);
  }

  onSaved(result: { entry: ServiceRecord; edited: boolean }) {
    this.entries = this.sorted([...this.entries.filter(e => e.id !== result.entry.id), result.entry]);
    this.message = result.edited ? 'A szervizt módosítottuk.' : 'A szervizt elmentettük.';
  }

  onDeleted(id: number) {
    this.entries = this.entries.filter(e => e.id !== id);
    this.message = 'A szervizt töröltük.';
  }

  private sorted(entries: ServiceRecord[]) {
    return [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.odometerKm - a.odometerKm || b.id - a.id);
  }
}
