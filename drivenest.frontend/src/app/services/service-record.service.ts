import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_BASE_URL } from './auth.service';

// Egy szerviz tétele: típus + összeg
export interface ServiceRecordItemRequest {
  categoryId: number;
  amount: number;
}

export interface ServiceRecordItem extends ServiceRecordItemRequest {
  categoryName: string;
}

export interface ServiceRecordRequest {
  date: string;
  odometerKm: number;
  provider: string | null;
  description: string | null;
  items: ServiceRecordItemRequest[];
}

// total = a tételek összege (a backend számolja)
export interface ServiceRecord {
  id: number;
  vehicleId: number;
  date: string;
  odometerKm: number;
  total: number;
  provider: string | null;
  description: string | null;
  createdAt: string;
  items: ServiceRecordItem[];
}

// isCustom = a felhasználó saját szerviztípusa (ezek felvétele egy későbbi feladat)
export interface ServiceCategory {
  id: number;
  name: string;
  isCustom: boolean;
}

@Injectable({ providedIn: 'root' })
export class ServiceRecordService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  private url(vehicleId: number) {
    return `${this.base}/vehicles/${vehicleId}/service-records`;
  }

  list(vehicleId: number) {
    return this.http.get<ServiceRecord[]>(this.url(vehicleId));
  }

  create(vehicleId: number, body: ServiceRecordRequest) {
    return this.http.post<ServiceRecord>(this.url(vehicleId), body);
  }

  update(vehicleId: number, id: number, body: ServiceRecordRequest) {
    return this.http.put<ServiceRecord>(`${this.url(vehicleId)}/${id}`, body);
  }

  delete(vehicleId: number, id: number) {
    return this.http.delete<void>(`${this.url(vehicleId)}/${id}`);
  }

  categories() {
    return this.http.get<ServiceCategory[]>(`${this.base}/service-categories`);
  }
}
