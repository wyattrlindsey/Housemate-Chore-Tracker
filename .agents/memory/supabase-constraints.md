---
name: Supabase migration constraints
description: User requirements for persistence and authentication migration.
---

Use Supabase Auth and Supabase persistence, not Replit Auth or the Replit Postgres database for app data. The user states that the Supabase schema, RLS policies, and RPC functions already exist; do not create or change tables.

**Why:** The user explicitly requested this architecture and scope.

**How to apply:** Obtain the existing schema contract before wiring data operations; preserve the existing design, list/calendar views, filters, and empty states. Remove sample-data seeding and manual housemate creation in favor of house membership.
