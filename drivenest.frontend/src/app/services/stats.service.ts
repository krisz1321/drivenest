import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_BASE_URL } from './auth.service';

export interface ConsumptionSegment {
  startRefuelingId: number;
  endRefuelingId: number;
  startDate: string;
  endDate: string;
  distanceKm: number;
  liters: number;
  litersPer100Km: number;
}

export interface Consumption {
  lastLitersPer100Km: number | null;
  averageLitersPer100Km: number | null;
  segments: ConsumptionSegment[];
}

@Injectable({ providedIn: 'root' })
export class StatsService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  consumption(vehicleId: number) { return this.http.get<Consumption>(`${this.base}/vehicles/${vehicleId}/stats/consumption`); }
}
