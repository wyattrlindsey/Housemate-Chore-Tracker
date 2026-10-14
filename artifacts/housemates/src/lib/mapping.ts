import type { Chore, ChoreStatus, House, HouseRole, Housemate } from './types';

export type DbStatus = 'todo' | 'in_progress' | 'completed';

export interface ChoreRow {
  id: string;
  house_id: string;
  title: string;
  description: string | null;
  assignee_id: string | null;
  status: DbStatus;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface MemberRow {
  house_id: string;
  user_id: string;
  role: HouseRole;
  joined_at: string;
}

export interface ProfileRow {
  id: string;
  display_name: string;
  avatar_color: string;
}

export interface HouseRow {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
}

const TO_UI: Record<DbStatus, ChoreStatus> = { todo: 'To-do', in_progress: 'In progress', completed: 'Completed' };
const TO_DB: Record<ChoreStatus, DbStatus> = { 'To-do': 'todo', 'In progress': 'in_progress', Completed: 'completed' };

export function statusToUi(s: string): ChoreStatus {
  return TO_UI[s as DbStatus] ?? 'To-do';
}

export function statusToDb(s: ChoreStatus): DbStatus {
  return TO_DB[s];
}

export function rowToChore(row: ChoreRow): Chore {
  return {
    id: row.id,
    houseId: row.house_id,
    title: row.title,
    description: row.description?.trim() || undefined,
    assigneeId: row.assignee_id ?? null,
    status: statusToUi(row.status),
    dueDate: row.due_date ? row.due_date.slice(0, 10) : null,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? null,
  };
}

/**
 * Completion timestamp rules: set when a chore becomes completed, cleared when it
 * moves back, and preserved on any other edit of an already-completed chore.
 */
export function completedAtFor(
  prev: Pick<Chore, 'status' | 'completedAt'> | null,
  next: ChoreStatus,
  now: Date = new Date(),
): string | null {
  if (next !== 'Completed') return null;
  if (prev && prev.status === 'Completed' && prev.completedAt) return prev.completedAt;
  return now.toISOString();
}

export interface ChoreInput {
  title: string;
  description?: string;
  assigneeId: string | null;
  status: ChoreStatus;
  dueDate: string | null;
}

export function choreInputToRow(input: ChoreInput, prev: Chore | null, now: Date = new Date()) {
  return {
    title: input.title.trim(),
    description: input.description?.trim() || null,
    assignee_id: input.assigneeId || null,
    status: statusToDb(input.status),
    due_date: input.dueDate || null,
    completed_at: completedAtFor(prev, input.status, now),
  };
}

/** Join members with profiles in JS (there is no FK between them to embed). */
export function buildHousemates(members: MemberRow[], profiles: ProfileRow[]): Housemate[] {
  const byId = new Map(profiles.map((p) => [p.id, p]));
  return [...members]
    .sort((a, b) => a.joined_at.localeCompare(b.joined_at))
    .map((m) => {
      const p = byId.get(m.user_id);
      return {
        id: m.user_id,
        name: p?.display_name?.trim() || 'Housemate',
        avatarColor: p?.avatar_color || '#94a3b8',
        role: m.role,
        joinedAt: m.joined_at,
      };
    });
}

export function buildHouses(rows: HouseRow[], memberships: Pick<MemberRow, 'house_id' | 'role'>[]): House[] {
  const roles = new Map(memberships.map((m) => [m.house_id, m.role]));
  return rows
    .filter((h) => roles.has(h.id))
    .map((h) => ({ id: h.id, name: h.name, inviteCode: h.invite_code, createdAt: h.created_at, role: roles.get(h.id)! }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.createdAt.localeCompare(b.createdAt));
}

/** Sort: by due date (no due date always last), then by creation. */
export function compareChores(a: Chore, b: Chore, asc: boolean): number {
  if (a.dueDate !== b.dueDate) {
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    const d = a.dueDate.localeCompare(b.dueDate);
    return asc ? d : -d;
  }
  return a.createdAt.localeCompare(b.createdAt);
}

export function friendlyError(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const raw = (err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : typeof err === 'string' ? err : '') || '';
  const m = raw.toLowerCase();
  if (!m) return fallback;
  if (m.includes('invalid invite code')) return 'That invite code did not match a house. Check it and try again.';
  if (m.includes('not a member')) return 'You are no longer a member of this house.';
  if (m.includes('not signed in') || m.includes('jwt')) return 'Your session has ended. Please sign in again.';
  if (m.includes('failed to fetch') || m.includes('network') || m.includes('load failed')) return 'Could not reach the server. Check your connection and try again.';
  if (m.includes('row-level security') || m.includes('permission denied')) return 'You do not have permission to do that in this house.';
  if (m.includes('invalid login credentials')) return 'That email and password do not match an account.';
  if (m.includes('email not confirmed')) return 'Please confirm your email address first. Check your inbox for the link.';
  if (m.includes('user already registered')) return 'An account with that email already exists. Try signing in.';
  if (m.includes('password should be')) return raw;
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Please wait a moment and try again.';
  if (m.includes('same as the old') || m.includes('different from the old')) return 'Choose a password different from your current one.';
  return fallback;
}

/** Only the fields actually being changed; completed_at only when status changes. */
export function chorePatchToRow(patch: Partial<ChoreInput>, current: Pick<Chore, 'status' | 'completedAt'>, now: Date = new Date()) {
  const out: Record<string, string | null> = {};
  if (patch.title !== undefined) out.title = patch.title.trim();
  if (patch.description !== undefined) out.description = patch.description?.trim() || null;
  if (patch.assigneeId !== undefined) out.assignee_id = patch.assigneeId || null;
  if (patch.dueDate !== undefined) out.due_date = patch.dueDate || null;
  if (patch.status !== undefined && patch.status !== current.status) {
    out.status = statusToDb(patch.status);
    out.completed_at = completedAtFor(current, patch.status, now);
  }
  return out;
}
