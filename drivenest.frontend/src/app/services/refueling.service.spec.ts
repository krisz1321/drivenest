import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API_BASE_URL } from './auth.service';
import { RefuelingRequest, RefuelingService } from './refueling.service';

describe('RefuelingService', () => {
  let api: RefuelingService;
  let http: HttpTestingController;
  const body: RefuelingRequest = { date: '2026-10-15', odometerKm: 100, liters: 12.345, totalAmount: 1234.50, isFullTank: false };
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_BASE_URL, useValue: '/api' }] });
    api = TestBed.inject(RefuelingService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('scopes every CRUD call to the car whose button was clicked', () => {
    api.list(2).subscribe();
    const list = http.expectOne('/api/vehicles/2/refuelings');
    expect(list.request.method).toBe('GET'); list.flush([]);
    api.create(2, body).subscribe();
    const create = http.expectOne('/api/vehicles/2/refuelings');
    expect(create.request.method).toBe('POST'); expect(create.request.body).toEqual(body);
    create.flush({ ...body, id: 10, vehicleId: 2 });
    api.update(2, 10, body).subscribe();
    const update = http.expectOne('/api/vehicles/2/refuelings/10');
    expect(update.request.method).toBe('PUT'); expect(update.request.body).toEqual(body); update.flush({ ...body });
    api.delete(2, 10).subscribe();
    const remove = http.expectOne('/api/vehicles/2/refuelings/10');
    expect(remove.request.method).toBe('DELETE'); remove.flush(null);
  });
});
