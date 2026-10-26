import { Component, Input, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SidebarComponent } from './sidebar.component';
import { AuthService } from '../services/auth.service';
import { ProfileService } from '../services/profile.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [SidebarComponent],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss'
})
export class AppShellComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly profile = inject(ProfileService);
  @Input() active: 'dashboard' | 'settings' | 'garage' | 'refuelings' | 'expenses' | 'service' | 'reminders' = 'dashboard';
  @Input() section = 'Vezérlőpult';
  readonly dateLabel = new Date().toLocaleDateString('hu-HU', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Europe/Budapest'
  });

  get displayName() { return this.profile.profile()?.displayName || 'Saját garázs'; }

  signOut() { this.auth.signOut(); void this.router.navigateByUrl('/login'); }
}
