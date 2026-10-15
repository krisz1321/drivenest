import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_BASE_URL } from './auth.service';

export interface RefuelingRequest {
  date: string;
  odometerKm: number;
  liters: number;
  totalAmount: number;
  isFullTank: boolean;
}
export interface Refueling extends RefuelingRequest { id: number; vehicleId: number; createdAt: string; }

@Injectable({ providedIn: 'root' })
export class RefuelingService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  private url(vehicleId: number) { return `${this.base}/vehicles/${vehicleId}/refuelings`; }
  list(vehicleId: number) { return this.http.get<Refueling[]>(this.url(vehicleId)); }
  create(vehicleId: number, body: RefuelingRequest) { return this.http.post<Refueling>(this.url(vehicleId), body); }
  update(vehicleId: number, id: number, body: RefuelingRequest) { return this.http.put<Refueling>(`${this.url(vehicleId)}/${id}`, body); }
  delete(vehicleId: number, id: number) { return this.http.delete<void>(`${this.url(vehicleId)}/${id}`); }
}
