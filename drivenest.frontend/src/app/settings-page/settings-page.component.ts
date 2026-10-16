import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, finalize } from 'rxjs';
import { AppShellComponent } from '../layout/app-shell.component';
import { AuthService } from '../services/auth.service';
import { ProfileService } from '../services/profile.service';
import { newPasswordValidators, passwordsMatch } from '../register-page/register-page.component';
import { ConsumptionUnit, Currency, DistanceUnit, VolumeUnit } from '../shared/units';

type Section = 'profile' | 'email' | 'password';

// Az e-mail-címet kétszer kell megadni; a kis- és nagybetű, valamint a szélső szóköz nem számít.
function emailsMatch(control: AbstractControl): ValidationErrors | null {
  const email = control.get('email')?.value?.trim().toLowerCase();
  const confirm = control.get('confirmEmail')?.value?.trim().toLowerCase();
  return email === confirm ? null : { emailMismatch: true };
}

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [ReactiveFormsModule, AppShellComponent],
  templateUrl: './settings-page.component.html',
  styleUrl: './settings-page.component.scss'
})
export class SettingsPageComponent implements OnInit {
  private readonly profileService = inject(ProfileService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder).nonNullable;
  readonly profile = this.profileService.profile;
  readonly currencies: { value: Currency; label: string }[] = [
    { value: 'HUF', label: 'Magyar forint (Ft)' }, { value: 'EUR', label: 'Euró (EUR)' }
  ];
  readonly distanceUnits: { value: DistanceUnit; label: string }[] = [
    { value: 'km', label: 'Kilométer (km)' }, { value: 'mi', label: 'Mérföld (mi)' }
  ];
  readonly volumeUnits: { value: VolumeUnit; label: string }[] = [
    { value: 'l', label: 'Liter (l)' }, { value: 'gal', label: 'US gallon (gal)' }
  ];
  readonly consumptionUnits: { value: ConsumptionUnit; label: string }[] = [
    { value: 'l/100km', label: 'l/100 km' }, { value: 'km/l', label: 'km/l' }, { value: 'mpg', label: 'mpg (US)' }
  ];
  readonly profileForm = this.fb.group({
    displayName: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(100)]],
    currency: ['HUF' as Currency],
    distanceUnit: ['km' as DistanceUnit],
    volumeUnit: ['l' as VolumeUnit],
    consumptionUnit: ['l/100km' as ConsumptionUnit]
  });
  readonly emailForm = this.fb.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(256)]],
    confirmEmail: ['', Validators.required],
    currentPassword: ['', Validators.required]
  }, { validators: emailsMatch });
  readonly passwordForm = this.fb.group({
    currentPassword: ['', Validators.required],
    password: ['', newPasswordValidators],
    confirmPassword: ['', Validators.required]
  }, { validators: passwordsMatch });
  loading = true;
  loadError = '';
  saving: Section | null = null;
  messages: Record<Section, string> = { profile: '', email: '', password: '' };
  errors: Record<Section, string[]> = { profile: [], email: [], password: [] };

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.loadError = '';
    this.profileService.load().pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading = false)).subscribe({
      next: profile => this.profileForm.reset({
        displayName: profile.displayName, currency: profile.currency, distanceUnit: profile.distanceUnit,
        volumeUnit: profile.volumeUnit, consumptionUnit: profile.consumptionUnit
      }),
      error: () => this.loadError = 'A beállítások betöltése nem sikerült. Próbáld újra.'
    });
  }

  invalid(control: AbstractControl) { return control.touched && control.invalid; }

  saveProfile() {
    if (this.saving) return;
    this.clearFeedback();
    if (this.profileForm.invalid) { this.profileForm.markAllAsTouched(); return; }
    const value = this.profileForm.getRawValue();
    this.run('profile', this.profileService.update({ ...value, displayName: value.displayName.trim() }),
      'A beállításokat mentettük.');
  }

  changeEmail() {
    if (this.saving) return;
    this.clearFeedback();
    if (this.emailForm.invalid) { this.emailForm.markAllAsTouched(); return; }
    const { email, currentPassword } = this.emailForm.getRawValue();
    this.run('email', this.auth.changeEmail(email.trim(), currentPassword),
      'Az e-mail-címedet módosítottuk. A következő belépéshez már az új címet használd.', () => this.emailForm.reset());
  }

  changePassword() {
    if (this.saving) return;
    this.clearFeedback();
    if (this.passwordForm.invalid) { this.passwordForm.markAllAsTouched(); return; }
    const { currentPassword, password } = this.passwordForm.getRawValue();
    this.run('password', this.auth.changePassword(currentPassword, password),
      'A jelszavadat módosítottuk.', () => this.passwordForm.reset());
  }

  private clearFeedback() {
    this.messages = { profile: '', email: '', password: '' };
    this.errors = { profile: [], email: [], password: [] };
  }

  private run(section: Section, request: Observable<unknown>, message: string, onSuccess: () => void = () => {}) {
    this.saving = section;
    request.pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.saving = null)).subscribe({
      next: () => {
        this.messages[section] = message;
        onSuccess();
      },
      error: (error: HttpErrorResponse) => this.errors[section] = this.apiErrors(error)
    });
  }

  private apiErrors(error: HttpErrorResponse): string[] {
    const details = error.error?.errors;
    if (details && typeof details === 'object') {
      const messages = Object.values(details).flat().filter((v): v is string => typeof v === 'string');
      if (messages.length) return messages;
    }
    if (error.status === 0) return ['Nem sikerült kapcsolódni a szerverhez. Ellenőrizd a kapcsolatot, majd próbáld újra.'];
    if (typeof error.error?.title === 'string') return [error.error.title];
    return ['A művelet nem sikerült. Próbáld újra.'];
  }
}
