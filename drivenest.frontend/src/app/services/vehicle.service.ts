import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_BASE_URL } from './auth.service';

export interface VehicleRequest {
  fuelTypeId: number;
  licensePlate: string;
  vin: string | null;
  make: string;
  model: string;
  year: number | null;
  initialKm: number;
  currentKm: number;
}
export interface Vehicle extends VehicleRequest { id: number; }
export interface FuelType { id: number; name: string; }

@Injectable({ providedIn: 'root' })
export class VehicleService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  list() { return this.http.get<Vehicle[]>(`${this.base}/ownvehicles`); }
  fuelTypes() { return this.http.get<FuelType[]>(`${this.base}/lookups/fuel-types`); }
  create(request: VehicleRequest) { return this.http.post<Vehicle>(`${this.base}/ownvehicles`, request); }
  update(id: number, request: VehicleRequest) { return this.http.put<Vehicle>(`${this.base}/ownvehicles/${id}`, request); }
  delete(id: number) { return this.http.delete<void>(`${this.base}/ownvehicles/${id}`); }
}
