import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { RegisterPageComponent } from './register-page.component';

describe('RegisterPageComponent', () => {
  let component: RegisterPageComponent;
  let fixture: ComponentFixture<RegisterPageComponent>;
  let auth: jasmine.SpyObj<AuthService>;
  const user = { id: 1, displayName: 'Demo', email: 'demo@example.com', currency: 'HUF' };
  beforeEach(async () => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['register']);
    await TestBed.configureTestingModule({
      imports: [RegisterPageComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }]
    }).compileComponents();
    fixture = TestBed.createComponent(RegisterPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });
  function fill() {
    component.form.setValue({ displayName: ' Demo ', email: 'demo@example.com', password: 'Demo123!', confirmPassword: 'Demo123!' });
  }
  it('rejects empty fields, weak passwords, and mismatched confirmation', () => {
    component.submit();
    expect(auth.register).not.toHaveBeenCalled();
    fill();
    component.form.controls.password.setValue('weak');
    component.submit();
    expect(auth.register).not.toHaveBeenCalled();
    fill();
    component.form.controls.confirmPassword.setValue('Different123');
    component.submit();
    expect(auth.register).not.toHaveBeenCalled();
    expect(component.form.hasError('passwordMismatch')).toBeTrue();
  });
  it('creates the account, clears passwords, and links back to sign in', () => {
    auth.register.and.returnValue(of(user));
    fill();
    component.submit();
    fixture.detectChanges();
    expect(auth.register).toHaveBeenCalledWith('Demo', 'demo@example.com', 'Demo123!');
    expect(component.registered).toBeTrue();
    expect(component.form.controls.password.value).toBe('');
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('created');
    expect(fixture.nativeElement.querySelector('main a').getAttribute('href')).toBe('/login');
  });
  it('displays backend validation messages and allows retrying', () => {
    auth.register.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 400, error: { errors: { Email: ['This email is already registered.'] } }
    })));
    fill();
    component.submit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('already registered');
    expect(component.submitting).toBeFalse();
    expect(component.registered).toBeFalse();
  });
  it('prevents duplicate submissions while a request is pending', () => {
    const pending = new Subject<typeof user>();
    auth.register.and.returnValue(pending);
    fill();
    component.submit();
    component.submit();
    expect(auth.register).toHaveBeenCalledTimes(1);
    pending.next(user);
    pending.complete();
    expect(component.submitting).toBeFalse();
  });
});
