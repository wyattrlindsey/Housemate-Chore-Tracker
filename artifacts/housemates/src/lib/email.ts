/** Blank optional email addresses are stored as absent, including when cleared. */
export function normalizeEmail(email: unknown): string | undefined {
  return typeof email === 'string' ? email.trim() || undefined : undefined;
}

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}