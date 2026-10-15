import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';

import { environment } from '../../environments/environment';
import { AuthService } from '../core/auth.service';
import { User } from '../core/models/auth.models';

// Ideiglenes kezdőlap: a layout (S1-04) elkészültéig ez a belépés célja.
@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  standalone: false
})
export class HomeComponent implements OnInit {
  private readonly http = inject(HttpClient);

  readonly auth = inject(AuthService);

  me: User | null = null;

  ngOnInit(): void {
    if (this.auth.isLoggedIn) {
      // A 401-et (lejárt token) az interceptor kezeli, itt nincs további teendő.
      this.http.get<User>(`${environment.apiUrl}/me`).subscribe({
        next: me => (this.me = me),
        error: () => undefined
      });
    }
  }
}
