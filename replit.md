# Housemates

A shared chore organizer with list/calendar views, Supabase authentication and
persistence, and an optional authenticated n8n reminder relay.

## Run & operate

- `artifacts/housemates: web` serves the React/Vite app at `/`.
- `artifacts/api-server: API Server` serves the reminder API at `/api`.
- `pnpm run typecheck` checks all workspace packages.
- `PORT=19649 BASE_PATH=/ pnpm --filter @workspace/housemates run build` builds the frontend.
- `pnpm --filter @workspace/api-server run build` builds the API.
- `pnpm --filter @workspace/api-spec run codegen` regenerates reminder API clients/validation.
- `docs/reminders.md` documents secrets, n8n, authorization and testing.

## Architecture and constraints

- Supabase Auth handles email/password sign-up, sign-in, sign-out and password
  recovery. Signup sends user metadata `display_name`. Do not add Replit Auth.
- One browser Supabase client uses `import.meta.env.VITE_SUPABASE_URL` and
  `import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY`. Supabase persists the auth
  session across reloads. Chores and members are no longer browser-local.
- Supabase stores `houses`, `house_members`, `profiles`, and `chores`.
  `supabase/schema.sql` is the user-provided **reference only**, already applied.
  Never execute it or change tables/RLS/functions without explicit authorization.
- House creation/joining use `create_house({house_name})` and `join_house({code})`.
- Leaving must use `leave_house({h})`, never direct membership deletion. Confirm
  first: the RPC unassigns chores, transfers ownership to the longest-standing
  remaining member, or deletes the house and chores if its last member leaves.
- Members are joined with profiles by user ID in the app; the supplied schema
  has no direct foreign-key relationship between these two tables.
- Users edit only their own display name and avatar color. No manual housemate
  creation/removal or housemate email entry.
- Chores are scoped to the selected `house_id`; RLS enforces access. Database
  statuses are `todo`, `in_progress`, `completed`. Clear `completed_at` on
  reopening; preserve it for unrelated edits to a completed chore.
- Unassigned chores and missing due dates are valid. Do not invent placeholder
  assignees or dates. Date-only values must stay local calendar dates.
- Supabase Realtime refreshes house chores. Switching house or signing out
  clears old data/subscriptions; asynchronous responses must not leak stale data.
- No sample-data seeding. Legacy localStorage records remain untouched and are
  not automatically imported. App data does not use Replit Postgres.
- **Explicit exception:** the existing Replit Postgres table stores reminder
  cooldowns only, independently per verified house. No Supabase cooldown table.
- Reminder requests use a Supabase bearer token and chore ID, not browser emails.
  RLS authorizes the chore; a server-only `SUPABASE_SECRET_KEY` client resolves
  auth emails. Never expose that key in frontend code or log credentials.
- Reserve the house cooldown before sending. Keep the one-hour reservation
  after errors/timeouts to avoid duplicate emails after partial delivery.

## Supabase dashboard setup

Configure Auth redirect allowlists for the development and published app origins
and the app's password-recovery URL. Use the actual published URL, not the
workspace preview URL, for production. Email confirmation and recovery email
delivery depend on the Supabase project's Auth/email settings. The supplied
schema already adds chores to the Realtime publication; do not reapply it.

## Product and style

Preserve the existing calm neutral-and-teal design, Inter typography, responsive
navigation, list and calendar views, filters and accessible empty states.
Accounts without a house see create/join onboarding. House settings contains
the invite code, copy action, member roster, own-profile editing and leave flow.
