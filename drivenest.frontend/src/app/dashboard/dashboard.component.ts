import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { FuelType, Vehicle, VehicleService } from '../services/vehicle.service';
import { ProfileService } from '../services/profile.service';
import { AppShellComponent } from '../layout/app-shell.component';
import { consumptionLabel, currencyLabel, distanceLabel } from '../shared/units';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, AppShellComponent, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  private readonly api = inject(VehicleService);
  private readonly profile = inject(ProfileService);
  private readonly destroyRef = inject(DestroyRef);
  readonly month = new Date().toLocaleDateString('hu-HU', { month: 'long', timeZone: 'Europe/Budapest' });
  vehicles: Vehicle[] = [];
  fuelTypes: FuelType[] = [];
  loading = true;
  saving = false;
  loadErrors: string[] = [];
  message = '';
  get currency() { return this.profile.preferences().currency; }
  get stats() {
    const { currency, distanceUnit, consumptionUnit } = this.profile.preferences();
    return [
      { label: 'Utolsó fogyasztás', unit: consumptionLabel(consumptionUnit), detail: 'Tele tanktól tele tankig', icon: '◉' },
      { label: 'Havi kiadás', unit: currencyLabel(currency), detail: 'Minden kategória', icon: '↗' },
      { label: 'Kilométerköltség', unit: `${currencyLabel(currency)}/${distanceLabel(distanceUnit)}`, detail: 'A rögzített időszak alapján', icon: '↔' },
      { label: 'Figyelmet igényel', unit: 'teendő', detail: 'Közelgő emlékeztetők', icon: '!' }
    ];
  }
  ngOnInit() { this.load(); }

  load() {
    if (this.saving) return;
    this.loading = true;
    this.loadErrors = [];
    forkJoin({
      vehicles: this.api.list().pipe(catchError(() => { this.loadErrors.push('A járművek betöltése nem sikerült. Próbáld újra.'); return of(null); })),
      fuelTypes: this.api.fuelTypes().pipe(catchError(() => { this.loadErrors.push('Az üzemanyagtípusok nem érhetők el. A jármű mentéséhez próbáld újra a betöltést.'); return of(null); })),
      user: this.profile.load().pipe(catchError(() => { this.loadErrors.push('A profil betöltése nem sikerült.'); return of(null); }))
    }).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading = false)).subscribe(result => {
      if (result.vehicles !== null) {
        this.vehicles = result.vehicles;
      }
      if (result.fuelTypes !== null) this.fuelTypes = result.fuelTypes;
    });
  }


}
