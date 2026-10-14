export type ChoreStatus = 'To-do' | 'In progress' | 'Completed';

export const STATUSES: ChoreStatus[] = ['To-do', 'In progress', 'Completed'];

export type HouseRole = 'owner' | 'member';

/** A member of the current house: house_members joined with profiles. */
export interface Housemate {
  id: string;
  name: string;
  avatarColor: string;
  role: HouseRole;
  joinedAt: string;
}

export interface House {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: string;
  role: HouseRole;
}

export interface Chore {
  id: string;
  houseId: string;
  title: string;
  description?: string;
  /** null when nobody is assigned (e.g. after an assignee left the house). */
  assigneeId: string | null;
  status: ChoreStatus;
  /** Local calendar date, YYYY-MM-DD, or null when there is no due date. */
  dueDate: string | null;
  createdAt: string;
  completedAt: string | null;
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
