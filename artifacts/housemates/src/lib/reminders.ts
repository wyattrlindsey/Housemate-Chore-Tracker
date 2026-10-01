import type { ReminderInput } from '@workspace/api-client-react';
import { todayKey } from './dates';
import { isValidEmail, normalizeEmail } from './email';
import type { Chore, Housemate } from './types';

/** Only unfinished chores assigned to an email-enabled housemate are uploaded. */
export function buildReminderPayload(
  housemates: Housemate[],
  chores: Chore[],
  today: string = todayKey(),
): ReminderInput {
  return {
    triggeredBy: 'A housemate',
    reminders: housemates.flatMap((housemate) => {
      const email = normalizeEmail(housemate.email);
      if (!email || !isValidEmail(email)) return [];
      const unfinished = chores.filter((chore) => chore.assigneeId === housemate.id && chore.status !== 'Completed');
      if (unfinished.length === 0) return [];
      return [{
        name: housemate.name,
        email,
        chores: unfinished.map((chore) => ({
          title: chore.title,
          due: chore.dueDate,
          overdue: chore.dueDate < today,
        })),
      }];
    }),
  };
}

export function reminderEmptyMessage(housemates: Housemate[], chores: Chore[]): string | null {
  const withEmail = housemates.filter((housemate) => {
    const email = normalizeEmail(housemate.email);
    return email && isValidEmail(email);
  });
  if (withEmail.length === 0) return 'Add an email address in Housemates to start sending reminders.';
  if (!chores.some((chore) => chore.status !== 'Completed')) return 'No unfinished chores — nothing to remind anyone about!';
  if (buildReminderPayload(withEmail, chores).reminders.length === 0) {
    return 'No eligible recipients yet. Assign an unfinished chore to a housemate with an email address.';
  }
  return null;
}