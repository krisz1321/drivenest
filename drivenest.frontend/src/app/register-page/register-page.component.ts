import { Component, DestroyRef, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { AuthService } from '../services/auth.service';

function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  return control.get('password')?.value === control.get('confirmPassword')?.value
    ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register-page.component.html',
  styleUrl: './register-page.component.scss'
})
export class RegisterPageComponent {
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  readonly form = inject(FormBuilder).nonNullable.group({
    displayName: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(256)]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[\s\S]+$/)]],
    confirmPassword: ['', Validators.required]
  }, { validators: passwordsMatch });
  submitting = false;
  showPassword = false;
  registered = false;
  errors: string[] = [];

  invalid(field: keyof typeof this.form.controls) {
    const control = this.form.controls[field];
    return control.touched && control.invalid;
  }

  submit() {
    if (this.submitting) return;
    this.errors = [];
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { displayName, email, password } = this.form.getRawValue();
    this.submitting = true;
    this.auth.register(displayName.trim(), email.trim(), password).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.submitting = false)
    ).subscribe({
      next: () => {
        this.registered = true;
        this.form.reset();
        this.showPassword = false;
      },
      error: (error: HttpErrorResponse) => {
        const validation = error.error?.errors;
        const messages = validation && typeof validation === 'object'
          ? Object.values(validation).flat().filter((value): value is string => typeof value === 'string') : [];
        this.errors = messages.length ? messages : [error.status === 0
          ? 'We couldn’t connect. Check your connection and try again.'
          : 'We couldn’t create your account. Please try again shortly.'];
      }
    });
  }
}
