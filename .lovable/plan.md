## Problems

Looking at the screenshot and code in `supabase/functions/send-batch-content-notification/index.ts` (line 104-114) and `supabase/functions/success-session-reminder/index.ts`:

1. **Wrong timezone**: The date is rendered with `toLocaleString("en-US", {...})` with no `timeZone` option. In Deno edge runtime that defaults to **UTC**, so students in Pakistan see "Tuesday, June 16, 2026 at 6:00 PM UTC" instead of their local time (11:00 PM PKT).

2. **Misleading "Starting in 3 Hours" headline**: The reminder cron runs on a schedule and picks any session starting within the next ~3h15m window. So a session that actually starts in 58 minutes still gets an email titled "Starting in 3 Hours" — which is what happened in the screenshot (email sent 10:02 PM PKT for an 11:00 PM PKT session ≈ 1 hour away).

## Fix

### 1. `supabase/functions/send-batch-content-notification/index.ts`
- In the `LIVE_SESSION` branch (around line 104), format `startDatetime` with `timeZone: "Asia/Karachi"` and `timeZoneName: "short"` so the email reads e.g. `Tuesday, June 16, 2026 at 11:00 PM PKT`.
- Apply the same `Asia/Karachi` formatting to any other date rendered in this template (e.g. assignment due dates) for consistency.

### 2. `supabase/functions/success-session-reminder/index.ts`
- Compute the actual minutes-until-start for each session and pass a dynamic label to the notification function (new optional field `reminder_label`, e.g. `"Starting in ~1 hour"`, `"Starting in ~30 minutes"`, `"Starting soon"`, `"Starting in ~3 hours"`).
- Bucket logic:
  - `≤ 15 min` → "Starting soon"
  - `≤ 45 min` → "Starting in ~30 minutes"
  - `≤ 90 min` → "Starting in ~1 hour"
  - `≤ 150 min` → "Starting in ~2 hours"
  - otherwise → "Starting in ~3 hours"

### 3. `supabase/functions/send-batch-content-notification/index.ts` (headline)
- Accept optional `reminder_label` in `NotificationRequest`. When `isReminder && reminder_label`, use it for the headline and the email subject instead of the hardcoded "Starting in 3 Hours".

## Result

- Students see session times in Pakistan Standard Time (PKT, UTC+5), matching their actual schedule.
- The headline accurately reflects how soon the session starts, instead of always saying "3 Hours".
- No changes to scheduling logic, recipients, or DB schema.

## Out of scope

- Per-user timezone preferences (all students are in Pakistan, so `Asia/Karachi` is hardcoded). If needed later, can be moved to `company_settings.default_timezone`.
