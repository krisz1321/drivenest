import { FormGroup } from '@angular/forms';

import { ProblemDetails } from './models/auth.models';

// A szerver 400-as válaszának mezőhibáit az űrlap megfelelő mezőire teszi (pl. "Email" -> email).
// Visszaadja azokat az üzeneteket, amelyekhez nincs mező.
export function applyServerErrors(form: FormGroup, problem: ProblemDetails | null): string[] {
  const unmatched: string[] = [];

  for (const [key, messages] of Object.entries(problem?.errors ?? {})) {
    const control = form.get(key.charAt(0).toLowerCase() + key.slice(1));

    if (control) {
      control.setErrors({ server: messages.join(' ') });
      control.markAsTouched();
    } else {
      unmatched.push(...messages);
    }
  }

  return unmatched;
}
