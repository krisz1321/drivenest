import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API_BASE_URL, AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: API_BASE_URL, useValue: '/api' }
    ] });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
    service.logout();
  });
  afterEach(() => { http.verify(); service.logout(); });

  it('registers through the API without treating registration as a login', () => {
    service.register('Demo', 'demo@example.com', 'Demo123!').subscribe();
    const request = http.expectOne('/api/auth/register');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ displayName: 'Demo', email: 'demo@example.com', password: 'Demo123!' });
    request.flush({ id: 1, displayName: 'Demo', email: 'demo@example.com', currency: 'HUF' }, { status: 201, statusText: 'Created' });
    expect(sessionStorage.getItem('drivenest.token')).toBeNull();
  });

  it('posts credentials and retains only the session token and expiry', () => {
    service.login('demo1', 'Demo123!').subscribe();
    const request = http.expectOne('/api/auth/login');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ userNameOrEmail: 'demo1', password: 'Demo123!' });
    request.flush({ token: 'test-token', expiresAtUtc: '2099-01-01', user: {}, roles: [] });
    expect(sessionStorage.getItem('drivenest.token')).toBe('test-token');
    service.logout();
    expect(sessionStorage.getItem('drivenest.token')).toBeNull();
    expect(sessionStorage.getItem('drivenest.expiresAtUtc')).toBeNull();
  });
});
