import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { tap } from 'rxjs';
import { API_BASE_URL } from './api-base-url';
import { ProfileService, UserProfile } from './profile.service';

export { API_BASE_URL };

export interface LoginResponse {
  token: string;
  expiresAtUtc: string;
  user: UserProfile;
  roles: string[];
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_BASE_URL);
  private readonly profile = inject(ProfileService);

  get token(): string | null { return sessionStorage.getItem('drivenest.token'); }

  isAuthenticated(): boolean {
    const expires = sessionStorage.getItem('drivenest.expiresAtUtc');
    return !!this.token && !!expires && Date.parse(expires) > Date.now();
  }

  register(displayName: string, email: string, password: string) {
    return this.http.post<UserProfile>(`${this.apiUrl}/auth/register`, {
      displayName, email, password
    });
  }

  login(userNameOrEmail: string, password: string) {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, { userNameOrEmail, password })
      .pipe(tap(response => this.store(response)));
  }

  // A jelszó- és az e-mail-csere új SecurityStamp-et ad, ezért a válasz új tokent hoz, a régi érvénytelen.
  changePassword(currentPassword: string, newPassword: string) {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/change-password`, { currentPassword, newPassword })
      .pipe(tap(response => this.store(response)));
  }

  changeEmail(email: string, currentPassword: string) {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/change-email`, { email, currentPassword })
      .pipe(tap(response => this.store(response)));
  }

  logout() {
    sessionStorage.removeItem('drivenest.token');
    sessionStorage.removeItem('drivenest.expiresAtUtc');
    this.profile.clear();
  }

  // Felhasználói kijelentkezés: helyben azonnal töröl, a szerveren is érvényteleníti a tokent.
  signOut() {
    const token = this.token;
    this.logout();
    if (!token) return;
    this.http.post<void>(`${this.apiUrl}/auth/logout`, {}, { headers: { Authorization: `Bearer ${token}` } })
      .subscribe({ error: () => {} });
  }

  private store(response: LoginResponse) {
    sessionStorage.setItem('drivenest.token', response.token);
    sessionStorage.setItem('drivenest.expiresAtUtc', response.expiresAtUtc);
    this.profile.set(response.user);
  }
}
