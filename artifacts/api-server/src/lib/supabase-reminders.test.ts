import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { authorizeReminder, ReminderAccessError } from "./supabase-reminders";

function harness({ denied = false, badToken = false } = {}) {
  const lookups: string[] = [];
  const reads: { table: string; filters: [string, unknown][] }[] = [];
  const anchor = { id: "chore", house_id: "real-house", assignee_id: "recipient", status: "todo", title: "Dishes", due_date: null };
  const client = {
    auth: { getUser: async (token: string) => {
      assert.equal(token, "verified-token");
      return { data: { user: badToken ? null : { id: "sender" } }, error: badToken ? { status: 401 } : null };
    } },
    from(table: string) {
      const query = { table, filters: [] as [string, unknown][] };
      reads.push(query);
      const builder = {
        select() { return builder; },
        eq(column: string, value: unknown) { query.filters.push([column, value]); return builder; },
        neq() { return builder; },
        in() { return builder; },
        order() { return builder; },
        range() { return builder; },
        async maybeSingle() { return { data: denied ? null : anchor, error: null }; },
        then(resolve: (value: unknown) => unknown) {
          const data = table === "house_members" ? [{ user_id: "sender" }, { user_id: "recipient" }]
            : table === "profiles" ? [{ id: "sender", display_name: "Sender" }, { id: "recipient", display_name: "Recipient" }]
            : [anchor,
              { ...anchor, id: "unassigned", assignee_id: null },
              { ...anchor, id: "completed", status: "completed" },
              { ...anchor, id: "former-member", assignee_id: "outsider" }];
          return Promise.resolve({ data, error: null }).then(resolve);
        },
      };
      return builder;
    },
  };
  const settings = {
    url: "https://supabase.example.test",
    key: "test-public",
    secretKey: "test-server-only",
    makeClient: ((url, key, opts) => {
      assert.equal(url, "https://supabase.example.test");
      assert.equal(opts?.auth?.persistSession, false);
      if (key === "test-public") {
        assert.equal(opts?.global?.headers?.Authorization, "Bearer verified-token");
        return client;
      }
      assert.equal(key, "test-server-only");
      assert.equal(opts?.global?.headers?.Authorization, undefined);
      return {
        auth: { admin: { getUserById: async (id: string) => {
          lookups.push(id);
          return { data: { user: { email: "resolved@example.test" } }, error: null };
        } } },
      };
    }) as typeof createClient,
  };
  return { settings, reads, lookups };
}

test("RLS client reads the chore and house; only admin resolves email", async () => {
  const h = harness();
  const access = await authorizeReminder("verified-token", "chore", h.settings);
  assert.equal(access.houseId, "real-house");
  assert.deepEqual(h.lookups, []);
  const payload = await access.prepare(true, "UTC");
  assert.deepEqual(h.lookups, ["recipient"]);
  assert.deepEqual(payload, {
    triggeredBy: "Sender",
    reminders: [{
      name: "Recipient", email: "resolved@example.test",
      chores: [{ title: "Dishes", due: null, overdue: false }],
    }],
  });
  assert.deepEqual(h.reads[0], { table: "chores", filters: [["id", "chore"]] });
  assert.ok(h.reads.some((r) => r.table === "chores" && r.filters.some(([k, v]) => k === "house_id" && v === "real-house")));
});

test("Supabase denied reads return 403 before admin access", async () => {
  const h = harness({ denied: true });
  await assert.rejects(authorizeReminder("verified-token", "chore", h.settings),
    (e: unknown) => e instanceof ReminderAccessError && e.status === 403);
  assert.deepEqual(h.lookups, []);
});

test("Supabase rejected tokens return 401 before any database read", async () => {
  const h = harness({ badToken: true });
  await assert.rejects(authorizeReminder("verified-token", "chore", h.settings),
    (e: unknown) => e instanceof ReminderAccessError && e.status === 401);
  assert.deepEqual(h.reads, []);
  assert.deepEqual(h.lookups, []);
});
