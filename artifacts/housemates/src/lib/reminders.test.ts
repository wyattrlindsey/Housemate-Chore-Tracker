import assert from 'node:assert/strict';
import { test } from 'node:test';
import { todayKey } from './dates';
import { isValidEmail, normalizeEmail } from './email';
import { buildReminderPayload, reminderEmptyMessage } from './reminders';
import { parseStoredData, STORAGE_KEY } from './stored-data';
import type { AppData, Chore, Housemate } from './types';

function chore(id: string, assigneeId: string, dueDate = '2026-07-08', status: Chore['status'] = 'To-do'): Chore {
  return { id, title: `Chore ${id}`, assigneeId, dueDate, status, createdAt: '2026-07-01T12:00:00Z', completedAt: null };
}

const housemate: Housemate = { id: 'a', name: 'Alex', avatarColor: '#0F766E' };

test('version-one legacy data without email is preserved without a migration', () => {
  const legacy: AppData = { version: 1, housemates: [housemate], chores: [chore('old', 'a')] };
  assert.equal(STORAGE_KEY, 'housemates.data.v1');
  assert.deepEqual(parseStoredData(JSON.stringify(legacy)), legacy);
  assert.equal(parseStoredData(JSON.stringify(legacy)).housemates[0].email, undefined);
  assert.deepEqual(buildReminderPayload(legacy.housemates, legacy.chores), { triggeredBy: 'A housemate', reminders: [] });
});

test('saved optional emails survive the same version-one round trip', () => {
  const saved: AppData = { version: 1, housemates: [{ ...housemate, email: 'alex@example.com' }], chores: [chore('old', 'a')] };
  assert.deepEqual(parseStoredData(JSON.stringify(saved)), saved);
});

test('optional email is trimmed, blank can be cleared, and basic invalid formats are rejected', () => {
  assert.equal(normalizeEmail('  alex+home@example.com \n'), 'alex+home@example.com');
  assert.equal(normalizeEmail('  \n '), undefined);
  assert.equal(normalizeEmail(undefined), undefined);
  assert.equal(normalizeEmail(null), undefined);
  assert.equal(isValidEmail('alex+home@example.com'), true);
  for (const email of ['', 'alex', 'alex@', 'alex@example', 'alex@@example.com', 'alex @example.com', 'alex@example .com']) {
    assert.equal(isValidEmail(email), false, email);
  }
  assert.equal(isValidEmail(`${'a'.repeat(255)}@example.com`), false);
});

test('groups multiple assignees into the exact payload, omitting completed chores and private fields', () => {
  const people: Housemate[] = [
    { ...housemate, email: '  alex@example.com  ' },
    { id: 'b', name: 'Blair', avatarColor: '#C2410C', email: 'blair@example.com' },
  ];
  const chores = [
    { ...chore('past', 'a', '2026-07-07'), description: 'Private note' },
    chore('today', 'a'),
    chore('done', 'a', '2026-07-01', 'Completed'),
    chore('future', 'b', '2026-07-09', 'In progress'),
    chore('orphan', 'deleted'),
  ];
  const before = structuredClone({ people, chores });
  assert.deepEqual(buildReminderPayload(people, chores, '2026-07-08'), {
    triggeredBy: 'A housemate',
    reminders: [
      { name: 'Alex', email: 'alex@example.com', chores: [
        { title: 'Chore past', due: '2026-07-07', overdue: true },
        { title: 'Chore today', due: '2026-07-08', overdue: false },
      ] },
      { name: 'Blair', email: 'blair@example.com', chores: [
        { title: 'Chore future', due: '2026-07-09', overdue: false },
      ] },
    ],
  });
  assert.deepEqual({ people, chores }, before);
});

test('missing, blank, invalid emails and recipients without unfinished chores are omitted', () => {
  const people: Housemate[] = [
    housemate,
    { ...housemate, id: 'blank', email: '   ' },
    { ...housemate, id: 'bad', email: 'not-an-email' },
    { ...housemate, id: 'done', email: 'done@example.com' },
    { ...housemate, id: 'none', email: 'none@example.com' },
  ];
  const chores = [chore('a', 'a'), chore('blank', 'blank'), chore('bad', 'bad'), chore('done', 'done', '2026-07-01', 'Completed')];
  assert.deepEqual(buildReminderPayload(people, chores, '2026-07-08'), { triggeredBy: 'A housemate', reminders: [] });
});

test('default overdue comparison uses the local date, not the UTC date; today is not overdue', (t) => {
  const previousTZ = process.env.TZ;
  process.env.TZ = 'America/Los_Angeles';
  t.after(() => {
    if (previousTZ === undefined) delete process.env.TZ;
    else process.env.TZ = previousTZ;
  });
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-07-09T01:00:00Z').getTime() });
  assert.equal(todayKey(), '2026-07-08');
  const payload = buildReminderPayload([{ ...housemate, email: 'alex@example.com' }], [
    chore('yesterday', 'a', '2026-07-07'),
    chore('today', 'a', '2026-07-08'),
    chore('tomorrow', 'a', '2026-07-09'),
  ]);
  assert.deepEqual(payload.reminders[0].chores.map((item) => item.overdue), [true, false, false]);
  assert.deepEqual(payload.reminders[0].chores.map((item) => item.due), ['2026-07-07', '2026-07-08', '2026-07-09']);
});

test('friendly empty reasons distinguish no emails, all complete, and no eligible assignments', () => {
  assert.match(reminderEmptyMessage([housemate], [chore('a', 'a')])!, /Add an email address/);
  const people = [{ ...housemate, email: 'alex@example.com' }];
  assert.match(reminderEmptyMessage(people, [chore('done', 'a', '2026-07-01', 'Completed')])!, /No unfinished chores/);
  assert.match(reminderEmptyMessage(people, [chore('other', 'b')])!, /No eligible recipients/);
  assert.equal(reminderEmptyMessage(people, [chore('a', 'a')]), null);
});