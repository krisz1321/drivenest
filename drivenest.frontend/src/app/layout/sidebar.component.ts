import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink],
  host: { class: 'dashboard-theme' },
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  @Input() active: 'dashboard' | 'settings' | 'garage' = 'dashboard';
  @Input() displayName = 'Saját garázs';
  @Output() signOut = new EventEmitter<void>();
}
