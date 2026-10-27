import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { API_BASE_URL } from '../services/auth.service';
import { ServiceRecordsComponent } from './service-records.component';

 describe('ServiceRecordsComponent', () => {
  let fixture: ComponentFixture<ServiceRecordsComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ServiceRecordsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: API_BASE_URL, useValue: '/api' }]
    }).compileComponents();
    fixture = TestBed.createComponent(ServiceRecordsComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const car = (id: number) => ({ id, make: 'Volkswagen', model: 'Golf', licensePlate: 'ABC-123' });
  const entry = {
    id: 1, vehicleId: 1, categoryId: 1, categoryName: 'Olajcsere',
    date: '2026-03-14', odometerKm: 78940, provider: 'Kovács Szerviz',
    description: 'Időszakos olajcsere', partsCost: 31900, laborCost: 10000,
    createdAt: '2026-03-14T17:22:00Z'
  };

  it('shows records, combined costs and switchable timestamps', () => {
    http.expectOne('/api/ownvehicles').flush([car(1)]);
    http.expectOne('/api/vehicles/1/service-records').flush([entry]);
    fixture.detectChanges();
    const page: HTMLElement = fixture.nativeElement;
    expect(page.textContent).toContain('Időszakos olajcsere');
    expect(page.textContent).toContain('Kovács Szerviz');
    expect(page.textContent).toContain(fixture.componentInstance.number(41900) + ' Ft');
    expect(page.querySelector('.timestamp')?.textContent).toContain('2026-03-14 18:22');
    const toggle = page.querySelector('input[type=checkbox]') as HTMLInputElement;
    toggle.click();
    fixture.detectChanges();
    expect(page.querySelector('.timestamp')).toBeNull();
    expect(page.textContent).toContain('Időszakos olajcsere');
  });

  it('cancels the old request when changing vehicles', () => {
    http.expectOne('/api/ownvehicles').flush([car(1), car(2)]);
    const previous = http.expectOne('/api/vehicles/1/service-records');
    fixture.componentInstance.vehicleId = 2;
    fixture.componentInstance.loadRecords();
    expect(previous.cancelled).toBeTrue();
    http.expectOne('/api/vehicles/2/service-records').flush([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Még nincs szervizbejegyzés');
  });

  it('allows retrying a failed load', () => {
    http.expectOne('/api/ownvehicles').flush([car(1)]);
    http.expectOne('/api/vehicles/1/service-records').flush({}, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=alert]')).toBeTruthy();
    fixture.componentInstance.retry();
    http.expectOne('/api/vehicles/1/service-records').flush([entry]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=alert]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Időszakos olajcsere');
  });
});
