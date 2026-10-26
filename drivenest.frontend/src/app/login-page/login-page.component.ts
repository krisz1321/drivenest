import { Component, DestroyRef, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { Router, RouterLink } from '@angular/router';

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
  private readonly router = inject(Router);
  readonly form = this.formBuilder.nonNullable.group({
    userNameOrEmail: ['', [Validators.required, Validators.pattern(/\S/)]],
    password: ['', Validators.required]
  });
  showPassword = false;
  submitting = false;
  error = '';

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
      next: () => {
        this.form.reset();
        this.showPassword = false;
        void this.router.navigateByUrl('/dashboard');
      },
      error: (error: HttpErrorResponse) => {
        this.error = error.status === 401 ? 'Hibás felhasználónév vagy jelszó.'
          : error.status === 0 ? 'Nem sikerült kapcsolódni a szerverhez. Ellenőrizd a kapcsolatot, majd próbáld újra.'
          : 'A bejelentkezés most nem sikerült. Próbáld újra később.';
      }
    });
  }
}
