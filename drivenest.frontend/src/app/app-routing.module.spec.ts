import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AppRoutingModule } from './app-routing.module';
import { LoginPageComponent } from './login-page/login-page.component';

describe('Default page', () => {
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
});
