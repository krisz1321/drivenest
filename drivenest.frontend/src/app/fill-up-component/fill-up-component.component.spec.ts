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
  const entry = { id: 1, vehicleId: 4, date: '2026-09-23', odometerKm: 42000, liters: 40, totalAmount: 24000, isFullTank: true, createdAt: '2026-09-23T12:00:00Z' };

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
    component.form.setValue({ vehicleId: 8, date: '2026-10-01', odometerKm: 66000, liters: 50, totalAmount: 30000, isFullTank: false });
    expect(component.unitPrice).toBe(600);
    component.save();
    const request = http.expectOne(req => req.method === 'POST' && req.url.endsWith('/vehicles/8/refuelings'));
    expect(request.request.body).toEqual({ date: '2026-10-01', odometerKm: 66000, liters: 50, totalAmount: 30000, isFullTank: false });
    request.flush({ ...entry, ...request.request.body, id: 3, vehicleId: 8 });
    expect(component.dialog.nativeElement.open).toBeFalse();
    expect(component.entries[0].id).toBe(3);
  });

  it('shows an empty state without making fill-up requests for an empty garage', () => {
    http.expectOne(req => req.url.endsWith('/ownvehicles')).flush([]);
    http.expectOne(req => req.url.endsWith('/me')).flush({ displayName: 'Teszt', currency: 'HUF' });
    fixture.detectChanges();
    expect(component.entries).toEqual([]);
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
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
