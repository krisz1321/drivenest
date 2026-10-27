import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_BASE_URL } from './auth.service';
import { DistanceUnit, distanceLabel, toDistance } from '../shared/units';

export interface ReminderRequest {
  title: string;
  dueDate: string | null;
  dueOdometerKm: number | null;
  intervalMonths: number | null;
  intervalKm: number | null;
}

export interface Reminder extends ReminderRequest {
  id: number;
  vehicleId: number;
}

// Ennyi napon / km-en belül számít "hamarosan" esedékesnek egy emlékeztető.
export const WARNING_DAYS = 30;
export const WARNING_KM = 1000;

export type ReminderStatus = 'overdue' | 'soon' | 'ok';

// Hány nap van hátra a megadott napig (negatív, ha már elmúlt).
export function daysUntil(date: string) {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Budapest' });
  return Math.round((Date.parse(date) - Date.parse(today)) / 86400000);
}

// Piros: lejárt, sárga: hamarosan, zöld: rendben. A dátum és a km közül a sürgősebb számít.
export function reminderStatus(reminder: Reminder, currentKm: number): ReminderStatus {
  const days = reminder.dueDate ? daysUntil(reminder.dueDate) : null;
  const km = reminder.dueOdometerKm !== null ? reminder.dueOdometerKm - currentKm : null;

  if ((days !== null && days < 0) || (km !== null && km <= 0)) return 'overdue';
  if ((days !== null && days <= WARNING_DAYS) || (km !== null && km <= WARNING_KM)) return 'soon';
  return 'ok';
}

// Pl. "12 nap múlva · 800 km múlva" vagy "Lejárt 3 napja" (a km a választott mértékegységben)
export function remainingText(reminder: Reminder, currentKm: number, unit: DistanceUnit) {
  const distance = (km: number) => `${toDistance(km, unit).toLocaleString('hu-HU')} ${distanceLabel(unit)}`;
  const parts: string[] = [];
  if (reminder.dueDate) {
    const days = daysUntil(reminder.dueDate);
    parts.push(days < 0 ? `Lejárt ${-days} napja` : days === 0 ? 'Ma esedékes' : `${days} nap múlva`);
  }
  if (reminder.dueOdometerKm !== null) {
    const left = reminder.dueOdometerKm - currentKm;
    parts.push(left <= 0 ? `Túllépve: ${distance(-left)}` : `${distance(left)} múlva`);
  }
  return parts.join(' · ');
}

@Injectable({ providedIn: 'root' })
export class ReminderService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  private url(vehicleId: number) {
    return `${this.base}/vehicles/${vehicleId}/reminders`;
  }

  list(vehicleId: number) {
    return this.http.get<Reminder[]>(this.url(vehicleId));
  }

  create(vehicleId: number, body: ReminderRequest) {
    return this.http.post<Reminder>(this.url(vehicleId), body);
  }

  update(vehicleId: number, id: number, body: ReminderRequest) {
    return this.http.put<Reminder>(`${this.url(vehicleId)}/${id}`, body);
  }

  delete(vehicleId: number, id: number) {
    return this.http.delete<void>(`${this.url(vehicleId)}/${id}`);
  }

  // Elvégezve: ismétlődő emlékeztetőnél a szerver kiszámolja a következő esedékességet.
  complete(vehicleId: number, id: number) {
    return this.http.post<Reminder>(`${this.url(vehicleId)}/${id}/complete`, null);
  }
}
