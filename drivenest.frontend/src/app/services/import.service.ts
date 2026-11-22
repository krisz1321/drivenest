import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_BASE_URL } from './auth.service';
import type { VehicleRequest } from './vehicle.service';

// skipped = kihagyott bejegyzések (már megvoltak, vagy hibás volt a sor)
export interface DrivvoImportResult {
  refuelings: number;
  expenses: number;
  services: number;
  skipped: number;
}

export interface DrivvoImportPreview {
  fuelTypeId: number | null;
  maxOdometerKm: number | null;
}

export interface DrivvoVehicleImportResult {
  vehicleId: number;
  importResult: DrivvoImportResult;
}

@Injectable({ providedIn: 'root' })
export class ImportService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  // A Drivvo-ból exportált CSV fájl feltöltése egy járműhöz
  drivvo(vehicleId: number, file: File) {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<DrivvoImportResult>(`${this.base}/vehicles/${vehicleId}/import/drivvo`, body);
  }

  previewDrivvo(file: File) {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<DrivvoImportPreview>(`${this.base}/vehicles/import/drivvo/preview`, body);
  }

  drivvoWithVehicle(file: File, request: VehicleRequest) {
    const body = new FormData();
    body.append('file', file);
    for (const [field, value] of Object.entries(request)) {
      if (value !== null) body.append(field, String(value));
    }
    return this.http.post<DrivvoVehicleImportResult>(`${this.base}/vehicles/import/drivvo`, body);
  }
}
