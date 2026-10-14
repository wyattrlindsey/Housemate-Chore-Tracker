import type { Chore, Housemate } from './types';

export interface ReminderPreview {
  id: string;
  name: string;
  count: number;
}

/** Mirrors the server: everyone with unfinished assigned chores. Names and counts only. */
export function reminderPreview(housemates: Housemate[], chores: Chore[]): ReminderPreview[] {
  return housemates.flatMap((h) => {
    const count = chores.filter((c) => c.assigneeId === h.id && c.status !== 'Completed').length;
    return count ? [{ id: h.id, name: h.name, count }] : [];
  });
}

export function reminderEmptyMessage(housemates: Housemate[], chores: Chore[]): string | null {
  if (chores.length === 0) return 'Add a chore first. Reminders cover unfinished chores that have someone assigned.';
  if (!chores.some((c) => c.status !== 'Completed')) return 'No unfinished chores, so there is nothing to remind anyone about.';
  if (reminderPreview(housemates, chores).length === 0) return 'No unfinished chores are assigned to anyone yet, so there are no recipients.';
  return null;
}

/** A visible chore in the current house used to prove membership to the server. */
export function reminderAnchor(chores: Chore[]): string | null {
  if (chores.length === 0) return null;
  return [...chores].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))[0].id;
}
