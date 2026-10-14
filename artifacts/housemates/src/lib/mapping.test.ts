import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildHouses, buildHousemates, choreInputToRow, compareChores, completedAtFor, friendlyError, rowToChore, statusToDb, statusToUi, type ChoreRow } from './mapping.ts';
import { reminderAnchor, reminderEmptyMessage, reminderPreview } from './reminders.ts';
import type { Chore, Housemate } from './types.ts';

const row: ChoreRow = { id: 'c1', house_id: 'h1', title: 'Bins', description: null, assignee_id: null, status: 'in_progress', due_date: null, completed_at: null, created_at: '2026-01-01T00:00:00Z' };

test('status mapping round-trips', () => {
  assert.equal(statusToUi('todo'), 'To-do');
  assert.equal(statusToUi('in_progress'), 'In progress');
  assert.equal(statusToUi('completed'), 'Completed');
  assert.equal(statusToDb('In progress'), 'in_progress');
});

test('null assignee and due date are preserved, never faked', () => {
  const c = rowToChore(row);
  assert.equal(c.assigneeId, null);
  assert.equal(c.dueDate, null);
  assert.equal(c.description, undefined);
  const out = choreInputToRow({ title: ' X ', assigneeId: null, status: 'To-do', dueDate: null, description: '  ' }, null);
  assert.deepEqual(out, { title: 'X', description: null, assignee_id: null, status: 'todo', due_date: null, completed_at: null });
});

test('completed_at set on complete, preserved on edit, cleared on move back', () => {
  const now = new Date('2026-02-02T10:00:00Z');
  assert.equal(completedAtFor(null, 'Completed', now), now.toISOString());
  assert.equal(completedAtFor({ status: 'To-do', completedAt: null }, 'Completed', now), now.toISOString());
  assert.equal(completedAtFor({ status: 'Completed', completedAt: '2026-01-05T00:00:00Z' }, 'Completed', now), '2026-01-05T00:00:00Z');
  assert.equal(completedAtFor({ status: 'Completed', completedAt: '2026-01-05T00:00:00Z' }, 'In progress', now), null);
});

test('housemates join members and profiles in JS', () => {
  const hm = buildHousemates(
    [{ house_id: 'h', user_id: 'b', role: 'member', joined_at: '2026-01-02' }, { house_id: 'h', user_id: 'a', role: 'owner', joined_at: '2026-01-01' }],
    [{ id: 'a', display_name: 'Ana', avatar_color: '#111111' }],
  );
  assert.deepEqual(hm.map((h) => [h.id, h.name, h.role]), [['a', 'Ana', 'owner'], ['b', 'Housemate', 'member']]);
  const houses = buildHouses([{ id: 'h', name: 'Flat', invite_code: 'ABC', created_at: 'x' }, { id: 'z', name: 'Other', invite_code: 'Q', created_at: 'x' }], [{ house_id: 'h', role: 'owner' }]);
  assert.equal(houses.length, 1);
  assert.equal(houses[0].inviteCode, 'ABC');
});

test('no due date sorts last both ways', () => {
  const a = { ...rowToChore(row), id: 'a', dueDate: null } as Chore;
  const b = { ...rowToChore(row), id: 'b', dueDate: '2026-01-01' } as Chore;
  assert.deepEqual([a, b].sort((x, y) => compareChores(x, y, true)).map((c) => c.id), ['b', 'a']);
  assert.deepEqual([a, b].sort((x, y) => compareChores(x, y, false)).map((c) => c.id), ['b', 'a']);
});

test('friendly errors', () => {
  assert.match(friendlyError({ message: 'Invalid invite code' }), /invite code/);
  assert.match(friendlyError(new Error('Failed to fetch')), /connection/);
  assert.equal(friendlyError({ message: 'weird internal' }, 'fallback'), 'fallback');
});

test('reminder preview uses names and counts only; empty states', () => {
  const people: Housemate[] = [{ id: 'a', name: 'Ana', avatarColor: '#1', role: 'owner', joinedAt: '1' }, { id: 'b', name: 'Ben', avatarColor: '#2', role: 'member', joinedAt: '2' }];
  const base = rowToChore(row);
  assert.match(reminderEmptyMessage(people, [])!, /Add a chore/);
  assert.equal(reminderAnchor([]), null);
  assert.match(reminderEmptyMessage(people, [base])!, /no recipients/);
  const chores: Chore[] = [{ ...base, id: 'x', assigneeId: 'a' }, { ...base, id: 'y', assigneeId: 'a', status: 'Completed' }, { ...base, id: 'z', assigneeId: 'b' }];
  assert.deepEqual(reminderPreview(people, chores), [{ id: 'a', name: 'Ana', count: 1 }, { id: 'b', name: 'Ben', count: 1 }]);
  assert.equal(reminderEmptyMessage(people, chores), null);
});

test('patch sends only changed fields; completed_at only with status change', async () => {
  const { chorePatchToRow } = await import('./mapping.ts');
  const now = new Date('2026-03-03T00:00:00Z');
  assert.deepEqual(chorePatchToRow({ status: 'Completed' }, { status: 'To-do', completedAt: null }, now), { status: 'completed', completed_at: now.toISOString() });
  assert.deepEqual(chorePatchToRow({ status: 'Completed', title: 'T' }, { status: 'Completed', completedAt: 'x' }, now), { title: 'T' });
  assert.deepEqual(chorePatchToRow({ status: 'To-do' }, { status: 'Completed', completedAt: 'x' }, now), { status: 'todo', completed_at: null });
});
