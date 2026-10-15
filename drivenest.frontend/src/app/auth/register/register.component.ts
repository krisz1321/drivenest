import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { switchMap, tap } from 'rxjs';

import { AuthService } from '../../core/auth.service';
import { ProblemDetails } from '../../core/models/auth.models';
import { getSafeReturnUrl } from '../../core/return-url';
import { applyServerErrors } from '../../core/server-errors';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirmPassword = group.get('confirmPassword')?.value;

  return password === confirmPassword ? null : { mismatch: true };
}

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  standalone: false
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly form = this.fb.nonNullable.group(
    {
      displayName: ['', [Validators.required, Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)]],
      confirmPassword: ['', Validators.required]
    },
    { validators: passwordsMatch }
  );

  submitting = false;
  errorMessages: string[] = [];

  private registered = false;

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { displayName, email, password } = this.form.getRawValue();
    const request = { displayName: displayName.trim(), email: email.trim(), password };

    this.submitting = true;
    this.errorMessages = [];
    this.registered = false;

    this.auth
      .register(request)
      .pipe(
        tap(() => (this.registered = true)),
        switchMap(() => this.auth.login({ userNameOrEmail: request.email, password }))
      )
      .subscribe({
        next: () => {
          const returnUrl = getSafeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
          this.router.navigateByUrl(returnUrl);
        },
        error: (error: HttpErrorResponse) => {
          this.submitting = false;
          this.handleError(error);
        }
      });
  }

  // Az első hibaüzenet a mezőhöz tartozik, ha az már érintett (vagy elküldték az űrlapot).
  errorOf(name: string): string | null {
    const control = this.form.get(name);
    if (!control || !control.invalid || !(control.touched || control.dirty)) {
      return null;
    }

    const errors = control.errors ?? {};

    if (errors['server']) {
      return errors['server'] as string;
    }
    if (errors['required']) {
      return 'Kötelező megadni.';
    }
    if (errors['email']) {
      return 'Érvénytelen e-mail-cím.';
    }
    if (errors['minlength']) {
      return 'Legalább 8 karakter legyen.';
    }
    if (errors['pattern']) {
      return 'Kell kisbetű, nagybetű és számjegy.';
    }
    if (errors['maxlength']) {
      return 'Legfeljebb 100 karakter.';
    }

    return null;
  }

  get passwordsDiffer(): boolean {
    const confirmPassword = this.form.controls.confirmPassword;

    return this.form.hasError('mismatch') && confirmPassword.valid && (confirmPassword.touched || confirmPassword.dirty);
  }

  private handleError(error: HttpErrorResponse): void {
    if (error.status === 0) {
      this.errorMessages = ['A szerver nem érhető el.'];
      return;
    }

    // A regisztráció sikerült, csak a belépés nem: a felhasználó be tud lépni kézzel.
    if (this.registered) {
      this.router.navigate(['/login']);
      return;
    }

    const problem = error.error as ProblemDetails | null;

    if (error.status === 400 && problem?.errors) {
      this.errorMessages = applyServerErrors(this.form, problem);
      return;
    }

    this.errorMessages = [problem?.title ?? 'Ismeretlen hiba történt.'];
  }
}
