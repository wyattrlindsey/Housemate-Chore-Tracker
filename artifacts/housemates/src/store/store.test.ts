import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseStoredData, STORAGE_KEY } from '../lib/stored-data';
import type { AppData } from '../lib/types';
import { StoreProvider, useStore } from './store';

const legacy: AppData = {
  version: 1,
  housemates: [{ id: 'legacy', name: 'Alex', avatarColor: '#0F766E' }],
  chores: [{
    id: 'old-chore',
    title: 'Keep this chore',
    description: 'Keep this note',
    assigneeId: 'legacy',
    status: 'In progress',
    dueDate: '2026-07-08',
    createdAt: '2026-07-01T12:00:00Z',
    completedAt: null,
  }],
};

/** Exercise the real browser store with memory storage and a server-rendered context consumer. */
function loadLegacyStore(t: TestContext) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const entries = new Map([[STORAGE_KEY, JSON.stringify(legacy)]]);
  const writes: string[] = [];
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => { writes.push(key); entries.set(key, value); },
    },
  });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  });
  let store: ReturnType<typeof useStore> | undefined;
  function Capture() { store = useStore(); return null; }
  renderToStaticMarkup(createElement(StoreProvider, null, createElement(Capture)));
  assert.ok(store);
  return { store, writes, saved: () => parseStoredData(entries.get(STORAGE_KEY)!) };
}

test('loading old data does not rewrite storage, reseed, or lose chores', (t) => {
  const { store, writes, saved } = loadLegacyStore(t);
  assert.deepEqual(store.housemates, legacy.housemates);
  assert.deepEqual(store.chores, legacy.chores);
  assert.equal(store.saveError, null);
  assert.deepEqual(writes, []);
  assert.deepEqual(saved(), legacy);
});

test('store adds and updates trimmed optional email, preserves it on unrelated edits, and clears it', (t) => {
  const { store, writes, saved } = loadLegacyStore(t);
  assert.equal(store.addHousemate('  Blair  ', '#C2410C', '  blair@example.com  '), true);
  assert.equal(saved().housemates[1].email, 'blair@example.com');
  assert.equal(saved().housemates[1].name, 'Blair');
  assert.equal(store.addHousemate('Casey', '#475569'), true);
  assert.equal(saved().housemates[2].email, undefined);
  assert.equal(store.updateHousemate('legacy', { email: '  alex@example.com  ' }), true);
  assert.equal(saved().housemates[0].email, 'alex@example.com');
  assert.equal(store.updateHousemate('legacy', { name: '  Alexandra  ' }), true);
  assert.equal(saved().housemates[0].email, 'alex@example.com');
  assert.equal(saved().housemates[0].name, 'Alexandra');
  assert.equal(store.updateHousemate('legacy', { email: '   ' }), true);
  assert.equal(saved().housemates[0].email, undefined);
  assert.equal(store.updateHousemate('legacy', { email: 'alex@example.com' }), true);
  assert.equal(store.updateHousemate('legacy', { email: undefined }), true);
  assert.equal(saved().housemates[0].email, undefined);
  assert.deepEqual(saved().chores, legacy.chores);
  assert.equal(saved().version, 1);
  assert.ok(writes.every((key) => key === 'housemates.data.v1'));
});

test('invalid email cannot overwrite legacy data', (t) => {
  const { store, writes, saved } = loadLegacyStore(t);
  assert.equal(store.addHousemate('Blair', '#C2410C', 'not-an-email'), false);
  assert.equal(store.updateHousemate('legacy', { email: 'alex@' }), false);
  assert.deepEqual(writes, []);
  assert.deepEqual(saved(), legacy);
});