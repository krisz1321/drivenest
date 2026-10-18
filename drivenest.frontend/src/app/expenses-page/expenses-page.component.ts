import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppShellComponent } from '../layout/app-shell.component';

@Component({
  selector: 'app-expenses-page',
  standalone: true,
  imports: [CommonModule, AppShellComponent],
  templateUrl: './expenses-page.component.html',
  styleUrl: './expenses-page.component.scss'
})
export class ExpensesPageComponent {
}
