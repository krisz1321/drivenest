import { Injectable, signal } from '@angular/core';
import { Vehicle } from './vehicle.service';

const STORAGE_KEY = 'drivenest.vehicle';

@Injectable({ providedIn: 'root' })
export class SelectedVehicleService {
  readonly vehicleId = signal<number | null>(this.read());

  select(id: number | null) {
    this.vehicleId.set(id);
    if (id === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, String(id));
  }

  // Ha a mentett autó már nincs meg (pl. törölték), az elsőre állunk.
  pick(vehicles: Vehicle[]): Vehicle | null {
    const vehicle = vehicles.find(v => v.id === this.vehicleId()) ?? vehicles[0] ?? null;
    if ((vehicle?.id ?? null) !== this.vehicleId()) this.select(vehicle?.id ?? null);
    return vehicle;
  }

  private read(): number | null {
    const id = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isInteger(id) && id > 0 ? id : null;
  }
}
