import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GaragePageComponent } from './garage-page.component';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

describe('GaragePageComponent', () => {
  let component: GaragePageComponent;
  let fixture: ComponentFixture<GaragePageComponent>;
  let http: HttpTestingController;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(async () => {
    params = new BehaviorSubject(convertToParamMap({}));
    await TestBed.configureTestingModule({
      imports: [GaragePageComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: ActivatedRoute, useValue: { paramMap: params } }]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GaragePageComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => { http.verify({ ignoreCancelled: true }); });

  function respond(vehicles: unknown[]) {
    http.expectOne(req => req.url.endsWith('/ownvehicles')).flush(vehicles);
    http.expectOne(req => req.url.endsWith('/lookups/fuel-types')).flush([{ id: 1, name: 'Benzin' }]);
    http.expectOne(req => req.url.endsWith('/me')).flush({ displayName: 'Teszt', distanceUnit: 'km' });
    fixture.detectChanges();
  }

  it('renders the profile vehicles and unavailable consumption', () => {
    respond([{ id: 4, make: 'Toyota', model: 'Yaris', licensePlate: 'TEST-42', currentKm: 42000, year: 2020, fuelTypeId: 1, vin: null }]);
    const card = fixture.nativeElement.querySelector('.vehicle-card');
    expect(card.textContent).toContain('Toyota Yaris');
    expect(card.textContent).toContain('TEST-42');
    expect(card.textContent.replace(/\s/g, ' ')).toContain('42 000 km');
    expect(card.textContent).toContain('N/A');
    expect(fixture.nativeElement.textContent).not.toContain('Volkswagen Golf');
  });

  it('shows an empty garage without sample cars', () => {
    respond([]);
    expect(fixture.nativeElement.querySelector('.vehicle-card')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Még nincs jármű');
  });

  it('navigates to a vehicle page when its card is clicked', () => {
    respond([{ id: 4, make: 'Toyota', model: 'Yaris', licensePlate: 'TEST-42', currentKm: 42000, fuelTypeId: 1 }]);
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture.nativeElement.querySelector('.vehicle-card').click();
    expect(navigate).toHaveBeenCalledWith(['/garage', 4]);
  });

  it('renders a vehicle page with its tools and a back link', () => {
    params.next(convertToParamMap({ id: '4' }));
    respond([{ id: 4, make: 'Toyota', model: 'Yaris', licensePlate: 'TEST-42', currentKm: 42000, initialKm: 0, year: 2020, fuelTypeId: 1, vin: null }]);
    http.expectOne(req => req.url.endsWith('/vehicles/4/refuelings')).flush([]);
    http.expectOne(req => req.url.endsWith('/vehicles/4/service-records')).flush([]);
    http.expectOne(req => req.url.endsWith('/service-categories')).flush([]);
    fixture.detectChanges();
    const page = fixture.nativeElement.querySelector('.vehicle-detail-page');
    expect(page.textContent).toContain('Toyota Yaris');
    expect(page.querySelector('app-vehicle-refuelings')).toBeTruthy();
    expect(page.querySelector('app-vehicle-services')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.back-to-garage').getAttribute('href')).toBe('/garage');
    expect(fixture.nativeElement.querySelector('.vehicle-grid')).toBeNull();
    params.next(convertToParamMap({}));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.vehicle-grid')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.vehicle-detail-page')).toBeNull();
  });

  it('should create', () => {
    respond([]);
    expect(component).toBeTruthy();
  });
});
