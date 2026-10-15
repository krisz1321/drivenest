import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';

import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

const REFRESHED_TOKEN_HEADER = 'X-Refreshed-Token';
const TOKEN_EXPIRES_AT_HEADER = 'X-Token-Expires-At';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }

  const auth = inject(AuthService);
  const router = inject(Router);

  const token = auth.token;
  const request = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(request).pipe(
    tap({
      next: event => {
        if (event instanceof HttpResponse) {
          const refreshedToken = event.headers.get(REFRESHED_TOKEN_HEADER);
          const expiresAt = event.headers.get(TOKEN_EXPIRES_AT_HEADER);
          if (refreshedToken && expiresAt) {
            auth.updateToken(refreshedToken, expiresAt);
          }
        }
      },
      error: (error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 401 && !isCredentialsRequest(req.url)) {
          auth.logout(router.url);
        }
      }
    })
  );
};

// A belépés és a regisztráció 401-e hibás adatot jelent, nem lejárt munkamenetet.
function isCredentialsRequest(url: string): boolean {
  return url.startsWith(`${environment.apiUrl}/auth/login`) || url.startsWith(`${environment.apiUrl}/auth/register`);
}
