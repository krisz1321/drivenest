import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { API_BASE_URL, AuthService } from './auth.service';
import { authInterceptor } from './auth.interceptor';
import { authGuard } from './auth.guard';

describe('Dashboard authentication', () => {
  let http: HttpTestingController;
  let client: HttpClient;
  let router: Router;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(), { provide: API_BASE_URL, useValue: '/api' }
    ] });
    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    sessionStorage.setItem('drivenest.token', 'test-token');
    sessionStorage.setItem('drivenest.expiresAtUtc', '2099-01-01T00:00:00Z');
  });
  afterEach(() => { http.verify(); TestBed.inject(AuthService).logout(); });

  it('sends the Bearer token to the API but not to other hosts or login', () => {
    client.get('/api/ownvehicles').subscribe();
    const owned = http.expectOne('/api/ownvehicles');
    expect(owned.request.headers.get('Authorization')).toBe('Bearer test-token');
    owned.flush([]);
    client.get('https://other.example/data').subscribe();
    const other = http.expectOne('https://other.example/data');
    expect(other.request.headers.has('Authorization')).toBeFalse();
    other.flush({});
    client.post('/api/auth/login', {}).subscribe();
    const login = http.expectOne('/api/auth/login');
    expect(login.request.headers.has('Authorization')).toBeFalse();
    login.flush({});
  });
  it('retains renewed credentials returned by successful writes', () => {
    client.post('/api/ownvehicles', {}).subscribe();
    http.expectOne('/api/ownvehicles').flush({}, { headers: {
      'X-Refreshed-Token': 'renewed-token', 'X-Token-Expires-At': '2099-02-01T00:00:00Z'
    } });
    expect(TestBed.inject(AuthService).token).toBe('renewed-token');
    expect(sessionStorage.getItem('drivenest.expiresAtUtc')).toBe('2099-02-01T00:00:00Z');
  });
  it('clears a rejected session and returns to login', () => {
    client.get('/api/me').subscribe({ error: () => {} });
    http.expectOne('/api/me').flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(TestBed.inject(AuthService).token).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { expired: '1' } });
  });
  it('allows an unexpired session and rejects an expired one', () => {
    const check = () => TestBed.runInInjectionContext(() => authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
    expect(check()).toBeTrue();
    sessionStorage.setItem('drivenest.expiresAtUtc', '2000-01-01T00:00:00Z');
    expect((check() as UrlTree).toString()).toBe('/login');
    expect(TestBed.inject(AuthService).token).toBeNull();
  });
});
