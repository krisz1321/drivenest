import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, tap, throwError } from 'rxjs';
import { API_BASE_URL, AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const base = inject(API_BASE_URL);
  const auth = inject(AuthService);
  const router = inject(Router);
  const isApi = request.url.startsWith(`${base}/`);
  // A logout saját maga küldi a (már helyben törölt) tokent, a 401-e nem jelent lejárt munkamenetet.
  const isAuthFlow = [`${base}/auth/login`, `${base}/auth/register`, `${base}/auth/logout`].includes(request.url);
  if (!isApi || isAuthFlow) return next(request);
  const token = auth.token;
  const authorized = token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;
  return next(authorized).pipe(
    tap(event => {
      if (!(event instanceof HttpResponse) || !token || auth.token !== token) return;
      const renewed = event.headers.get('X-Refreshed-Token');
      const expires = event.headers.get('X-Token-Expires-At');
      if (renewed && expires) {
        sessionStorage.setItem('drivenest.token', renewed);
        sessionStorage.setItem('drivenest.expiresAtUtc', expires);
      }
    }),
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && auth.token === token) {
        auth.logout();
        void router.navigate(['/login'], { queryParams: { expired: '1' } });
      }
      return throwError(() => error);
    })
  );
};
