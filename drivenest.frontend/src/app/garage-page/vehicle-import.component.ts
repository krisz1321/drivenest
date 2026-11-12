import { Component, DestroyRef, ElementRef, EventEmitter, Input, Output, ViewChild, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { Vehicle } from '../services/vehicle.service';
import { DrivvoImportResult, ImportService } from '../services/import.service';

// Drivvo export importálása a jármű oldalán. A gomb a szülőben van, az ablakot az open() nyitja.
@Component({
  selector: 'app-vehicle-import', standalone: true,
  templateUrl: './vehicle-import.component.html', styleUrl: './vehicle-import.component.scss'
})
export class VehicleImportComponent {
  @Input({ required: true }) vehicle!: Vehicle;
  // Sikeres import után jelez, hogy a szülő újratölthesse a listákat.
  @Output() imported = new EventEmitter<void>();
  @ViewChild('importDialog') dialog!: ElementRef<HTMLDialogElement>;
  private readonly api = inject(ImportService);
  private readonly destroyRef = inject(DestroyRef);
  file: File | null = null;
  saving = false;
  error = '';
  result: DrivvoImportResult | null = null;

  open() {
    // Sikeres import után újra a fájlválasztó jön.
    if (this.result) {
      this.result = null;
      this.file = null;
    }
    this.error = '';
    this.dialog.nativeElement.showModal();
  }

  close() { if (!this.saving) this.dialog.nativeElement.close(); }
  cancel(event: Event) { event.preventDefault(); this.close(); }

  selectFile(event: Event) {
    this.file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.error = '';
  }

  upload() {
    if (this.saving || !this.file) return;
    this.saving = true;
    this.error = '';
    this.api.drivvo(this.vehicle.id, this.file)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.saving = false)).subscribe({
        next: result => {
          this.result = result;
          this.imported.emit();
        },
        error: (error: HttpErrorResponse) => this.error = error.status === 400
          ? 'Ezt a fájlt nem sikerült beolvasni. A Drivvo-ból exportált CSV fájlt válaszd ki.'
          : 'Az importálás nem sikerült. Próbáld újra.'
      });
  }
}
