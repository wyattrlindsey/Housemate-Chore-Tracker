---
name: Date-only API contracts
description: Generated Zod date handling can change webhook payload values and server-side response types.
---

Keep calendar-only webhook values as validated YYYY-MM-DD strings, not Date objects.

**Why:** In this workspace's Orval configuration, OpenAPI `format: date` generates `zod.coerce.date()`. Parsing then forwarding a reminder payload silently changes a due date into an ISO timestamp. Date-time response types also differ between server validation (Date) and raw JSON/client data (string).

**How to apply:** Use a string pattern plus real-calendar validation when forwarding date-only values. After codegen changes, check the actual generated coercions and test the exact serialized payload. In HTTP tests, model raw JSON timestamps as strings rather than using Date-bearing server types directly.