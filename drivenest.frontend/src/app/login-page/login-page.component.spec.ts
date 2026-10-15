import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { provideRouter } from '@angular/router';

import { LoginPageComponent } from './login-page.component';

describe('LoginPageComponent', () => {
  let component: LoginPageComponent;
  let fixture: ComponentFixture<LoginPageComponent>;
  let auth: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['login', 'logout']);
    await TestBed.configureTestingModule({
      imports: [LoginPageComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LoginPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('requires both credentials before making a request', () => {
    component.submit();
    expect(auth.login).not.toHaveBeenCalled();
    expect(component.form.touched).toBeTrue();
  });

  it('signs in with a trimmed username and clears the password', () => {
    const user = { id: 1, email: 'demo@example.com', displayName: 'Demo', currency: 'HUF' };
    auth.login.and.returnValue(of({ token: 'token', expiresAtUtc: '2099-01-01', user, roles: ['User'] }));
    component.form.setValue({ userNameOrEmail: ' demo1 ', password: ' Demo123! ' });
    component.submit();
    expect(auth.login).toHaveBeenCalledWith('demo1', ' Demo123! ');
    expect(component.signedInUser).toEqual(user);
    expect(component.form.controls.password.value).toBe('');
    expect(component.submitting).toBeFalse();
  });

  it('shows an accessible error and allows retrying after rejected credentials', () => {
    auth.login.and.returnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    component.form.setValue({ userNameOrEmail: 'demo1', password: 'wrong' });
    component.submit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('incorrect');
    expect(component.submitting).toBeFalse();
    expect(component.signedInUser).toBeNull();
  });
});
