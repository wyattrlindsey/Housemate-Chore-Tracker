# n8n chore reminders

## Configuration

The backend requires these environment settings:

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`: the same Supabase
  project used by the browser. The publishable key is designed for browser use.
- `SUPABASE_SECRET_KEY`: **server-only** Supabase secret key, used solely for
  `auth.admin.getUserById(assignee_id)`. Never give this variable a `VITE_` prefix,
  log it, send it to the browser, or store it in localStorage.
- `N8N_WEBHOOK_URL`: HTTPS webhook URL for the active n8n workflow.
- `N8N_CHORE_KEY`: shared secret matching the n8n Header Auth credential.

The frontend needs only the two `VITE_SUPABASE_*` settings at build time.
Keep the server settings available to the published API too.

In n8n configure a POST Webhook node with Header Auth named `X-Chore-Key`.
Send one email per `body.reminders` item, then use Respond to Webhook to return
JSON `{ "ok": true, "sent": 2 }`, where `sent` is the actual recipient count.
Do not return the default “Workflow was started” response. The app waits up to
15 seconds for n8n's response; delivery after that deadline is unconfirmed.
There are no automatic retries.

## Authentication and request contract

Both endpoints require `Authorization: Bearer <Supabase access token>`.

- `GET /api/reminders/status?choreId=<UUID>` reads the cooldown for the chore's house.
- `POST /api/reminders` takes `{ "choreId": "<UUID>", "everyone": true,
  "timeZone": "America/New_York" }`. Omit `everyone` or set it to false to remind
  only the selected chore's assignee. `timeZone` defaults to UTC.

The **Remind everyone** button supplies an actual chore ID from the selected
house as the access-check anchor and sets `everyone: true`.

The server verifies the access token with Supabase Auth, then reads the chore
using a request-scoped publishable-key client carrying that token. RLS checks
house membership. Missing/invalid tokens return 401; an unreadable chore returns
403. The client never chooses the cooldown's house ID and cannot supply
recipients, email addresses, chore titles, due dates, or the sender's name.

All chore/member/profile queries use the caller's RLS-protected client.
For “everyone,” the server groups unfinished, assigned chores from that house
and checks that assignees still belong to it. A separate server-only admin
client resolves each assignee's auth email. Profile names are not email addresses.
No destination emails are returned to the browser.

## Payload sent to n8n

```json
{
  "triggeredBy": "Example sender",
  "reminders": [
    {
      "name": "Example housemate",
      "email": "test@example.com",
      "chores": [
        { "title": "Clean the kitchen", "due": "2026-10-01", "overdue": true },
        { "title": "Buy sponges", "due": null, "overdue": false }
      ]
    }
  ]
}
```

Use plain text or escape names/titles in HTML email. `due` is a date-only string
or null for undated chores. The server calculates `overdue` using the supplied
IANA time zone; chores due today and undated chores are not overdue.

## Storage and cooldown

Supabase stores users, profiles, houses, memberships and chores. Only reminder
cooldowns stay in the existing Replit Postgres `reminder_cooldowns` table.
There is no Supabase cooldown table or schema migration.

Cooldown scope is `house:<verified house_id>`, never user-supplied. An atomic
reservation occurs before contacting n8n and lasts one hour. It survives server
restarts and multiple instances. A failed or timed-out webhook keeps the
reservation, since partial delivery may have occurred. Invalid input, failed
authorization, missing configuration and failed email lookup do not consume it.
Different houses have independent allowances; all members of a house share one.
Old app-wide cooldown records are unused and are not deleted.

## Testing with your inbox

1. Sign in with a Supabase account using your own email.
2. Create a test house, then assign an unfinished chore to yourself.
3. Ensure the n8n workflow is active (or start its test listener for a test URL).
4. Click **Remind everyone**, review the member names/chore counts, and confirm.
5. Check the n8n execution and your inbox; the success count comes from n8n.

The UI intentionally has no housemate email inputs. To avoid emailing others,
test in a house containing only your own account. Each forwarded attempt starts
the house's hour-long cooldown, including unconfirmed delivery.

## Automated checks

```sh
pnpm --filter @workspace/scripts exec tsx --test ../artifacts/api-server/src/lib/reminders.test.ts ../artifacts/api-server/src/lib/supabase-reminders.test.ts
```

Outbound email calls are mocked. Tests cover authentication rejection, supplied
email rejection, authorized house scoping, independent cooldowns, concurrency,
timeouts, and webhook validation. The database test uses a disposable scope and
does not reset a real house's allowance. Mock authorization tests do not certify
the policies deployed in your Supabase project.
