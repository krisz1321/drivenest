import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_BASE_URL } from './auth.service';

export interface ServiceRecord {
  id: number;
  vehicleId: number;
  categoryId: number;
  categoryName: string;
  date: string;
  odometerKm: number;
  provider: string | null;
  description: string | null;
  partsCost: number;
  laborCost: number;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class ServiceRecordService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  list(vehicleId: number) {
    return this.http.get<ServiceRecord[]>(`${this.base}/vehicles/${vehicleId}/service-records`);
  }
}
