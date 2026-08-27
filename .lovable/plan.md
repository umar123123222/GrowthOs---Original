# Full System Diagnosis — GrowthOS

Findings from a live audit of the database and the codebase. Everything below was verified (counts came from real queries, code issues from real file reads). Nothing has been changed yet — this is the diagnosis plus the fix order I recommend.

## 1. Critical — database size and cost

| Table | Rows | Size |
|---|---|---|
| notifications | 6,535,836 | 3,974 MB |
| error_logs | 329,681 | 437 MB |
| admin_logs | 349,073 | 186 MB |
| user_activity_logs | 445,243 | 162 MB |
| video_access_events | 128,031 | 66 MB |

- Notifications average **6,034 rows per user**, and 879,162 are older than 90 days. This single table is ~4 GB and is the direct cause of the "create fails on first click, works on the third" timeouts we fixed last week. It will keep growing (~2,258 new rows per day).
- `error_logs` holds 329k rows in 437 MB — errors are being logged unboundedly with full stack traces and JSON payloads, and nothing prunes them.

**Fix:** add retention (delete notifications read + older than 60 days, unread older than 180 days; error_logs older than 30 days; user_activity_logs and admin_logs older than 365 days), run it on a daily cron, then a one-off cleanup + `VACUUM FULL`-style reclaim. Expected reduction: ~4.3 GB to under 400 MB.

## 2. Critical — security posture

- **3 views have no access rules at all**: `student_concurrent_sessions_v`, `user_security_summary`, `users_safe_view`. One is flagged by the linter as a Security Definer view, meaning it runs with creator privileges and bypasses row-level rules. Any signed-in user could potentially read them.
- **119 privileged database functions are callable by anyone**, including not-signed-in visitors. Functions like `get_team_member_password`, `create_user_with_role`, `create_student_complete`, `notify_all_students` should not be publicly invokable.
- **Leaked-password protection is disabled** in auth settings.
- **Postgres has pending security patches.**
- **~48 edge functions are not declared** in the functions config, so their auth requirement is implicit. Sensitive ones — `admin-reset-password`, `delete-user-with-role`, `process-refund`, `mark-invoice-paid`, `secure-user-creation` — need an explicit setting and a verified internal role check.

## 3. High — data integrity

- **2 users have no role row**, so they are invisible in every admin list (this is the same class of bug as the "student exists but search finds nothing" issue).
- **16 invoices are attached to neither a course nor a pathway** — these are exactly the ghost invoices that inflate totals and trigger wrong suspensions.
- **8 unresolved billing drift findings** are waiting in the audit page.
- Good news: **zero duplicate enrollments**, zero orphan students, zero invoices pointing at courses the student isn't enrolled in. The earlier enrollment fixes held.

## 4. High — silent data truncation still present in two admin pages

Supabase returns at most 1,000 rows per query. Two pages still ignore this:
- **Courses page** — module counts, enrollment counts and mentor assignments are computed from unpaginated queries. With 1,074 enrollments we are already past the limit, so course cards are showing wrong counts today.
- **Recordings page** — the whole recordings list is fetched unpaginated. Once lessons pass 1,000, entries silently disappear from the admin list.

Both need the same paging helper the students pages already use.

## 5. Medium — code health

- A leaked realtime channel in submissions management (subscribes, never unsubscribes) — leaks a websocket per mount.
- Two student-management screens (4,207 and 2,264 lines) each re-implement their own paging and chunking helpers instead of sharing one; fixes to one silently miss the other.
- Debug logging left in production, including the password-reset page (logs auth tokens/params) and the student password reset flow (logs the full response payload).
- A 15-second watchdog on the students page force-clears the loading spinner, masking a fetch that can hang.
- The password-reset action falls through three different backend functions and logs each failure quietly.
- Unfinished stubs: certificates download tracking, phone-number validation, and the error logger never reaches a monitoring service.
- Global activity log views cap at 100/500 entries with no "load more".

## Recommended order of work

1. **Retention + cleanup** for notifications and logs (biggest win, zero user-visible risk).
2. **Lock down the 3 views and the publicly callable functions**, enable leaked-password protection, schedule the Postgres upgrade.
3. **Fix the 2 role-less users and the 16 unattached invoices**, then clear the 8 drift findings.
4. **Paginate the Courses and Recordings pages** so counts and lists are correct.
5. **Declare every edge function explicitly** with its auth requirement and verify internal role checks on the sensitive five.
6. **Code health pass**: shared paging util, realtime cleanup, strip production logs, remove the watchdog once the underlying fetch is fixed.

## Technical notes

- Retention runs as a `pg_cron` job calling a `SECURITY DEFINER` cleanup function with batched deletes (50k per statement) to avoid long locks.
- View lockdown: recreate the three views as `security_invoker`, add access rules, and revoke `anon` execute on the definer functions in bulk via a generated `REVOKE` script, whitelisting the handful the client genuinely calls (`get_my_role`, `has_role`, catalog getters).
- Pagination: extract the existing `fetchAll`/`chunkArray` helpers from the students screens into `src/lib/supabase-paging.ts` and reuse in Courses and Recordings.
- No schema changes to enrollments, invoices or unlocks are proposed — existing student access and drip behaviour stay exactly as they are.

Each step is independently shippable; I'd do 1 and 2 first since they carry the current cost and risk.
