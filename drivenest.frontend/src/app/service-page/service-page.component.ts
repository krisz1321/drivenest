import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppShellComponent } from '../layout/app-shell.component';

@Component({
  selector: 'app-service-page',
  standalone: true,
  imports: [CommonModule, AppShellComponent],
  templateUrl: './service-page.component.html',
  styleUrl: './service-page.component.scss'
})
export class ServicePageComponent {
}
