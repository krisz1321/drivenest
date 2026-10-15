import { HttpClient } from '@angular/common/http';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { tap } from 'rxjs';

// Override this provider when deploying the frontend against another API host.
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root', factory: () => 'https://localhost:7104/api'
});

export interface LoginResponse {
  token: string;
  expiresAtUtc: string;
  user: { id: number; email: string; displayName: string; currency: string };
  roles: string[];
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_BASE_URL);

  register(displayName: string, email: string, password: string) {
    return this.http.post<LoginResponse['user']>(`${this.apiUrl}/auth/register`, {
      displayName, email, password
    });
  }

  login(userNameOrEmail: string, password: string) {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, { userNameOrEmail, password })
      .pipe(tap(response => {
        sessionStorage.setItem('drivenest.token', response.token);
        sessionStorage.setItem('drivenest.expiresAtUtc', response.expiresAtUtc);
      }));
  }

  logout() {
    sessionStorage.removeItem('drivenest.token');
    sessionStorage.removeItem('drivenest.expiresAtUtc');
  }
}
