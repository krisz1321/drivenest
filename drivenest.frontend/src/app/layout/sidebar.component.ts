import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';

export type NavPage = 'dashboard' | 'history' | 'settings' | 'garage' | 'refuelings' | 'expenses' | 'service' | 'reminders' | 'statistics' | 'audit' | 'more';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink],
  host: { class: 'dashboard-theme' },
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  @Input() active: NavPage = 'dashboard';
  @Input() displayName = 'Saját garázs';
  @Output() signOut = new EventEmitter<void>();
}
