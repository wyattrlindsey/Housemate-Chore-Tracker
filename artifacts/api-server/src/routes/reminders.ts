import { Router, type IRouter } from "express";
import { GetReminderStatusResponse, SendRemindersBody, SendRemindersResponse } from "@workspace/api-zod";
import { createCooldownStore, type CooldownStore } from "../lib/reminder-cooldown";
import { getWebhookConfig, sendToWebhook, WebhookError, type WebhookConfig } from "../lib/n8n-reminders";

interface Dependencies {
  cooldown: CooldownStore;
  config: () => WebhookConfig | null;
  send: typeof sendToWebhook;
}

function validCalendarDate(value: string): boolean {
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function createReminderRouter(deps: Dependencies): IRouter {
  const router: IRouter = Router();
  router.use("/reminders", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  router.get("/reminders/status", async (req, res): Promise<void> => {
    const configured = !!deps.config();
    try {
      const state = await deps.cooldown.read();
      res.json(GetReminderStatusResponse.parse({ configured, ...state }));
    } catch {
      // Config problems remain understandable even before DB schema setup.
      if (!configured) {
        res.json({ configured: false, nextAllowedAt: null, serverNow: new Date().toISOString() });
        return;
      }
      req.log?.error("Reminder cooldown storage unavailable");
      res.status(503).json({ error: "Reminder availability could not be checked. Please try again." });
    }
  });

  router.post("/reminders", async (req, res): Promise<void> => {
    const config = deps.config();
    if (!config) {
      res.status(503).json({ error: "Reminder emails aren't configured yet" });
      return;
    }
    const input = SendRemindersBody.safeParse(req.body);
    if (
      !input.success ||
      !input.data.triggeredBy.trim() ||
      input.data.reminders.some((recipient) =>
        !recipient.name.trim() ||
        recipient.chores.some((chore) => !chore.title.trim() || !validCalendarDate(chore.due)),
      )
    ) {
      res.status(400).json({ error: "Please provide valid housemate emails and unfinished chores with valid due dates." });
      return;
    }

    let state;
    try {
      state = await deps.cooldown.reserve();
    } catch {
      req.log?.error("Reminder cooldown reservation failed");
      res.status(503).json({ error: "Reminders could not be sent safely. Please try again." });
      return;
    }
    const timing = { nextAllowedAt: state.nextAllowedAt!, serverNow: state.serverNow };
    if (!state.acquired) {
      res.set("Retry-After", String(Math.max(1, Math.ceil(
        (Date.parse(timing.nextAllowedAt) - Date.parse(timing.serverNow)) / 1000,
      ))));
      res.status(429).json({ error: "Reminders can only be sent once an hour.", ...timing });
      return;
    }
    // Keep reservation even on errors: n8n may have sent mail before losing its
    // response. Releasing it could duplicate email or enable repeated blasts.
    try {
      const sent = await deps.send(config, input.data, input.data.reminders.length);
      res.json(SendRemindersResponse.parse({ ok: true, sent, ...timing, serverNow: new Date().toISOString() }));
    } catch (error) {
      req.log?.warn("Reminder workflow did not confirm delivery");
      const failure = error instanceof WebhookError
        ? error
        : new WebhookError(502, "The email workflow did not confirm delivery.");
      res.status(failure.status).json({
        error: `${failure.message} Reminders are paused for an hour to avoid duplicate emails.`,
        ...timing,
        serverNow: new Date().toISOString(),
      });
    }
  });
  return router;
}

export default createReminderRouter({
  cooldown: createCooldownStore(),
  config: getWebhookConfig,
  send: sendToWebhook,
});