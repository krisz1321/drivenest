import { Component, DestroyRef, Input, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, of, switchMap } from 'rxjs';
import { NavPage, SidebarComponent } from './sidebar.component';
import { AuthService } from '../services/auth.service';
import { ProfileService } from '../services/profile.service';
import { Vehicle, VehicleService } from '../services/vehicle.service';
import { SelectedVehicleService } from '../services/selected-vehicle.service';
import { ServiceRecordService } from '../services/service-record.service';
import { ServiceBookPdfService } from '../services/service-book-pdf.service';
import { currencyLabel, distanceLabel, toDistance } from '../shared/units';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [SidebarComponent, RouterLink],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss'
})
export class AppShellComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly profile = inject(ProfileService);
  private readonly vehicleApi = inject(VehicleService);
  private readonly selected = inject(SelectedVehicleService);
  private readonly serviceApi = inject(ServiceRecordService);
  private readonly pdf = inject(ServiceBookPdfService);
  private readonly destroyRef = inject(DestroyRef);
  @Input() active: NavPage = 'dashboard';
  @Input() section = 'Vezérlőpult';
  readonly dateLabel = new Date().toLocaleDateString('hu-HU', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Europe/Budapest'
  });

  // A mobil fejléc autóválasztója
  vehicles: Vehicle[] = [];
  loaded = false;
  pickerOpen = false;
  pdfLoading = false;
  pdfError = '';

  get displayName() { return this.profile.profile()?.displayName || 'Saját garázs'; }
  get vehicle() { return this.vehicles.find(v => v.id === this.selected.vehicleId()) ?? null; }
  // Ami nem fért a fülsávra, az a Több fül alá tartozik.
  get moreActive() { return !['history', 'statistics', 'reminders'].includes(this.active); }

  ngOnInit() {
    this.vehicleApi.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: vehicles => {
        this.vehicles = vehicles;
        this.selected.pick(vehicles);
        this.loaded = true;
      },
      error: () => this.loaded = true
    });
  }

  km(car: Vehicle) {
    const unit = this.profile.preferences().distanceUnit;
    return `${toDistance(car.currentKm, unit).toLocaleString('hu-HU')} ${distanceLabel(unit)}`;
  }

  choose(car: Vehicle) {
    this.selected.select(car.id);
    this.pickerOpen = false;
  }

  downloadBook(car: Vehicle) {
    if (this.pdfLoading) return;
    this.pdfLoading = true;
    this.pdfError = '';
    const unit = currencyLabel(this.profile.preferences().currency);
    // Üres szervizkönyvnél nem készül PDF, csak üzenet.
    this.serviceApi.book(car.id).pipe(
      switchMap(book => book.entries.length ? this.pdf.generate(book, unit).then(() => true) : of(false)),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.pdfLoading = false)
    ).subscribe({
      next: done => { if (!done) this.pdfError = 'Ehhez az autóhoz még nincs szerviz, ezért nem készíthető szervizkönyv.'; },
      error: () => this.pdfError = 'A szervizkönyvet nem sikerült elkészíteni. Próbáld újra.'
    });
  }

  signOut() { this.auth.signOut(); void this.router.navigateByUrl('/login'); }
}
