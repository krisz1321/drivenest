import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn) {
    return true;
  }

  const queryParams = state.url !== '/' ? { returnUrl: state.url } : {};

  return router.createUrlTree(['/login'], { queryParams });
};
