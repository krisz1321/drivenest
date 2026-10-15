import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../../core/auth.service';
import { ProblemDetails } from '../../core/models/auth.models';
import { getSafeReturnUrl } from '../../core/return-url';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  standalone: false
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly form = this.fb.nonNullable.group({
    userNameOrEmail: ['', Validators.required],
    password: ['', Validators.required]
  });

  submitting = false;
  errorMessage: string | null = null;

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting = true;
    this.errorMessage = null;

    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => {
        const returnUrl = getSafeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
        this.router.navigateByUrl(returnUrl);
      },
      error: (error: HttpErrorResponse) => {
        this.submitting = false;
        this.errorMessage = this.getErrorMessage(error);
      }
    });
  }

  isInvalid(name: string): boolean {
    const control = this.form.get(name);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  private getErrorMessage(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return 'A szerver nem érhető el.';
    }

    const problem = error.error as ProblemDetails | null;

    return problem?.title ?? 'Ismeretlen hiba történt.';
  }
}
