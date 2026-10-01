import { format, isValid } from 'date-fns';

/** Format a Date as a local YYYY-MM-DD string. */
export function toKey(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export function todayKey(): string {
  return toKey(new Date());
}

/** Parse YYYY-MM-DD as a LOCAL date (never UTC). */
export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function isValidKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const d = fromKey(key);
  return isValid(d) && toKey(d) === key;
}

/** Convert an ISO timestamp to the local calendar date key. */
export function isoToLocalKey(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isValid(d) ? toKey(d) : null;
}

export function friendlyDate(key: string): string {
  const t = todayKey();
  const d = fromKey(key);
  const diff = Math.round((d.getTime() - fromKey(t).getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (d.getFullYear() === new Date().getFullYear()) return format(d, 'EEE, MMM d');
  return format(d, 'MMM d, yyyy');
}
