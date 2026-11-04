import { HttpClient, HttpParams } from '@angular/common/http';
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

export interface StatsSummary {
  from: string | null;
  to: string;
  days: number;
  totalCost: number;
  refuelingCost: number;
  serviceCost: number;
  expenseCost: number;
  distanceKm: number;
  costPerDay: number | null;
  costPerKm: number | null;
  kmPerDay: number | null;
  refuelingCount: number;
  totalLiters: number;
  averagePricePerLiter: number | null;
  averageLiters: number | null;
  averageRefuelingCost: number | null;
  averageLitersPer100Km: number | null;
  bestLitersPer100Km: number | null;
  worstLitersPer100Km: number | null;
  lastLitersPer100Km: number | null;
}

@Injectable({ providedIn: 'root' })
export class StatsService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  consumption(vehicleId: number) { return this.http.get<Consumption>(`${this.base}/vehicles/${vehicleId}/stats/consumption`); }

  summary(vehicleId: number, from?: string, to?: string) {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return this.http.get<StatsSummary>(`${this.base}/vehicles/${vehicleId}/stats/summary`, { params });
  }
}
