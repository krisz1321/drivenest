import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { NavigationEnd, Router } from '@angular/router';
import { filter, firstValueFrom, take } from 'rxjs';
import { API_BASE_URL } from './services/auth.service';
import { authInterceptor } from './services/auth.interceptor';
import { RouterTestingHarness } from '@angular/router/testing';
import { AppRoutingModule } from './app-routing.module';
import { LoginPageComponent } from './login-page/login-page.component';

describe('Default page', () => {
  afterEach(() => {
    sessionStorage.removeItem('drivenest.token');
    sessionStorage.removeItem('drivenest.expiresAtUtc');
  });
  it('opens the login form when visiting the root URL', async () => {
    TestBed.configureTestingModule({
      imports: [AppRoutingModule],
      providers: [provideHttpClient()]
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/', LoginPageComponent);
    expect(TestBed.inject(Router).url).toBe('/login');
    expect(harness.routeNativeElement?.querySelector('form')).toBeTruthy();
  });

  it('navigates directly from a successful login to the real dashboard', async () => {
    TestBed.configureTestingModule({
      imports: [AppRoutingModule],
      providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '/api' }]
    });
    const harness = await RouterTestingHarness.create();
    const login = await harness.navigateByUrl('/login', LoginPageComponent);
    const router = TestBed.inject(Router);
    const http = TestBed.inject(HttpTestingController);
    const navigation = firstValueFrom(router.events.pipe(filter(event => event instanceof NavigationEnd), take(1)));
    login.form.setValue({ userNameOrEmail: 'demo1', password: 'Demo123!' });
    login.submit();
    const user = { id: 1, displayName: 'Demo', email: 'demo@example.com', currency: 'HUF' };
    http.expectOne('/api/auth/login').flush({ token: 'test-token', expiresAtUtc: '2099-01-01T00:00:00Z', user, roles: ['User'] });
    await navigation;
    harness.detectChanges();
    http.expectOne('/api/me').flush(user);
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(router.url).toBe('/dashboard');
    expect(harness.routeNativeElement?.querySelector('.dashboard')).toBeTruthy();
    expect(harness.routeNativeElement?.textContent).not.toContain('You’re signed in to DriveNest.');
    http.verify();
  });
});
