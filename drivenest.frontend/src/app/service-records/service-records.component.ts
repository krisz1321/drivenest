import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, map, of, switchMap } from 'rxjs';
import { AppShellComponent } from '../layout/app-shell.component';
import { Vehicle, VehicleService } from '../services/vehicle.service';
import { ServiceRecord, ServiceRecordService } from '../services/service-record.service';

@Component({
  selector: 'app-service-records',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AppShellComponent],
  templateUrl: './service-records.component.html',
  styleUrl: './service-records.component.scss'
})
export class ServiceRecordsComponent implements OnInit {
  private readonly vehicleApi = inject(VehicleService);
  private readonly api = inject(ServiceRecordService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly selection = new Subject<number>();

  vehicles: Vehicle[] = [];
  entries: ServiceRecord[] = [];
  vehicleId = 0;
  showTimestamps = true;
  loading = true;
  error = '';

  get selectedVehicle() {
    return this.vehicles.find(car => car.id === this.vehicleId);
  }

  ngOnInit() {
    // Autóváltáskor az előző kérés eredményét már nem használjuk.
    this.selection.pipe(
      switchMap(id => this.api.list(id).pipe(
        map(entries => ({ entries, error: '' })),
        catchError(() => of({ entries: [] as ServiceRecord[], error: 'A szervizbejegyzéseket nem sikerült betölteni.' }))
      )),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(result => {
      this.entries = [...result.entries].sort((a, b) =>
        b.date.localeCompare(a.date) || b.odometerKm - a.odometerKm || b.id - a.id);
      this.error = result.error;
      this.loading = false;
    });
    this.loadVehicles();
  }

  loadVehicles() {
    this.loading = true;
    this.error = '';
    this.vehicleApi.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: vehicles => {
        this.vehicles = vehicles;
        this.vehicleId = vehicles[0]?.id ?? 0;
        if (this.vehicleId) this.loadRecords();
        else this.loading = false;
      },
      error: () => {
        this.error = 'A járműveket nem sikerült betölteni.';
        this.loading = false;
      }
    });
  }

  loadRecords() {
    if (!this.vehicleId) return;
    this.loading = true;
    this.error = '';
    this.entries = [];
    this.selection.next(this.vehicleId);
  }

  retry() {
    if (this.vehicles.length) this.loadRecords();
    else this.loadVehicles();
  }

  number(value: number) {
    return value.toLocaleString('hu-HU', { maximumFractionDigits: 2 });
  }

  timestamp(value: string) {
    return new Date(value).toLocaleString('sv-SE', { timeZone: 'Europe/Budapest' }).slice(0, 16);
  }

  print() {
    window.print();
  }
}
