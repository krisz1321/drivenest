import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_BASE_URL } from './auth.service';

export type AuditEntryType = 'vehicle' | 'refueling' | 'service' | 'expense';
export type AuditAction = 'added' | 'updated' | 'deleted';

// date, summary, amount, liters: csak ott van értékük, ahol a típusnak van ilyen adata
// updatedAt = null, ha a bejegyzést létrehozása óta nem módosították
// deletedAt: csak a 7 napon belül törölt bejegyzésnél van értéke
// importSource = 'drivvo', ha importból jött, ilyenkor a createdAt az importálás ideje
export interface AuditEntry {
  type: AuditEntryType;
  id: number;
  vehicleId: number;
  licensePlate: string;
  vehicleName: string;
  date: string | null;
  importSource: string | null;
  summary: string | null;
  amount: number | null;
  liters: number | null;
  createdAt: string;
  updatedAt: string | null;
  deletedAt: string | null;
}

// Szerviz tételnél a field "item:<típus neve>". oldValue = null: új tétel, newValue = null: törölt adat
export interface AuditChangeField {
  field: string;
  oldValue: string | null;
  newValue: string | null;
}

// daysLate: csak az utólag hozzáadott bejegyzésnél van értéke
export interface AuditChange {
  action: AuditAction;
  type: AuditEntryType;
  entityId: number;
  vehicleId: number;
  licensePlate: string;
  vehicleName: string;
  date: string | null;
  summary: string | null;
  amount: number | null;
  liters: number | null;
  changedAt: string;
  daysLate: number | null;
  changes: AuditChangeField[];
  importSource: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  // vehicleId: 0 = az összes jármű
  private params(vehicleId: number, types: AuditEntryType[]) {
    let params = new HttpParams();
    if (vehicleId) params = params.set('vehicleId', vehicleId);
    types.forEach(type => params = params.append('types', type));
    return params;
  }

  list(vehicleId: number, types: AuditEntryType[]) {
    return this.http.get<AuditEntry[]>(`${this.base}/audit`, { params: this.params(vehicleId, types) });
  }

  changes(vehicleId: number, types: AuditEntryType[], actions: AuditAction[]) {
    let params = this.params(vehicleId, types);
    actions.forEach(action => params = params.append('actions', action));
    return this.http.get<AuditChange[]>(`${this.base}/audit/changes`, { params });
  }
}
