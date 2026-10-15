import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API_BASE_URL } from './auth.service';
import { VehicleRequest, VehicleService } from './vehicle.service';

describe('VehicleService', () => {
  let api: VehicleService;
  let http: HttpTestingController;
  const body: VehicleRequest = { make: 'Suzuki', model: 'Swift', licensePlate: 'ABC-123', vin: null, year: null, fuelTypeId: 1, initialKm: 0, currentKm: 10 };
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_BASE_URL, useValue: '/api' }] });
    api = TestBed.inject(VehicleService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('uses only own-vehicle endpoints for CRUD', () => {
    api.list().subscribe();
    http.expectOne('/api/ownvehicles').flush([]);
    api.create(body).subscribe();
    const create = http.expectOne('/api/ownvehicles');
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual(body);
    create.flush({ id: 1, ...body });
    api.update(1, body).subscribe();
    const update = http.expectOne('/api/ownvehicles/1');
    expect(update.request.method).toBe('PUT');
    update.flush({ id: 1, ...body });
    api.delete(1).subscribe();
    const remove = http.expectOne('/api/ownvehicles/1');
    expect(remove.request.method).toBe('DELETE');
    remove.flush(null, { status: 204, statusText: 'No Content' });
  });
  it('gets fuel type options from the lookup API', () => {
    api.fuelTypes().subscribe(types => expect(types).toEqual([{ id: 1, name: 'Benzin' }]));
    const request = http.expectOne('/api/lookups/fuel-types');
    expect(request.request.method).toBe('GET');
    request.flush([{ id: 1, name: 'Benzin' }]);
  });
});
