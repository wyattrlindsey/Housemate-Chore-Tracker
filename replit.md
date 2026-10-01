# Housemates

A frontend-only app for housemates to organize chores in list and calendar views.

## Run & Operate

- Managed workflow `artifacts/housemates: web` runs the app at `/`.
- `pnpm --filter @workspace/housemates run typecheck` — check the app's TypeScript
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Housemates requires no database, credentials, or external integrations.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- App: React, Vite, TypeScript, Tailwind CSS
- Persistence: browser localStorage
- API/database packages are unused starter infrastructure, not part of this product.

## Where things live

- `artifacts/housemates/` — the application

## Architecture decisions

- Keep this app frontend-only: the user explicitly requested no backend and no login.
- Data belongs to each browser; do not imply synchronization between devices or people.
- Removing a housemate with assigned chores requires reassignment, preserving chore history.

## Product

Chore creation, editing, deletion, status changes, filtering and sorting; month/week calendar with due and completion dates; housemate management.

## User preferences

Calm neutral-and-teal styling, Inter typography, responsive desktop top navigation and mobile bottom tabs, accessible forms and controls.

## Gotchas

- Seed sample data only on first use; an intentionally empty saved list must stay empty.
- Due dates use local calendar dates; completion timestamps must be displayed on their local date.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
