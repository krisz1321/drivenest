// Csak saját oldalon belüli útvonalat fogadunk el, hogy a returnUrl ne lehessen idegen oldalra mutató.
export function getSafeReturnUrl(value: string | null): string {
  if (value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) {
    return value;
  }

  return '/';
}
