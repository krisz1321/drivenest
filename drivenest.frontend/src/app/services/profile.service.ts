import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { tap } from 'rxjs';
import { DEFAULT_PREFERENCES, Preferences } from '../shared/units';
import { API_BASE_URL } from './api-base-url';

export interface UserProfile extends Preferences {
  id: number;
  email: string;
  displayName: string;
}
export type ProfileUpdateRequest = Preferences & { displayName: string };

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  readonly profile = signal<UserProfile | null>(null);
  // A garázskártyák, táblák és űrlapok ebből a signalból dolgoznak, ezért mentés után azonnal frissülnek.
  readonly preferences = computed<Preferences>(() => {
    const profile = this.profile();
    return profile ? {
      currency: profile.currency, distanceUnit: profile.distanceUnit,
      volumeUnit: profile.volumeUnit, consumptionUnit: profile.consumptionUnit
    } : DEFAULT_PREFERENCES;
  });

  load() { return this.http.get<UserProfile>(`${this.base}/me`).pipe(tap(profile => this.profile.set(profile))); }
  update(request: ProfileUpdateRequest) {
    return this.http.put<UserProfile>(`${this.base}/me`, request).pipe(tap(profile => this.profile.set(profile)));
  }
  set(profile: UserProfile) { this.profile.set(profile); }
  clear() { this.profile.set(null); }
}
