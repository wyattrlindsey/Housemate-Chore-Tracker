import { Router, type IRouter, type Request, type Response } from "express";
import { SendRemindersBody } from "@workspace/api-zod";
import { createCooldownStore, type CooldownStore } from "../lib/reminder-cooldown";
import { getWebhookConfig, sendToWebhook, WebhookError, type WebhookConfig } from "../lib/n8n-reminders";
import { authorizeReminder, reminderIdentityConfigured, ReminderAccessError, type AuthorizedReminder } from "../lib/supabase-reminders";

interface Dependencies {
  cooldown: (houseId: string) => CooldownStore;
  config: () => WebhookConfig | null;
  identityConfigured: () => boolean;
  authorize: (token: string, choreId: string) => Promise<AuthorizedReminder>;
  send: typeof sendToWebhook;
}

function tokenFor(req: Request): string {
  const match = /^Bearer ([^\s]+)$/i.exec(req.get("Authorization") ?? "");
  if (!match || match[1].length > 8192) throw new ReminderAccessError(401, "Please sign in to use reminders.");
  return match[1];
}

function report(res: Response, error: unknown) {
  if (error instanceof ReminderAccessError) {
    res.status(error.status).json({ error: error.message });
  } else {
    // Never return Supabase/admin details, token, URL, or upstream error bodies.
    res.status(503).json({ error: "Reminder availability could not be checked. Please try again." });
  }
}

export function createReminderRouter(deps: Dependencies): IRouter {
  const router: IRouter = Router();
  router.use("/reminders", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.get("/reminders/status", async (req, res): Promise<void> => {
    try {
      const token = tokenFor(req);
      const input = SendRemindersBody.pick({ choreId: true }).safeParse({ choreId: req.query.choreId });
      if (!input.success) throw new ReminderAccessError(400, "Select a valid chore to check reminders.");
      const access = await deps.authorize(token, input.data.choreId);
      const state = await deps.cooldown(access.houseId).read();
      res.json({ configured: !!deps.config() && deps.identityConfigured(), ...state });
    } catch (error) {
      report(res, error);
    }
  });
  router.post("/reminders", async (req, res): Promise<void> => {
    try {
      const token = tokenFor(req);
      const input = SendRemindersBody.strict().safeParse(req.body);
      if (!input.success) throw new ReminderAccessError(400, "Please provide a chore ID, not recipient emails or chore contents.");
      const access = await deps.authorize(token, input.data.choreId);
      const config = deps.config();
      if (!config || !deps.identityConfigured()) {
        throw new ReminderAccessError(503, "Reminder emails aren't configured yet");
      }
      const store = deps.cooldown(access.houseId);
      // Resolve and validate recipients before reserving; never trust browser emails.
      const payload = await access.prepare(input.data.everyone ?? false, input.data.timeZone ?? "UTC");
      const state = await store.reserve();
      const timing = { nextAllowedAt: state.nextAllowedAt!, serverNow: state.serverNow };
      if (!state.acquired) {
        res.set("Retry-After", String(Math.max(1, Math.ceil(
          (Date.parse(timing.nextAllowedAt) - Date.parse(timing.serverNow)) / 1000,
        ))));
        res.status(429).json({ error: "Reminders can only be sent once an hour per house.", ...timing });
        return;
      }
      // Keep reservation after partial/unconfirmed delivery, including timeouts.
      try {
        const sent = await deps.send(config, payload, payload.reminders.length);
        res.json({ ok: true, sent, ...timing, serverNow: new Date().toISOString() });
      } catch (error) {
        const failure = error instanceof WebhookError ? error
          : new WebhookError(502, "The email workflow did not confirm delivery.");
        res.status(failure.status).json({
          error: `${failure.message} Reminders for this house are paused for an hour to avoid duplicate emails.`,
          ...timing, serverNow: new Date().toISOString(),
        });
      }
    } catch (error) {
      report(res, error);
    }
  });
  return router;
}

export default createReminderRouter({
  cooldown: (houseId) => createCooldownStore(`house:${houseId}`),
  config: getWebhookConfig,
  identityConfigured: reminderIdentityConfigured,
  authorize: authorizeReminder,
  send: sendToWebhook,
});
