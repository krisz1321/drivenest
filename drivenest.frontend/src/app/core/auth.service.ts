import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, map, tap } from 'rxjs';

import { environment } from '../../environments/environment';
import { LoginRequest, LoginResponse, RegisterRequest, User } from './models/auth.models';

const STORAGE_KEY = 'drivenest.session';

type Session = LoginResponse;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly sessionSubject = new BehaviorSubject<Session | null>(this.loadSession());

  readonly user$: Observable<User | null> = this.sessionSubject.pipe(map(session => session?.user ?? null));
  readonly isLoggedIn$: Observable<boolean> = this.sessionSubject.pipe(map(session => session !== null));

  get token(): string | null {
    const session = this.sessionSubject.value;
    if (session && this.isExpired(session)) {
      this.clearSession();
      return null;
    }

    return session?.token ?? null;
  }

  get isLoggedIn(): boolean {
    return this.token !== null;
  }

  login(request: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/login`, request)
      .pipe(tap(response => this.saveSession(response)));
  }

  register(request: RegisterRequest): Observable<User> {
    return this.http.post<User>(`${environment.apiUrl}/auth/register`, request);
  }

  logout(): void {
    this.clearSession();
    this.router.navigate(['/login']);
  }

  // A szerver módosító kérések után újabb tokent ad (X-Refreshed-Token), ezzel cseréljük a tárolt tokent.
  updateToken(token: string, expiresAtUtc: string): void {
    const session = this.sessionSubject.value;
    if (session) {
      this.saveSession({ ...session, token, expiresAtUtc });
    }
  }

  private isExpired(session: Session): boolean {
    return new Date(session.expiresAtUtc).getTime() <= Date.now();
  }

  private loadSession(): Session | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }

      const session = JSON.parse(raw) as Session;
      if (!session.token || this.isExpired(session)) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }

      return session;
    } catch {
      return null;
    }
  }

  private saveSession(session: Session): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // A munkamenet ilyenkor csak a memóriában marad.
    }

    this.sessionSubject.next(session);
  }

  private clearSession(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nincs teendő, a memóriabeli állapotot úgyis töröljük.
    }

    this.sessionSubject.next(null);
  }
}
