import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GaragePageComponent } from './garage-page.component';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

describe('GaragePageComponent', () => {
  let component: GaragePageComponent;
  let fixture: ComponentFixture<GaragePageComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GaragePageComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
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

  it('should create', () => {
    respond([]);
    expect(component).toBeTruthy();
  });
});
