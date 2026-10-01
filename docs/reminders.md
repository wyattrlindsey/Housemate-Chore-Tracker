# n8n chore reminders

## Configuration

Set these **Replit Secrets**, not frontend environment variables:

- `N8N_WEBHOOK_URL`: the HTTPS production webhook URL of your active n8n workflow.
- `N8N_CHORE_KEY`: a long random secret matching n8n's Header Auth credential.

In n8n, configure a POST Webhook node with **Header Auth** using header name
`X-Chore-Key` and the same secret value. Set its response mode to use a
**Respond to Webhook** node. Send emails using your chosen email-provider node,
then respond with JSON `{ "ok": true, "sent": 2 }`, where `sent` is the number of
housemates whose reminder was actually sent, not the number of chores. Do not
return n8n's default "Workflow was started" response: the app needs the final count.

The app waits up to 15 seconds for this response. If delivery takes longer, it
reports unconfirmed delivery and keeps the cooldown; check the n8n execution.
No automatic retries are made.

## Payload

The webhook receives a JSON object:

```json
{
  "triggeredBy": "A housemate",
  "reminders": [
    {
      "name": "Example housemate",
      "email": "test@example.com",
      "chores": [
        { "title": "Clean the kitchen", "due": "2026-10-01", "overdue": true }
      ]
    }
  ]
}
```

The Webhook node exposes this as `body`. Split `body.reminders` into items, send
one email per item, and include each item's chore list. Use plain text or escape
names/titles when generating HTML email. The `overdue` flag is computed in the
sender's browser using its local date; chores due today are not overdue.

No housemate is identified as the current user in this app, so `triggeredBy`
is always `A housemate`. Existing housemates without an email remain valid and
are skipped, as are housemates with no unfinished chores.

## Testing with your own inbox

1. Add your own email to one test housemate with an unfinished chore.
2. Leave other emails blank if you want only your inbox to receive a reminder.
3. For n8n's test webhook URL, first start its test listener; for ongoing use,
   use the active workflow's production webhook URL.
4. Click **Remind everyone**, check the recipient list, and confirm.
5. Check the n8n execution and your inbox. The success toast uses n8n's `sent`.

## Storage and cooldown

Chores, housemates, and optional emails stay in the existing browser localStorage
record. Only the app-wide cooldown timestamp is stored in PostgreSQL. The
timestamp is reserved atomically before contacting n8n and survives restarts
and multiple server instances. Every forwarded attempt consumes one hour, even
if n8n errors or times out, because some emails may already have been sent.
Missing configuration and invalid input do not consume the cooldown.

The UI reads `GET /api/reminders/status`; sending uses `POST /api/reminders`.
Both use same-origin `/api` routing in development and publishing. Ensure both
secrets are available to the published app. The development cooldown table's
schema is applied through the normal Publish schema flow; do not run ad hoc
production migrations.

## Public-app limitation

The existing app has no login and stores its recipient list in the browser.
Consequently the server cannot verify that submitted recipients belong to your
household. The shared secret authenticates **the backend to n8n**, not people
using the app. Anyone who can reach the app's API can attempt to trigger the
app-wide blast and consume its hourly allowance. Before broad public use,
restrict recipients in n8n to an approved list (including your own inbox during
testing), or add authenticated household membership. Never place the webhook
URL or key in browser code or localStorage.

## Verification

Backend integration and webhook-contract tests (all outbound email calls are mocked):

```sh
pnpm --filter @workspace/scripts exec tsx --test ../artifacts/api-server/src/lib/reminders.test.ts
```

The database concurrency test uses a unique test scope and deletes it afterwards;
it does not use or reset the real app's hourly allowance.