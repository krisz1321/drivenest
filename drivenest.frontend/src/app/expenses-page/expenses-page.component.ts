import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, forkJoin, map, of, switchMap } from 'rxjs';
import { AppShellComponent } from '../layout/app-shell.component';
import { ProfileService } from '../services/profile.service';
import { Vehicle, VehicleService } from '../services/vehicle.service';
import { Expense, ExpenseCategory, ExpenseService } from '../services/expense.service';
import { currencyLabel } from '../shared/units';

@Component({
  selector: 'app-expenses-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AppShellComponent],
  templateUrl: './expenses-page.component.html',
  styleUrl: './expenses-page.component.scss'
})
export class ExpensesPageComponent implements OnInit {
  private readonly vehicleApi = inject(VehicleService);
  private readonly api = inject(ExpenseService);
  private readonly profile = inject(ProfileService);
  private readonly destroyRef = inject(DestroyRef);

  vehicles: Vehicle[] = [];
  categories: ExpenseCategory[] = [];
  entries: Expense[] = [];

  loading = false;
  loadError = '';

  // Szűrők: 0 = mindegyik
  vehicleFilter = 0;
  categoryFilter = 0;

  ngOnInit() {
    this.load();
  }

  load() {
    if (this.loading) return;
    this.loading = true;
    this.loadError = '';

    // Először a járművek, kategóriák és a profil (pénznem), utána járművenként a kiadások.
    forkJoin({
      vehicles: this.vehicleApi.list(),
      categories: this.api.categories(),
      profile: this.profile.load()
    }).pipe(
      switchMap(result => {
        this.vehicles = result.vehicles;
        this.categories = result.categories;
        if (!this.vehicles.length) return of([] as Expense[]);
        return forkJoin(this.vehicles.map(car => this.api.list(car.id))).pipe(map(groups => groups.flat()));
      }),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading = false)
    ).subscribe({
      next: entries => this.entries = this.sorted(entries),
      error: () => this.loadError = 'A kiadásokat nem sikerült betölteni. Próbáld újra.'
    });
  }

  // A szűrők alapján látható kiadások
  get filtered() {
    return this.entries.filter(e =>
      (this.vehicleFilter === 0 || e.vehicleId === this.vehicleFilter) &&
      (this.categoryFilter === 0 || e.categoryId === this.categoryFilter));
  }

  get total() {
    return this.sum(this.filtered);
  }

  get monthlyTotal() {
    const month = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Budapest' }).slice(0, 7);
    return this.sum(this.filtered.filter(e => e.date.startsWith(month)));
  }

  // Melyik kategóriára ment el a legtöbb pénz (a szűrt listából)
  get topCategory() {
    const totals = new Map<string, number>();
    for (const e of this.filtered) {
      totals.set(e.categoryName, (totals.get(e.categoryName) ?? 0) + e.amount);
    }

    let best: { name: string, amount: number } | null = null;
    for (const [name, amount] of totals) {
      if (!best || amount > best.amount) best = { name, amount };
    }
    return best;
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

  private sum(list: Expense[]) {
    return list.reduce((total, e) => total + e.amount, 0);
  }

  private sorted(entries: Expense[]) {
    return [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.odometerKm - a.odometerKm || b.id - a.id);
  }
}
