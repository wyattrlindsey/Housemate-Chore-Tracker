export type ChoreStatus = 'To-do' | 'In progress' | 'Completed';

export const STATUSES: ChoreStatus[] = ['To-do', 'In progress', 'Completed'];

export interface Housemate {
  id: string;
  name: string;
  avatarColor: string;
  /** Optional destination for chore reminders. Older saved records may omit it. */
  email?: string;
}

export interface Chore {
  id: string;
  title: string;
  description?: string;
  assigneeId: string;
  status: ChoreStatus;
  /** Local calendar date, YYYY-MM-DD */
  dueDate: string;
  createdAt: string;
  completedAt: string | null;
}

export interface AppData {
  version: 1;
  housemates: Housemate[];
  chores: Chore[];
}

export const AVATAR_COLORS: { value: string; name: string }[] = [
  { value: '#0F766E', name: 'Teal' },
  { value: '#C2410C', name: 'Terracotta' },
  { value: '#6D28D9', name: 'Violet' },
  { value: '#B91C5C', name: 'Raspberry' },
  { value: '#1D4ED8', name: 'Cobalt' },
  { value: '#4D7C0F', name: 'Olive' },
  { value: '#A16207', name: 'Ochre' },
  { value: '#475569', name: 'Slate' },
];
