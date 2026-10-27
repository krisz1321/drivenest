import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_BASE_URL } from './auth.service';

export interface ExpenseRequest {
  date: string;
  categoryId: number;
  odometerKm: number;
  amount: number;
  location: string | null;
  description: string | null;
}

export interface Expense extends ExpenseRequest {
  id: number;
  vehicleId: number;
  categoryName: string;
  createdAt: string;
}

// isCustom = a felhasználó saját kategóriája (ezek felvétele egy későbbi feladat)
export interface ExpenseCategory {
  id: number;
  name: string;
  isCustom: boolean;
}

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  private url(vehicleId: number) {
    return `${this.base}/vehicles/${vehicleId}/expenses`;
  }

  list(vehicleId: number) {
    return this.http.get<Expense[]>(this.url(vehicleId));
  }

  create(vehicleId: number, body: ExpenseRequest) {
    return this.http.post<Expense>(this.url(vehicleId), body);
  }

  update(vehicleId: number, id: number, body: ExpenseRequest) {
    return this.http.put<Expense>(`${this.url(vehicleId)}/${id}`, body);
  }

  delete(vehicleId: number, id: number) {
    return this.http.delete<void>(`${this.url(vehicleId)}/${id}`);
  }

  categories() {
    return this.http.get<ExpenseCategory[]>(`${this.base}/expense-categories`);
  }
}
