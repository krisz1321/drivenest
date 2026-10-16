import { InjectionToken } from '@angular/core';

// Override this provider when deploying the frontend against another API host.
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root', factory: () => 'https://localhost:7104/api'
});
