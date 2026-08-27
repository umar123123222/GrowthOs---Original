# Zero-Risk Changes Only — GrowthOS

You asked: which fixes from the full diagnosis can we ship **right now with zero chance of affecting students, billing, access, or any working feature**? This plan contains only those. Everything that touches security rules, data values, or auth is deliberately left out and can be done later, one at a time.

## What we will do (safe list)

### 1. Data retention + one-off cleanup (biggest win, invisible to users)
- Add a daily cleanup job that deletes only old log/notification rows:
  - notifications: read + older than 60 days, unread older than 180 days
  - error_logs: older than 30 days
  - user_activity_logs / admin_logs: older than 365 days
- Run a one-off cleanup of the existing backlog (~879k old notifications, ~330k error logs) in small batches of 50k so nothing locks.
- **Why zero-risk:** nothing student-facing reads rows this old; no schema changes; deletes only aged history. Frees ~4 GB and removes the root cause of the "create fails on first click" timeouts.

### 2. Paginate the Courses and Recordings admin pages (read-only fix)
- Extract the existing `fetchAll` paging helper (already proven on the Students pages) into `src/lib/supabase-paging.ts`.
- Use it for module counts, enrollment counts, mentor assignments (Courses page) and the recordings list (Recordings page).
- **Why zero-risk:** this is exactly the fix we already shipped for the student search issue — it only makes lists *more complete*, never changes data.

### 3. Declare edge functions explicitly (config only)
- Add every deployed function to `supabase/config.toml` with its correct auth setting, keeping `verify_jwt = true` as the default for anything not already public.
- No code changes inside the functions themselves.
- **Why zero-risk:** it documents/enforces the auth behavior functions already have; we only add explicit declarations, we don't change any function's logic. The handful that must stay callable without login keep `verify_jwt = false` exactly as today.

### 4. Code health pass (no behavior change)
- Fix the realtime channel leak in submissions management (unsubscribe on unmount).
- Strip debug logging from production paths, especially the password-reset page (currently logs auth tokens).
- Remove the 15-second watchdog that masks hanging fetches on the students page, once pagination (item 2) removes the hang.
- **Why zero-risk:** removing logs and cleaning up subscriptions cannot change any user-visible behavior except making the app faster and less leaky.

## What we are deliberately NOT doing yet
- Locking down the 3 views / 119 functions (needs a careful whitelist test first — a mistake here could break legit calls).
- Fixing the 2 role-less users and 16 ghost invoices (touches real student data — deserves its own verified step).
- Leaked-password protection and Postgres upgrade (auth/infra changes, schedule separately).
- Reconciling the 8 billing drift findings.

## Verification
- After retention: database size drops, module/recording creation succeeds on the first click.
- After pagination: Courses page counts match the database; Recordings list shows everything.
- Regression check: sign in as admin and student, create a module + recording, open Courses/Recordings/Students pages, confirm nothing else changed.

Each item ships independently — if anything ever misbehaves, only that one item is reverted.
