import type { AppData, Chore, ChoreStatus } from './types';
import { toKey } from './dates';

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function buildSeed(): AppData {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  const day = (d: number) => toKey(new Date(y, m, Math.min(Math.max(d, 1), last)));
  const t = now.getDate();

  const housemates = [
    { id: uid(), name: 'Maya', avatarColor: '#0F766E' },
    { id: uid(), name: 'Theo', avatarColor: '#C2410C' },
    { id: uid(), name: 'Priya', avatarColor: '#6D28D9' },
  ];
  const [a, b, c] = housemates.map((h) => h.id);

  const completedOn = (d: number) => {
    const dt = new Date(y, m, Math.min(Math.max(d, 1), t), 18, 30);
    return dt.toISOString();
  };

  const rows: [string, string | undefined, string, ChoreStatus, number, number | null][] = [
    ['Take out recycling', 'Blue bin goes to the curb by 7am.', a, 'Completed', t - 6, t - 6],
    ['Wipe down kitchen counters', undefined, b, 'Completed', t - 4, t - 3],
    ['Clean the bathroom', 'Sink, mirror, shower and floor.', c, 'To-do', t - 2, null],
    ['Restock dish soap and sponges', undefined, a, 'In progress', t - 1, null],
    ['Vacuum the living room', 'Move the rug and get under the sofa.', b, 'In progress', t, null],
    ['Water the plants', undefined, c, 'Completed', t, t],
    ['Defrost the freezer', undefined, a, 'To-do', t + 2, null],
    ['Mop the hallway', undefined, b, 'To-do', t + 4, null],
    ['Pay the internet bill', 'Split three ways, send the receipt in the group chat.', c, 'To-do', t + 7, null],
    ['Change bed linen in guest room', undefined, a, 'To-do', t + 11, null],
  ];

  const chores: Chore[] = rows.map(([title, description, assigneeId, status, due, done]) => ({
    id: uid(),
    title,
    description,
    assigneeId,
    status,
    dueDate: day(due),
    createdAt: new Date(y, m, 1, 9).toISOString(),
    completedAt: status === 'Completed' && done !== null ? completedOn(done) : null,
  }));

  return { version: 1, housemates, chores };
}
