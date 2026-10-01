import assert from "node:assert/strict";
import { after, test } from "node:test";
import { once } from "node:events";
import express from "express";
import { pool } from "@workspace/db";
import type { ReminderStatus, ReminderError, ReminderResult } from "@workspace/api-zod";
import { createCooldownStore, type CooldownStore } from "./reminder-cooldown";
import { createReminderRouter } from "../routes/reminders";
import { sendToWebhook, WebhookError } from "./n8n-reminders";

type JsonReminderResult = Omit<ReminderResult, "nextAllowedAt" | "serverNow"> & {
  nextAllowedAt: string;
  serverNow: string;
};

const fixture = {
  triggeredBy: "A housemate",
  reminders: [{
    name: "Test housemate",
    email: "test@example.com",
    chores: [{ title: "Dishes", due: "2026-10-01", overdue: false }],
  }],
};
const config = { url: "https://workflow.example.test/webhook/chores", key: "test-key-not-a-real-secret" };

function memoryCooldown(): CooldownStore {
  let nextAllowedAt: string | null = null;
  return {
    async read() { return { nextAllowedAt, serverNow: new Date().toISOString() }; },
    async reserve() {
      const acquired = !nextAllowedAt || Date.parse(nextAllowedAt) <= Date.now();
      if (acquired) nextAllowedAt = new Date(Date.now() + 3_600_000).toISOString();
      return { acquired, nextAllowedAt, serverNow: new Date().toISOString() };
    },
  };
}

async function withApi(
  deps: Parameters<typeof createReminderRouter>[0],
  run: (base: string) => Promise<void>,
) {
  const app = express().use(express.json()).use("/api", createReminderRouter(deps));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  try {
    await run(`http://127.0.0.1:${address.port}/api`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

const post = (base: string, body: unknown = fixture) =>
  fetch(`${base}/reminders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

test("missing configuration returns useful error without reserving or sending", async () => {
  const cooldown = memoryCooldown();
  await withApi({ cooldown, config: () => null, send: async () => { throw Error("must not send"); } }, async (base) => {
    const status = await (await fetch(`${base}/reminders/status`)).json() as ReminderStatus;
    assert.equal(status.configured, false);
    const response = await post(base);
    assert.equal(response.status, 503);
    assert.equal((await response.json() as ReminderError).error, "Reminder emails aren't configured yet");
    assert.equal((await cooldown.read()).nextAllowedAt, null);
  });
});

test("valid input is forwarded unchanged, upstream sent count used, repeat request blocked", async () => {
  let sends = 0;
  await withApi({
    cooldown: memoryCooldown(), config: () => config,
    send: async (_config, body) => { sends++; assert.deepEqual(body, fixture); return 0; },
  }, async (base) => {
    const response = await post(base);
    assert.equal(response.status, 200);
    const result = await response.json() as JsonReminderResult;
    assert.equal(result.sent, 0);
    assert.equal(result.ok, true);
    assert.ok(Date.parse(result.nextAllowedAt) > Date.now());
    const again = await post(base);
    assert.equal(again.status, 429);
    assert.ok(Number(again.headers.get("Retry-After")) > 0);
    assert.equal((await again.json() as ReminderError).nextAllowedAt, result.nextAllowedAt);
    assert.equal(sends, 1);
  });
});

test("invalid/empty requests never reserve or send", async () => {
  const cooldown = memoryCooldown();
  await withApi({ cooldown, config: () => config, send: async () => { throw Error("must not send"); } }, async (base) => {
    for (const body of [
      {},
      { ...fixture, reminders: [] },
      { ...fixture, reminders: [{ ...fixture.reminders[0], email: "not-an-email" }] },
      { ...fixture, reminders: [{ ...fixture.reminders[0], chores: [] }] },
      { ...fixture, reminders: [{ ...fixture.reminders[0], chores: [{ title: "Dishes", due: "2026-02-30", overdue: false }] }] },
      { ...fixture, triggeredBy: " " },
    ]) assert.equal((await post(base, body)).status, 400);
    assert.equal((await cooldown.read()).nextAllowedAt, null);
  });
});

test("concurrent requests deliver one blast only", async () => {
  let calls = 0;
  await withApi({
    cooldown: memoryCooldown(), config: () => config,
    send: async () => { calls++; await new Promise((resolve) => setTimeout(resolve, 30)); return 1; },
  }, async (base) => {
    const responses = await Promise.all(Array.from({ length: 5 }, () => post(base)));
    assert.deepEqual(responses.map((r) => r.status).sort(), [200, 429, 429, 429, 429]);
    assert.equal(calls, 1);
  });
});

test("unconfirmed delivery retains cooldown to avoid duplicate emails", async () => {
  await withApi({
    cooldown: memoryCooldown(), config: () => config,
    send: async () => { throw new WebhookError(504, "The email workflow timed out."); },
  }, async (base) => {
    const response = await post(base);
    assert.equal(response.status, 504);
    const data = await response.json() as ReminderError;
    assert.match(data.error, /avoid duplicate emails/);
    assert.ok(data.nextAllowedAt);
    assert.equal((await post(base)).status, 429);
  });
});

test("cooldown storage failure fails closed", async () => {
  const fail = async (): Promise<never> => { throw Error("database unavailable"); };
  await withApi({
    cooldown: { read: fail, reserve: fail }, config: () => config,
    send: async () => { throw Error("must not send"); },
  }, async (base) => {
    assert.equal((await fetch(`${base}/reminders/status`)).status, 503);
    assert.equal((await post(base)).status, 503);
  });
});

test("webhook sends JSON and secret header server-side; no redirects", async () => {
  const mockFetch: typeof fetch = async (url, init) => {
    assert.equal(url, config.url);
    assert.equal(init?.redirect, "error");
    assert.equal(init?.method, "POST");
    assert.deepEqual(init?.headers, { "Content-Type": "application/json", "X-Chore-Key": config.key });
    assert.deepEqual(JSON.parse(init?.body as string), fixture);
    return Response.json({ ok: true, sent: 1 });
  };
  assert.equal(await sendToWebhook(config, fixture, 1, mockFetch), 1);
});

test("webhook rejects non-success, invalid JSON, invalid counts and oversized responses", async () => {
  for (const response of [
    Response.json({ error: "private upstream error" }, { status: 401 }),
    new Response("Not JSON"),
    Response.json({ ok: false, sent: 0 }),
    Response.json({ ok: true, sent: -1 }),
    Response.json({ ok: true, sent: 2 }),
    Response.json({ ok: true, sent: "1" }),
    new Response(" ".repeat(20_000)),
  ]) {
    await assert.rejects(
      sendToWebhook(config, fixture, 1, async () => response),
      (error: unknown) => error instanceof WebhookError && error.status === 502 && !error.message.includes("private upstream"),
    );
  }
});

test("webhook network/timeout errors don't leak secrets", async () => {
  for (const name of ["Error", "TimeoutError"]) {
    await assert.rejects(sendToWebhook(config, fixture, 1, async () => {
      const error = new Error(`${config.url} ${config.key}`);
      error.name = name;
      throw error;
    }), (error: unknown) => error instanceof WebhookError
      && error.status === (name === "TimeoutError" ? 504 : 502)
      && !error.message.includes(config.key));
  }
});

test("database cooldown is atomic across store instances and survives recreation", async () => {
  const scope = `test-${crypto.randomUUID()}`;
  try {
    const results = await Promise.all(Array.from({ length: 6 }, () => createCooldownStore(scope).reserve()));
    assert.equal(results.filter((result) => result.acquired).length, 1);
    const state = await createCooldownStore(scope).read();
    assert.ok(state.nextAllowedAt);
    assert.ok(Date.parse(state.nextAllowedAt) - Date.parse(state.serverNow) > 3_590_000);
    assert.equal((await createCooldownStore(scope).reserve()).acquired, false);
    await pool.query("UPDATE reminder_cooldowns SET next_allowed_at = now() - interval '1 second' WHERE scope = $1", [scope]);
    assert.equal((await createCooldownStore(scope).reserve()).acquired, true);
  } finally {
    await pool.query("DELETE FROM reminder_cooldowns WHERE scope = $1", [scope]);
  }
});

after(async () => { await pool.end(); });