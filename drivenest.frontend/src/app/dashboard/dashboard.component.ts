import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { ProfileService } from '../services/profile.service';
import { AppShellComponent } from '../layout/app-shell.component';
import { currencyLabel, distanceLabel } from '../shared/units';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [AppShellComponent, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  private readonly profile = inject(ProfileService);
  private readonly destroyRef = inject(DestroyRef);

  // Az aktuális hónap neve (pl. "október")
  readonly month = new Date().toLocaleDateString('hu-HU', { month: 'long', timeZone: 'Europe/Budapest' });

  loading = false;
  loadError = '';

  get stats() {
    const { currency, distanceUnit } = this.profile.preferences();
    return [
      { label: 'E havi kiadás', unit: currencyLabel(currency), detail: 'Tankolás, szerviz és egyéb' },
      { label: 'Összes kiadás', unit: currencyLabel(currency), detail: 'Az összes bejegyzés alapján' },
      { label: 'Kilométerköltség', unit: `${currencyLabel(currency)}/${distanceLabel(distanceUnit)}`, detail: 'Az összes kiadás alapján' },
      { label: 'Járművek', unit: 'db', detail: 'A garázsodban' }
    ];
  }

  ngOnInit() {
    this.load();
  }

  load() {
    if (this.loading) return;
    this.loading = true;
    this.loadError = '';

    this.profile.load().pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading = false)
    ).subscribe({
      error: () => this.loadError = 'Az adatokat nem sikerült betölteni. Próbáld újra.'
    });
  }
}
