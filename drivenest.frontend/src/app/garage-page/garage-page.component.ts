import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { Vehicle, VehicleService, FuelType } from '../services/vehicle.service';
import { ProfileService } from '../services/profile.service';
import { distanceLabel, toDistance } from '../shared/units';
import { AppShellComponent } from '../layout/app-shell.component';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-garage-page',
  standalone: true,
  imports: [AppShellComponent, RouterLink],
  templateUrl: './garage-page.component.html',
  styleUrl: './garage-page.component.scss'
})
export class GaragePageComponent implements OnInit {
  private readonly api = inject(VehicleService);
  private readonly profile = inject(ProfileService);
  private readonly destroyRef = inject(DestroyRef);
  vehicles: Vehicle[] = [];
  fuelTypes: FuelType[] = [];
  loading = true;
  loadError = '';

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.loadError = '';
    forkJoin({
      vehicles: this.api.list(),
      fuelTypes: this.api.fuelTypes().pipe(catchError(() => of([] as FuelType[]))),
      profile: this.profile.load().pipe(catchError(() => of(null)))
    }).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading = false)).subscribe({
      next: result => { this.vehicles = result.vehicles; this.fuelTypes = result.fuelTypes; },
      error: () => this.loadError = 'A járművek betöltése nem sikerült. Próbáld újra.'
    });
  }

  name(vehicle: Vehicle) { return `${vehicle.make} ${vehicle.model}`; }
  details(vehicle: Vehicle) {
    return [vehicle.year, this.fuelTypes.find(fuel => fuel.id === vehicle.fuelTypeId)?.name,
      vehicle.vin ? `VIN ${vehicle.vin.slice(0, 6)}…` : null].filter(Boolean).join(' · ');
  }
  mileage(vehicle: Vehicle) {
    const unit = this.profile.preferences().distanceUnit;
    return `${toDistance(vehicle.currentKm, unit).toLocaleString('hu-HU')} ${distanceLabel(unit)}`;
  }
  color(vehicle: Vehicle) { return ['blue', 'bronze', 'green'][vehicle.id % 3]; }
}
