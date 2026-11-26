import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AppShellComponent } from '../layout/app-shell.component';
import { AuthService } from '../services/auth.service';
import { ProfileService } from '../services/profile.service';

// Telefonon a fülsáv Több füle: ami nem fért a fülsávra.
@Component({
  selector: 'app-more-page',
  standalone: true,
  imports: [AppShellComponent, RouterLink],
  templateUrl: './more-page.component.html',
  styleUrl: './more-page.component.scss'
})
export class MorePageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly profile = inject(ProfileService);

  get displayName() { return this.profile.profile()?.displayName || 'Saját garázs'; }

  signOut() { this.auth.signOut(); void this.router.navigateByUrl('/login'); }
}
