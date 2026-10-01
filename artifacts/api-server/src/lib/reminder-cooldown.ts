import { pool } from "@workspace/db";

export interface CooldownState {
  nextAllowedAt: string | null;
  serverNow: string;
}

export interface CooldownStore {
  read(): Promise<CooldownState>;
  reserve(): Promise<(CooldownState & { acquired: boolean })>;
}

// A single atomic UPSERT prevents concurrent requests/instances from both sending.
// The reservation survives process restarts and is never keyed by user-supplied data.
export function createCooldownStore(scope = "housemates"): CooldownStore {
  async function read(): Promise<CooldownState> {
    const { rows } = await pool.query(
      `SELECT (SELECT next_allowed_at FROM reminder_cooldowns WHERE scope = $1) AS next_allowed_at,
              clock_timestamp() AS server_now`,
      [scope],
    );
    return {
      nextAllowedAt: rows[0].next_allowed_at?.toISOString() ?? null,
      serverNow: rows[0].server_now.toISOString(),
    };
  }

  return {
    read,
    async reserve() {
      const { rows } = await pool.query(
        `INSERT INTO reminder_cooldowns (scope, next_allowed_at)
         VALUES ($1, clock_timestamp() + interval '1 hour')
         ON CONFLICT (scope) DO UPDATE
           SET next_allowed_at = clock_timestamp() + interval '1 hour'
           WHERE reminder_cooldowns.next_allowed_at <= clock_timestamp()
         RETURNING next_allowed_at, clock_timestamp() AS server_now`,
        [scope],
      );
      if (!rows.length) return { ...(await read()), acquired: false };
      return {
        acquired: true,
        nextAllowedAt: rows[0].next_allowed_at.toISOString(),
        serverNow: rows[0].server_now.toISOString(),
      };
    },
  };
}