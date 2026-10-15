import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';
import { VehicleRefuelingsComponent } from './vehicle-refuelings.component';
import { Refueling, RefuelingService } from '../services/refueling.service';

describe('VehicleRefuelingsComponent', () => {
  let fixture: ComponentFixture<VehicleRefuelingsComponent>;
  let component: VehicleRefuelingsComponent;
  let api: jasmine.SpyObj<RefuelingService>;
  const vehicle = { id: 2, make: 'Suzuki', model: 'Swift', licensePlate: 'DEF-456', fuelTypeId: 1, vin: null, year: 2020, initialKm: 50, currentKm: 200 };
  const entry: Refueling = { id: 10, vehicleId: 2, date: '2026-10-15', odometerKm: 100, liters: 12.345, totalAmount: 1200.50, isFullTank: false, createdAt: '2026-10-15T12:00:00Z' };
  beforeEach(async () => {
    api = jasmine.createSpyObj<RefuelingService>('RefuelingService', ['list', 'create', 'update', 'delete']);
    api.list.and.returnValue(of([{ ...entry }]));
    await TestBed.configureTestingModule({ imports: [VehicleRefuelingsComponent], providers: [{ provide: RefuelingService, useValue: api }] }).compileComponents();
    fixture = TestBed.createComponent(VehicleRefuelingsComponent);
    fixture.componentRef.setInput('vehicle', { ...vehicle });
    component = fixture.componentInstance;
    fixture.detectChanges();
  });
  afterEach(() => component.dialog.nativeElement.close());
  function fill() { component.form.setValue({ date: '2026-10-15', odometerKm: 100, liters: 12.345, totalAmount: 1200.50, isFullTank: false }); }
  it('loads history for its own car and keeps the car named in the dialog', () => {
    expect(api.list).toHaveBeenCalledWith(2);
    component.open('create'); fixture.detectChanges();
    expect(component.dialog.nativeElement.textContent).toContain('DEF-456');
    expect(component.form.controls.odometerKm.value).toBe(200);
  });
  it('creates a historical partial-tank refueling only for this car', () => {
    api.create.and.returnValue(of({ ...entry, id: 11 }));
    component.open('create'); fill(); component.save();
    expect(api.create).toHaveBeenCalledWith(2, jasmine.objectContaining({ odometerKm: 100, isFullTank: false }));
    expect(component.entries.length).toBe(2);
    expect(component.vehicle.currentKm).toBe(200);
    expect(component.dialog.nativeElement.open).toBeFalse();
  });
  it('rejects excessive precision, invalid date, negative values, and fractional mileage', () => {
    component.open('create'); fill();
    component.form.controls.liters.setValue(1.2345); component.save(); expect(api.create).not.toHaveBeenCalled();
    fill(); component.form.controls.totalAmount.setValue(1.234); component.save(); expect(api.create).not.toHaveBeenCalled();
    fill(); component.form.controls.date.setValue('2026-02-31'); component.save(); expect(api.create).not.toHaveBeenCalled();
    fill(); component.form.controls.odometerKm.setValue(1.5); component.save(); expect(api.create).not.toHaveBeenCalled();
    fill(); component.form.controls.totalAmount.setValue(-1); component.save(); expect(api.create).not.toHaveBeenCalled();
  });
  it('updates a refueling with the vehicle and record IDs', () => {
    api.update.and.returnValue(of({ ...entry, liters: 20 }));
    component.open('edit', entry); component.form.controls.liters.setValue(20); component.save();
    expect(api.update).toHaveBeenCalledWith(2, 10, jasmine.objectContaining({ liters: 20 }));
    expect(component.entries[0].liters).toBe(20);
  });
  it('does not open another car’s refueling', () => {
    component.open('edit', { ...entry, vehicleId: 3 });
    expect(component.dialog.nativeElement.open).toBeFalse();
    expect(api.update).not.toHaveBeenCalled();
  });
  it('requires confirmation and removes a record only after server success', () => {
    api.delete.and.returnValue(of(undefined));
    component.open('delete', entry); expect(api.delete).not.toHaveBeenCalled();
    component.remove(); expect(api.delete).toHaveBeenCalledWith(2, 10);
    expect(component.entries).toEqual([]);
  });
  it('retains data and displays a backend error after a failed delete', () => {
    api.delete.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    component.open('delete', entry); component.remove();
    expect(component.entries.length).toBe(1); expect(component.errors.length).toBe(1);
    expect(component.dialog.nativeElement.open).toBeTrue(); expect(component.saving).toBeFalse();
  });
  it('shows server field validation without losing the entered values', () => {
    api.create.and.returnValue(throwError(() => new HttpErrorResponse({ status: 400, error: { errors: { Liters: ['Invalid liters'] } } })));
    component.open('create'); fill(); component.save();
    expect(component.errors).toEqual(['Invalid liters']); expect(component.form.controls.liters.value).toBe(12.345);
  });
  it('supports retry after a failed history request', () => {
    api.list.and.returnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    component.load(); expect(component.loadError).toBeTruthy();
    api.list.and.returnValue(of([])); component.load();
    expect(component.loadError).toBe(''); expect(component.entries).toEqual([]);
  });
  it('prevents duplicate writes while saving', () => {
    const pending = new Subject<Refueling>(); api.create.and.returnValue(pending);
    component.open('create'); fill(); component.save(); component.save();
    expect(api.create).toHaveBeenCalledTimes(1);
    pending.next({ ...entry, id: 11 }); pending.complete(); expect(component.saving).toBeFalse();
  });
});
