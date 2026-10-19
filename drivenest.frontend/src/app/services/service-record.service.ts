import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_BASE_URL } from './auth.service';

export interface ServiceRecordRequest {
  date: string;
  categoryId: number;
  odometerKm: number;
  amount: number;
  provider: string | null;
  description: string | null;
}

export interface ServiceRecord extends ServiceRecordRequest {
  id: number;
  vehicleId: number;
  categoryName: string;
  createdAt: string;
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
