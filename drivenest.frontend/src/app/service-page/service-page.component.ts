import { Component, DestroyRef, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, forkJoin, map, of, switchMap } from 'rxjs';
import { AppShellComponent } from '../layout/app-shell.component';
import { ProfileService } from '../services/profile.service';
import { Vehicle, VehicleService } from '../services/vehicle.service';
import { ServiceCategory, ServiceRecord, ServiceRecordService } from '../services/service-record.service';
import { currencyLabel } from '../shared/units';
import { ServiceDialogComponent } from './service-dialog.component';

@Component({
  selector: 'app-service-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AppShellComponent, ServiceDialogComponent],
  templateUrl: './service-page.component.html',
  styleUrl: './service-page.component.scss'
})
export class ServicePageComponent implements OnInit {
  private readonly vehicleApi = inject(VehicleService);
  private readonly api = inject(ServiceRecordService);
  private readonly profile = inject(ProfileService);
  private readonly destroyRef = inject(DestroyRef);

  vehicles: Vehicle[] = [];
  categories: ServiceCategory[] = [];
  entries: ServiceRecord[] = [];

  loading = false;
  loadError = '';
  message = '';

  // Szűrők: 0 = mindegyik
  vehicleFilter = 0;
  categoryFilter = 0;

  // Az új szerviz / szerkesztés / törlés ablaka külön komponensben van.
  @ViewChild(ServiceDialogComponent) dialog!: ServiceDialogComponent;

  ngOnInit() {
    this.load();
  }

  openCreate() {
    if (!this.vehicles.length || this.loading) return;

    // Ha a listában ki van szűrve egy jármű vagy típus, azzal nyitjuk meg az űrlapot.
    const car = this.vehicles.find(v => v.id === this.vehicleFilter) ?? this.vehicles[0];
    this.dialog.openCreate(car.id, this.categoryFilter);
  }

  // A régi változatot (ha volt) kicseréljük az újra.
  onSaved(result: { entry: ServiceRecord; edited: boolean }) {
    this.entries = this.sorted([...this.entries.filter(e => e.id !== result.entry.id), result.entry]);
    this.message = result.edited ? 'A szervizt módosítottuk.' : 'A szervizt elmentettük.';
  }

  onDeleted(id: number) {
    this.entries = this.entries.filter(e => e.id !== id);
    this.message = 'A szervizt töröltük.';
  }

  load() {
    if (this.loading) return;
    this.loading = true;
    this.loadError = '';

    // Először a járművek, a szerviztípusok és a profil (pénznem), utána járművenként a szervizek.
    forkJoin({
      vehicles: this.vehicleApi.list(),
      categories: this.api.categories(),
      profile: this.profile.load()
    }).pipe(
      switchMap(result => {
        this.vehicles = result.vehicles;
        this.categories = result.categories;
        if (!this.vehicles.length) return of([] as ServiceRecord[]);
        return forkJoin(this.vehicles.map(car => this.api.list(car.id))).pipe(map(groups => groups.flat()));
      }),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading = false)
    ).subscribe({
      next: entries => this.entries = this.sorted(entries),
      error: () => this.loadError = 'A szervizeket nem sikerült betölteni. Próbáld újra.'
    });
  }

  // Egy szerviz típusai vesszővel elválasztva (kártyán)
  typeNames(entry: ServiceRecord) {
    return entry.items.map(i => i.categoryName).join(', ');
  }

  // A szűrőben csak azok a típusok jelennek meg, amikhez már van bejegyzés (különben 119 elem lenne benne).
  get usedCategories() {
    return this.categories.filter(c => this.entries.some(e => e.items.some(i => i.categoryId === c.id)));
  }

  // A szűrők alapján látható szervizek (típusnál az, amelyikben szerepel az adott típus)
  get filtered() {
    return this.entries.filter(e =>
      (this.vehicleFilter === 0 || e.vehicleId === this.vehicleFilter) &&
      (this.categoryFilter === 0 || e.items.some(i => i.categoryId === this.categoryFilter)));
  }

  get total() {
    return this.sum(this.filtered);
  }

  get monthlyTotal() {
    const month = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Budapest' }).slice(0, 7);
    return this.sum(this.filtered.filter(e => e.date.startsWith(month)));
  }

  // A lista dátum szerint csökkenő, így az első elem a legutóbbi szerviz.
  get lastService() {
    return this.filtered[0] ?? null;
  }

  get hasFilter() {
    return this.vehicleFilter !== 0 || this.categoryFilter !== 0;
  }

  clearFilters() {
    this.vehicleFilter = 0;
    this.categoryFilter = 0;
  }

  get unit() {
    return currencyLabel(this.profile.preferences().currency);
  }

  vehicleName(id: number) {
    const car = this.vehicles.find(v => v.id === id);
    return car ? `${car.make} ${car.model} · ${car.licensePlate}` : '—';
  }

  number(value: number, digits = 2) {
    return value.toLocaleString('hu-HU', { maximumFractionDigits: digits });
  }

  private sum(list: ServiceRecord[]) {
    return list.reduce((total, e) => total + e.total, 0);
  }

  private sorted(entries: ServiceRecord[]) {
    return [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.odometerKm - a.odometerKm || b.id - a.id);
  }
}
