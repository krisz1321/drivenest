import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { ProfileService } from '../services/profile.service';
import { AppShellComponent } from '../layout/app-shell.component';
import { consumptionLabel, currencyLabel, distanceLabel } from '../shared/units';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, AppShellComponent, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  private readonly profile = inject(ProfileService);
  private readonly destroyRef = inject(DestroyRef);
  readonly month = new Date().toLocaleDateString('hu-HU', { month: 'long', timeZone: 'Europe/Budapest' });
  loading = true;
  loadErrors: string[] = [];
  get stats() {
    const { currency, distanceUnit, consumptionUnit } = this.profile.preferences();
    return [
      { label: 'Utolsó fogyasztás', unit: consumptionLabel(consumptionUnit), detail: 'Tele tanktól tele tankig', icon: '◉' },
      { label: 'Havi kiadás', unit: currencyLabel(currency), detail: 'Minden kategória', icon: '↗' },
      { label: 'Kilométerköltség', unit: `${currencyLabel(currency)}/${distanceLabel(distanceUnit)}`, detail: 'A rögzített időszak alapján', icon: '↔' },
      { label: 'Figyelmet igényel', unit: 'teendő', detail: 'Közelgő emlékeztetők', icon: '!' }
    ];
  }
  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.loadErrors = [];
    this.profile.load().pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading = false)).subscribe({
      error: () => this.loadErrors = ['A profil betöltése nem sikerült. Próbáld újra.']
    });
  }


}
