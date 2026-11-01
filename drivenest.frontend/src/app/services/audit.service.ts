import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_BASE_URL } from './auth.service';

export type AuditEntryType = 'vehicle' | 'refueling' | 'service' | 'expense';

// date, summary, amount, liters: csak ott van értékük, ahol a típusnak van ilyen adata
// updatedAt = null, ha a bejegyzést létrehozása óta nem módosították
export interface AuditEntry {
  type: AuditEntryType;
  id: number;
  vehicleId: number;
  licensePlate: string;
  vehicleName: string;
  date: string | null;
  summary: string | null;
  amount: number | null;
  liters: number | null;
  createdAt: string;
  updatedAt: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  // vehicleId: 0 = az összes jármű
  list(vehicleId: number, types: AuditEntryType[]) {
    let params = new HttpParams();
    if (vehicleId) params = params.set('vehicleId', vehicleId);
    types.forEach(type => params = params.append('types', type));
    return this.http.get<AuditEntry[]>(`${this.base}/audit`, { params });
  }
}
