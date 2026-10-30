import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FillUpComponentComponent } from './fill-up-component.component';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

describe('FillUpComponentComponent', () => {
  let component: FillUpComponentComponent;
  let fixture: ComponentFixture<FillUpComponentComponent>;
  let http: HttpTestingController;
  const cars = [
    { id: 4, make: 'Toyota', model: 'Yaris', licensePlate: 'ABC-123', currentKm: 42000 },
    { id: 8, make: 'BMW', model: '320d', licensePlate: 'DEF-456', currentKm: 65000 }
  ];
  const entry = { id: 1, vehicleId: 4, date: '2026-09-23', time: '08:15:00', odometerKm: 42000, liters: 40, totalAmount: 24000, isFullTank: true, createdAt: '2026-09-23T12:00:00Z' };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FillUpComponentComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FillUpComponentComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function load() {
    http.expectOne(req => req.url.endsWith('/ownvehicles')).flush(cars);
    http.expectOne(req => req.url.endsWith('/me')).flush({ displayName: 'Teszt', currency: 'HUF' });
    http.expectOne(req => req.url.endsWith('/vehicles/4/refuelings')).flush([entry]);
    http.expectOne(req => req.url.endsWith('/vehicles/8/refuelings')).flush([{ ...entry, id: 2, vehicleId: 8, date: '2026-09-24' }]);
    http.expectOne(req => req.url.endsWith('/vehicles/4/stats/consumption')).flush({ lastLitersPer100Km: 6.5, averageLitersPer100Km: 6.25, segments: [{}, {}] });
    http.expectOne(req => req.url.endsWith('/vehicles/8/stats/consumption')).flush({ lastLitersPer100Km: null, averageLitersPer100Km: null, segments: [] });
    fixture.detectChanges();
  }

  it('combines all owned vehicle fill-ups with car names and newest first', () => {
    load();
    expect(component.entries.map(e => e.id)).toEqual([2, 1]);
    const text = fixture.nativeElement.querySelector('table').textContent;
    expect(text).toContain('Toyota Yaris');
    expect(text).toContain('ABC-123');
    expect(text).toContain('BMW 320d');
    expect(text).toContain('DEF-456');
    expect(text).toContain('600 Ft/l');
  });

  it('saves a new fill-up for the selected car with the existing API payload', () => {
    load();
    component.open('create');
    fixture.detectChanges();
    expect(component.dialog.nativeElement.open).toBeTrue();
    component.form.setValue({ vehicleId: 8, date: '2026-10-01', time: '14:30', odometerKm: 66000, liters: 50, totalAmount: 30000, isFullTank: false });
    expect(component.unitPrice).toBe(600);
    component.save();
    const request = http.expectOne(req => req.method === 'POST' && req.url.endsWith('/vehicles/8/refuelings'));
    expect(request.request.body).toEqual({ date: '2026-10-01', time: '14:30:00', odometerKm: 66000, liters: 50, totalAmount: 30000, isFullTank: false });
    request.flush({ ...entry, ...request.request.body, id: 3, vehicleId: 8 });
    expect(component.dialog.nativeElement.open).toBeFalse();
    expect(component.entries[0].id).toBe(3);
    // Mentés után a frissült óraállás miatt újratölti a járműveket.
    http.expectOne(req => req.url.endsWith('/ownvehicles')).flush([cars[0], { ...cars[1], currentKm: 66000 }]);
    expect(component.vehicles[1].currentKm).toBe(66000);
    http.expectOne(req => req.url.endsWith('/vehicles/8/stats/consumption')).flush({ lastLitersPer100Km: null, averageLitersPer100Km: null, segments: [] });
  });

  it('shows an empty state without making fill-up requests for an empty garage', () => {
    http.expectOne(req => req.url.endsWith('/ownvehicles')).flush([]);
    http.expectOne(req => req.url.endsWith('/me')).flush({ displayName: 'Teszt', currency: 'HUF' });
    fixture.detectChanges();
    expect(component.entries).toEqual([]);
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
  });

  function input(id: string, value: string) {
    const field: HTMLInputElement = fixture.nativeElement.querySelector('#' + id);
    field.value = value;
    field.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('calculates either price from the last edited field, including litre changes', () => {
    load();
    component.open('create');
    fixture.detectChanges();
    input('fill-price', '658');
    input('fill-liters', '42.8');
    expect(component.form.controls.totalAmount.value).toBe(28162.4);
    input('fill-liters', '40');
    expect(component.form.controls.totalAmount.value).toBe(26320);
    expect(component.unitPrice).toBe(658);
    input('fill-total', '24000');
    expect(component.unitPrice).toBe(600);
    input('fill-liters', '50');
    expect(component.unitPrice).toBe(480);
    expect(component.form.controls.totalAmount.value).toBe(24000);
    input('fill-price', '500.01');
    expect(component.form.controls.totalAmount.value).toBe(25000.5);
  });

  it('initializes editing from the saved total and resets calculation mode for new entries', () => {
    load();
    component.open('edit', entry);
    expect(component.unitPrice).toBe(600);
    component.unitPriceControl.setValue(650);
    component.close();
    component.open('create');
    expect(component.unitPrice).toBe(0);
    expect(component.form.controls.totalAmount.value).toBe(0);
    component.unitPriceControl.setValue(null);
    expect(component.unitPriceControl.invalid).toBeTrue();
    component.unitPriceControl.setValue(600);
    component.form.controls.liters.setValue(0);
    expect(component.form.controls.totalAmount.value).toBe(0);
    expect(Number.isFinite(component.unitPrice)).toBeTrue();
  });

  it('shows a retry state if a vehicle history fails', () => {
    http.expectOne(req => req.url.endsWith('/ownvehicles')).flush([cars[0]]);
    http.expectOne(req => req.url.endsWith('/me')).flush({ displayName: 'Teszt', currency: 'HUF' });
    http.expectOne(req => req.url.endsWith('/vehicles/4/refuelings')).flush({}, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
    expect(component.loading).toBeFalse();
  });
});
