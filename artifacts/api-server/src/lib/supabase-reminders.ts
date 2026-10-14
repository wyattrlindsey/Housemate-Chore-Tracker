import { createClient } from "@supabase/supabase-js";

export class ReminderAccessError extends Error {
  constructor(public readonly status: 400 | 401 | 403 | 503, message: string) {
    super(message);
  }
}

export interface ReminderPayload {
  triggeredBy: string;
  reminders: {
    name: string;
    email: string;
    chores: { title: string; due: string | null; overdue: boolean }[];
  }[];
}

export interface AuthorizedReminder {
  houseId: string;
  prepare(everyone: boolean, timeZone: string): Promise<ReminderPayload>;
}

interface ChoreRow {
  id: string;
  house_id: string;
  assignee_id: string | null;
  status: string;
  title: string;
  due_date: string | null;
}

const options = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: {
    fetch: (input: Parameters<typeof fetch>[0], init?: RequestInit) =>
      fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }),
  },
};

export function reminderIdentityConfigured(): boolean {
  return !!(process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_PUBLISHABLE_KEY && process.env.SUPABASE_SECRET_KEY);
}

export function localDate(timeZone: string, now = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(now);
    const get = (type: string) => parts.find((p) => p.type === type)!.value;
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch {
    throw new ReminderAccessError(400, "Please provide a valid time zone.");
  }
}

// This client is request-scoped and uses the caller's JWT, never the admin key.
// getUser verifies the JWT with Supabase; the chore read is protected by RLS.
export async function authorizeReminder(
  token: string,
  choreId: string,
  settings = {
    url: process.env.VITE_SUPABASE_URL,
    key: process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    secretKey: process.env.SUPABASE_SECRET_KEY,
    makeClient: createClient,
  },
): Promise<AuthorizedReminder> {
  const { url, key } = settings;
  if (!url || !key) throw new ReminderAccessError(503, "Sign-in verification isn't configured yet.");
  const client = settings.makeClient(url, key, {
    ...options, global: { ...options.global, headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: auth, error: authError } = await client.auth.getUser(token);
  if (authError || !auth.user) {
    if (authError && (authError.status ?? 0) >= 500) {
      throw new ReminderAccessError(503, "Sign-in could not be verified. Please try again.");
    }
    throw new ReminderAccessError(401, "Please sign in again to send reminders.");
  }
  const { data: chore, error } = await client.from("chores")
    .select("id,house_id,assignee_id,status,title,due_date").eq("id", choreId).maybeSingle();
  if (error || !chore) throw new ReminderAccessError(403, "You don't have access to this chore.");
  const anchor = chore as ChoreRow;

  return {
    houseId: anchor.house_id,
    async prepare(everyone, timeZone) {
      const today = localDate(timeZone);
      const adminKey = settings.secretKey;
      if (!adminKey) throw new ReminderAccessError(503, "Reminder emails aren't configured yet");
      // All chore/profile/member reads still use the user's RLS-protected client.
      // Only email lookup uses the separate server-only admin client.
      const admin = settings.makeClient(url, adminKey, options);
      let rows: ChoreRow[] = [];
      if (everyone) {
        for (let offset = 0; ; offset += 500) {
          const result = await client.from("chores").select("id,house_id,assignee_id,status,title,due_date")
            .eq("house_id", anchor.house_id).neq("status", "completed")
            .order("id").range(offset, offset + 499);
          if (result.error) throw new ReminderAccessError(503, "House chores could not be loaded. Please try again.");
          rows.push(...(result.data as ChoreRow[]));
          if (rows.length > 10_000) throw new ReminderAccessError(400, "Too many chores for one reminder request.");
          if (result.data.length < 500) break;
        }
      } else {
        rows = [anchor];
      }
      const memberResult = await client.from("house_members").select("user_id").eq("house_id", anchor.house_id);
      if (memberResult.error) throw new ReminderAccessError(503, "House members could not be loaded. Please try again.");
      const members = new Set(memberResult.data.map((m) => m.user_id as string));
      if (!members.has(auth.user.id)) throw new ReminderAccessError(403, "You no longer belong to this house.");
      const grouped = new Map<string, ChoreRow[]>();
      for (const row of rows) {
        if (row.status === "completed" || !row.assignee_id || !members.has(row.assignee_id)) continue;
        grouped.set(row.assignee_id, [...(grouped.get(row.assignee_id) ?? []), row]);
      }
      if (!grouped.size) throw new ReminderAccessError(400, "There are no unfinished assigned chores to remind anyone about.");
      if (grouped.size > 50) throw new ReminderAccessError(400, "Too many recipients for one reminder request.");
      const profileResult = await client.from("profiles").select("id,display_name")
        .in("id", [...new Set([auth.user.id, ...grouped.keys()])]);
      if (profileResult.error) throw new ReminderAccessError(503, "Housemate names could not be loaded. Please try again.");
      const names = new Map(profileResult.data.map((p) => [p.id, p.display_name]));
      const reminders: ReminderPayload["reminders"] = [];
      for (const [id, chores] of grouped) {
        const result = await admin.auth.admin.getUserById(id);
        if (result.error || !result.data.user?.email) {
          throw new ReminderAccessError(503, "A housemate's reminder email could not be resolved. No reminders were sent.");
        }
        reminders.push({
          name: names.get(id) || "Housemate",
          email: result.data.user.email,
          chores: chores.map((c) => ({ title: c.title, due: c.due_date, overdue: !!c.due_date && c.due_date < today })),
        });
      }
      return { triggeredBy: names.get(auth.user.id) || "A housemate", reminders };
    },
  };
}
