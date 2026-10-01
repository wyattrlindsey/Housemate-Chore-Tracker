# Housemates

A browser-local chore organizer with list/calendar views and an optional server-side n8n email reminder relay.

## Run & Operate

- Managed workflow `artifacts/housemates: web` runs the app at `/`.
- `pnpm --filter @workspace/housemates run typecheck` — check the app's TypeScript
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Managed workflow `artifacts/api-server: API Server` serves `/api`.
- Email reminders require `N8N_WEBHOOK_URL` and `N8N_CHORE_KEY` secrets.
- The PostgreSQL database stores only the reminder cooldown, not chores or housemates.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- App: React, Vite, TypeScript, Tailwind CSS
- Persistence: browser localStorage
- Reminder API: Express 5, generated OpenAPI validation/client hooks, PostgreSQL cooldown.

## Where things live

- `artifacts/housemates/` — the application
- `docs/reminders.md` — n8n setup, payload contract, test-inbox instructions, and safety limitations

## Architecture decisions

- Chores and housemates (including optional emails) remain in localStorage. The user authorized a backend only for n8n forwarding and cooldown enforcement; there is still no login.
- Data belongs to each browser; do not imply synchronization between devices or people.
- Removing a housemate with assigned chores requires reassignment, preserving chore history.
- The reminder limit is app-wide because no verified household/user identity exists. Each forwarded attempt reserves an hour, including unconfirmed delivery, to prevent duplicate emails after timeout or partial sending.
- n8n's shared key authenticates the server, not app visitors. Restrict recipients before broad public sharing; browser-provided emails are not verified household membership.

## Product

Chore creation, editing, deletion, status changes, filtering and sorting; month/week calendar with due and completion dates; housemate management; confirmed email reminders for unfinished chores.

## User preferences

Calm neutral-and-teal styling, Inter typography, responsive desktop top navigation and mobile bottom tabs, accessible forms and controls.

## Gotchas

- Seed sample data only on first use; an intentionally empty saved list must stay empty.
- Due dates use local calendar dates; completion timestamps must be displayed on their local date.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
