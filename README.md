# Housemates — Chore Tracker

A shared chore tracker for people who live together. Housemates sign up, create or join a house with an invite code, and keep one shared list of chores — who's doing what, what's in progress, and what's done — with a calendar of due dates and completions.

**Live app:** https://housemate-chore-tracker.replit.app

## Features

- **Accounts** — email/password sign-up, sign-in, and password reset (Supabase Auth)
- **Houses** — create a house, invite housemates with an 8-character code, switch between houses, leave a house
- **Chores** — create, edit, and delete chores with a title, description, assignee, and due date
- **Statuses** — To-do, In progress, Completed; completion time is recorded automatically
- **List view** — filter by status or housemate, sort by due date, overdue chores highlighted
- **Calendar view** — month and week views showing due dates and completion dates, color-coded by assignee
- **Live updates** — changes from housemates appear instantly without refreshing
- **Email reminders** — remind a housemate (or everyone) about unfinished chores via an n8n workflow, limited to once per hour per house
- **Responsive** — top navigation on desktop, bottom tabs on mobile

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind CSS, Radix UI, TanStack Query, wouter |
| Auth & data | Supabase (Auth, Postgres with Row Level Security, Realtime) |
| Reminder API | Node.js, Express 5, OpenAPI-generated client and Zod validation |
| Reminder cooldowns | Replit PostgreSQL via Drizzle ORM |
| Email delivery | n8n webhook workflow |
| Hosting | Replit |
| Tooling | pnpm workspaces, TypeScript 5.9, Node.js 24 |

## Project structure

```
artifacts/
  housemates/        React/Vite web app (served at /)
  api-server/        Express reminder API (served at /api)
lib/
  api-spec/          OpenAPI spec for the reminder API
  api-client-react/  Generated React Query hooks
  api-zod/           Generated Zod schemas
  db/                Drizzle schema for the reminder cooldown table
docs/
  reminders.md       n8n setup, API contract, and reminder testing
supabase/
  schema.sql         Supabase tables, RLS policies, and RPC functions (reference)
scripts/             Workspace scripts and tests
```

## How it works

All app data — users, profiles, houses, memberships, and chores — lives in Supabase. Row Level Security ensures a user can only read or change chores in houses they belong to. Houses are created, joined, and left only through database functions (`create_house`, `join_house`, `leave_house`), so an invite code is the only way into a house.

The reminder API verifies the caller's Supabase session, confirms they can access the chore, looks up recipients' emails server-side, and forwards the reminder to n8n. Email addresses are never sent to the browser. The only data stored outside Supabase is the per-house reminder cooldown, kept in Replit's PostgreSQL database.

## Setup

### 1. Supabase

1. Create a Supabase project.
2. In the **SQL Editor**, run [`supabase/schema.sql`](supabase/schema.sql) once. It creates the tables, security policies, signup trigger, house functions, and enables Realtime for chores.
3. Under **Authentication → URL Configuration**, set the **Site URL** to your published app URL and add your development preview URL and `/reset-password` path to **Redirect URLs**.
4. Under **Authentication → Sign In / Providers**, make sure email sign-up is enabled. For production, configure custom SMTP under **Authentication → Emails** — Supabase's built-in email sender is heavily rate-limited.

### 2. Environment variables

Add these as **Replit Secrets** (both in the workspace and on the deployment):

| Variable | Used by | Description |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Frontend + API | Project URL, e.g. `https://abcdefgh.supabase.co` (nothing after `.co`) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Frontend + API | Publishable key (`sb_publishable_…`); safe for the browser |
| `SUPABASE_SECRET_KEY` | API only | Secret key (`sb_secret_…`) for looking up recipient emails. **Never** prefix with `VITE_` |
| `N8N_WEBHOOK_URL` | API only | HTTPS webhook URL of the n8n reminder workflow |
| `N8N_CHORE_KEY` | API only | Shared secret matching the n8n `X-Chore-Key` header auth |
| `DATABASE_URL` | API only | Replit PostgreSQL connection string (provided automatically by Replit) |

The reminder variables are optional — the rest of the app works without them. See [`docs/reminders.md`](docs/reminders.md) for the n8n workflow setup.

### 3. Run

On Replit, the app starts automatically with two workflows: the web app at `/` and the API server at `/api`.

Useful commands:

```sh
pnpm install                                        # install dependencies (pnpm only)
pnpm run typecheck                                  # typecheck all packages
pnpm run build                                      # typecheck and build everything
pnpm --filter @workspace/api-spec run codegen       # regenerate API hooks and schemas
pnpm --filter @workspace/db run push                # push cooldown table schema (dev only)
```

### 4. Deploy

Publish from Replit. The frontend reads the `VITE_` variables at build time, so **republish after changing them**.

## Testing checklist

1. Sign up — a user appears in Supabase **Authentication → Users** and a row in `profiles`.
2. Create a house — a row in `houses` and an `owner` row in `house_members`.
3. Add a chore — it appears in `chores` and persists after a reload.
4. Join from a second account in a private window — changing a chore in one window updates the other live.
5. A third account that hasn't joined sees no chores.
6. Leave the house — the leaver's chores become unassigned.
7. Send a reminder — it arrives at the assignee's email; a second within the hour is blocked.

Automated reminder tests are described in [`docs/reminders.md`](docs/reminders.md#automated-checks).

## Security notes

- The publishable key is meant to be public; data is protected by Row Level Security.
- `SUPABASE_SECRET_KEY` bypasses Row Level Security. Keep it in server-only secrets, never in code, chat, or screenshots. Rotate it in Supabase if exposed.
- Replit Secrets are not committed to Git. Don't commit `.env` files.