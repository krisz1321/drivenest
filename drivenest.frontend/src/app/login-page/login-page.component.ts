import { Component, DestroyRef, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { AuthService, LoginResponse } from '../services/auth.service';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss'
})
export class LoginPageComponent {
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);
  readonly form = this.formBuilder.nonNullable.group({
    userNameOrEmail: ['', [Validators.required, Validators.pattern(/\S/)]],
    password: ['', Validators.required]
  });
  showPassword = false;
  submitting = false;
  error = '';
  signedInUser: LoginResponse['user'] | null = null;

  submit() {
    if (this.submitting) return;
    this.error = '';
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting = true;
    const { userNameOrEmail, password } = this.form.getRawValue();
    this.auth.login(userNameOrEmail.trim(), password).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.submitting = false)
    ).subscribe({
      next: response => {
        this.signedInUser = response.user;
        this.form.reset();
        this.showPassword = false;
      },
      error: (error: HttpErrorResponse) => {
        this.error = error.status === 401 ? 'The username or password is incorrect. Please try again.'
          : error.status === 0 ? 'We couldn’t connect. Check your connection and try again.'
          : 'We couldn’t sign you in right now. Please try again shortly.';
      }
    });
  }

  signOut() {
    this.auth.logout();
    this.signedInUser = null;
  }
}
