import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { API_BASE_URL } from './auth.service';

export interface VehicleRequest {
  fuelTypeId: number;
  licensePlate: string;
  vin: string | null;
  vehicleModelID: number | null;
  customMake: string | null;
  customModel: string | null;
  year: number | null;
  initialKm: number;
  currentKm: number;
}
export interface Vehicle {
  id: number; fuelTypeId: number; licensePlate: string; vin: string | null;
  make: string; model: string; year: number | null; initialKm: number; currentKm: number;
}
interface VehicleResponse extends Omit<Vehicle, 'make' | 'model'> {
  make?: string;
  model?: string;
  customMake?: string | null;
  customModel?: string | null;
}
export interface FuelType { id: number; name: string; }
export interface VehicleBrand { id: number; brandName: string; }
export interface VehicleModel { id: number; modelName: string; vehicleBrandId: number; }

@Injectable({ providedIn: 'root' })
export class VehicleService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  list() {
    return this.http.get<VehicleResponse[]>(`${this.base}/ownvehicles`)
      .pipe(map(vehicles => vehicles.map(vehicle => this.normalize(vehicle))));
  }
  fuelTypes() { return this.http.get<FuelType[]>(`${this.base}/lookups/fuel-types`); }
  brands() { return this.http.get<VehicleBrand[]>(`${this.base}/vehicle-brands`); }
  models() { return this.http.get<VehicleModel[]>(`${this.base}/vehicle-models`); }
  create(request: VehicleRequest) {
    return this.http.post<VehicleResponse>(`${this.base}/ownvehicles`, request)
      .pipe(map(vehicle => this.normalize(vehicle)));
  }
  update(id: number, request: VehicleRequest) {
    return this.http.put<VehicleResponse>(`${this.base}/ownvehicles/${id}`, request)
      .pipe(map(vehicle => this.normalize(vehicle)));
  }
  delete(id: number) { return this.http.delete<void>(`${this.base}/ownvehicles/${id}`); }

  private normalize(vehicle: VehicleResponse): Vehicle {
    return {
      ...vehicle,
      make: vehicle.make ?? vehicle.customMake ?? '',
      model: vehicle.model ?? vehicle.customModel ?? ''
    };
  }
}
