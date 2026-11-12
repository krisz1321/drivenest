import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_BASE_URL } from './auth.service';

// skipped = kihagyott bejegyzések (már megvoltak, vagy hibás volt a sor)
export interface DrivvoImportResult {
  refuelings: number;
  expenses: number;
  services: number;
  skipped: number;
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
}
