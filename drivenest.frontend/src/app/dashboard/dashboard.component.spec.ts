import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { Vehicle, VehicleService } from '../services/vehicle.service';
import { DashboardComponent } from './dashboard.component';
import { RefuelingService } from '../services/refueling.service';

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;
  let api: jasmine.SpyObj<VehicleService>;
  let auth: jasmine.SpyObj<AuthService>;
  const vehicle: Vehicle = { id: 1, make: 'Suzuki', model: 'Swift', licensePlate: 'ABC-123', fuelTypeId: 1, vin: null, year: 2020, initialKm: 100, currentKm: 200 };
  beforeEach(async () => {
    api = jasmine.createSpyObj<VehicleService>('VehicleService', ['list', 'fuelTypes', 'create', 'update', 'delete']);
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['me', 'logout']);
    api.list.and.returnValue(of([{ ...vehicle }]));
    api.fuelTypes.and.returnValue(of([{ id: 1, name: 'Benzin' }]));
    auth.me.and.returnValue(of({ id: 1, displayName: 'Demo', email: 'demo@example.com', currency: 'HUF' }));
    await TestBed.configureTestingModule({
      imports: [DashboardComponent], providers: [provideRouter([]),
        { provide: RefuelingService, useValue: { list: () => of([]) } },
        { provide: VehicleService, useValue: api }, { provide: AuthService, useValue: auth }]
    }).compileComponents();
    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });
  afterEach(() => component.dialog.nativeElement.close());

  it('loads actual account, cars, fuel types, and marks unavailable sections', () => {
    expect(component.vehicles[0].licensePlate).toBe('ABC-123');
    expect(component.displayName).toBe('Demo');
    expect(fixture.nativeElement.querySelector('.vehicle-banner').textContent).toContain('Suzuki Swift');
    expect(fixture.nativeElement.querySelectorAll('.car-quick-actions button[disabled]').length).toBe(2);
    expect(fixture.nativeElement.querySelectorAll('.stat-card').length).toBe(4);
  });
  it('shows an empty garage without fabricated cars', () => {
    api.list.and.returnValue(of([]));
    component.load();
    fixture.detectChanges();
    expect(component.vehicles).toEqual([]);
    expect(fixture.nativeElement.querySelector('#vehicle').textContent).toContain('első járművedet');
  });
  it('creates a car through the API and adds its own card', () => {
    api.create.and.returnValue(of({ ...vehicle, id: 2, licensePlate: 'NEW-123' }));
    component.open('create');
    component.form.patchValue({ make: ' Suzuki ', model: 'Swift', licensePlate: 'new-123', initialKm: 10, currentKm: 20 });
    component.save();
    expect(api.create).toHaveBeenCalledWith(jasmine.objectContaining({ make: 'Suzuki', licensePlate: 'NEW-123', vin: null, year: null }));
    expect(component.vehicles.some(v => v.id === 2)).toBeTrue();
    expect(component.vehicles.length).toBe(2);
    expect(component.dialog.nativeElement.open).toBeFalse();
  });
  it('rejects decreasing mileage, invalid VIN, and fractional mileage without API calls', () => {
    component.open('edit', vehicle);
    component.form.patchValue({ currentKm: 99 });
    component.save();
    expect(api.update).not.toHaveBeenCalled();
    component.form.patchValue({ currentKm: 200, vin: 'short' });
    component.save();
    expect(api.update).not.toHaveBeenCalled();
    component.form.patchValue({ vin: '', currentKm: 200.5 });
    component.save();
    expect(api.update).not.toHaveBeenCalled();
  });
  it('updates the selected vehicle through the own-vehicle API', () => {
    api.update.and.returnValue(of({ ...vehicle, currentKm: 350 }));
    component.open('edit', vehicle);
    component.form.controls.currentKm.setValue(350);
    component.save();
    expect(api.update).toHaveBeenCalledWith(1, jasmine.objectContaining({ currentKm: 350 }));
    expect(component.vehicles[0].currentKm).toBe(350);
    expect(component.vehicles.length).toBe(1);
  });
  it('shows duplicate-plate validation without closing the dialog', () => {
    api.update.and.returnValue(throwError(() => new HttpErrorResponse({ status: 400, error: { errors: { LicensePlate: ['Duplicate plate'] } } })));
    component.open('edit', vehicle);
    component.save();
    expect(component.modalErrors).toEqual(['Duplicate plate']);
    expect(component.dialog.nativeElement.open).toBeTrue();
    expect(component.saving).toBeFalse();
  });
  it('requires a confirmation action to delete and preserves a car on conflict', () => {
    api.delete.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    component.open('delete', vehicle);
    expect(api.delete).not.toHaveBeenCalled();
    component.remove();
    expect(component.vehicles.length).toBe(1);
    expect(component.modalErrors[0]).toContain('kapcsolódó');
    expect(component.dialog.nativeElement.open).toBeTrue();
  });
  it('removes the car only after successful server deletion', () => {
    api.delete.and.returnValue(of(undefined));
    component.open('delete', vehicle);
    component.remove();
    expect(api.delete).toHaveBeenCalledWith(1);
    expect(component.vehicles).toEqual([]);
    expect(fixture.componentInstance.vehicles.length).toBe(0);
  });
  it('keeps an API failure visible and supports retry', () => {
    api.list.and.returnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    component.load();
    expect(component.loadErrors.length).toBe(1);
    expect(component.loading).toBeFalse();
    api.list.and.returnValue(of([{ ...vehicle }]));
    component.load();
    expect(component.loadErrors).toEqual([]);
  });
  it('lists every car with its own quick actions and no vehicle selector', () => {
    api.list.and.returnValue(of([{ ...vehicle }, { ...vehicle, id: 2, licensePlate: 'DEF-456' }]));
    component.load();
    fixture.detectChanges();
    const cards: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.vehicle-card'));
    expect(cards.length).toBe(2);
    expect(cards[0].querySelector('.car-quick-actions button')?.getAttribute('aria-label')).toContain('ABC-123');
    expect(cards[1].querySelector('.car-quick-actions button')?.getAttribute('aria-label')).toContain('DEF-456');
    expect(fixture.nativeElement.querySelector('.vehicle-select')).toBeNull();
    expect(fixture.nativeElement.querySelector('.quick-panel')).toBeNull();
  });
});
