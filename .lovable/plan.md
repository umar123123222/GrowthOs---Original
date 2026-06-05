# Multi-Device & Concurrent Session Detection

Track every student session (device, browser, IP, approximate location) and flag when the same account is actively used from 2+ devices at the same time — including watching different or the same video simultaneously.

## What gets built

### 1. Session tracking table
New `student_sessions` table capturing each active browser session:
- `user_id`, `session_token` (random per-tab id stored in localStorage)
- `device_fingerprint` (hash of UA + screen + platform)
- `user_agent`, `device_label` (e.g. "Chrome on Windows")
- `ip_address`, `country`, `city` (resolved via ipapi.co in edge function)
- `first_seen_at`, `last_heartbeat_at`
- `current_activity` (JSON: `{ type: 'video', recording_id, title, started_at }` or `null`)

### 2. Heartbeat + activity reporting (frontend)
- On login / app load: create a session row via edge function `session-heartbeat` (resolves IP + geo server-side).
- Every 30s while tab is open: ping `session-heartbeat` to update `last_heartbeat_at` and `current_activity`.
- When a student opens a video: send `current_activity = { type:'video', recording_id, title }`.
- On tab close / logout: mark session ended.
- Active = `last_heartbeat_at` within last 90 seconds.

### 3. Concurrent-use detection
A session is "concurrent" when a user has 2+ rows with heartbeats in the last 90s. The view `student_concurrent_sessions` exposes:
- which students are currently using LMS from multiple devices
- per device: location, device, what video (if any) is playing right now
- flag `same_video` vs `different_video`

Concurrent events are also logged into `admin_logs` (entity_type `concurrent_session`) so they appear in the existing global activity log and per-student notes/activity timelines automatically.

### 4. Admin UI

**a) New "Active Sessions" tab in Superadmin → Students**
- Live table of currently-active students, grouped by user.
- Badge "⚠ Concurrent" (amber) when a student has >1 active device.
- Each row expands to show every device: location (city, country, IP), browser/OS, last heartbeat, what's currently playing.

**b) Student profile → new "Sessions & Devices" section**
- History of last 30 days of sessions for that student.
- Highlighted rows where overlap was detected, with the overlapping device pair and timestamp.
- Filter: All / Concurrent only / By country.

**c) Global activity log**
- New activity type `concurrent_session_detected` showing in the existing dialog with metadata (devices, locations, videos).

### 5. Optional admin action
"Force sign-out all other devices" button on the student row — invalidates all sessions except the most recent by deleting their rows and bumping a `sessions_revoked_at` field on the user; the frontend heartbeat checks this and logs the user out if their session was revoked.

## Technical details

- **Table**: `public.student_sessions` with RLS — student can see/update own rows; admin/superadmin can see all via `has_role`. Standard GRANTs for `authenticated` + `service_role`.
- **Edge function `session-heartbeat`** (verify_jwt=false, validates JWT in code): accepts `{ session_token, device_fingerprint, user_agent, current_activity }`, reads caller IP from `x-forwarded-for`, resolves geo via free ipapi.co (no key) with graceful fallback, upserts the session row.
- **View `student_concurrent_sessions`**: `SELECT user_id, count(*) filter (where last_heartbeat_at > now() - interval '90 seconds') AS active_devices ... HAVING count > 1`.
- **Trigger / cron**: `pg_cron` job every minute that scans the view and writes new `admin_logs` rows for newly-detected concurrent events (deduped by user_id + 5-minute window).
- **Cleanup**: cron deletes session rows with `last_heartbeat_at < now() - interval '30 days'`.
- **Frontend hook** `useSessionHeartbeat()` mounted once in the authenticated layout; uses `navigator.userAgent`, screen size, and a stable localStorage token for fingerprint. Video player calls `setActivity({type:'video', recording_id, title})` on play and clears on pause/unmount.
- **Geo accuracy note**: IP-based geolocation is city-level and approximate; VPNs will mask true location. This will be surfaced in the UI tooltip.

## Out of scope (can add later)
- Blocking concurrent logins automatically (currently detection + manual force-signout only).
- Email alerts to admin on every concurrent event (only logged to activity feed for now).
- Device naming by the student themselves.

## Files to add/edit
- Migration: create `student_sessions`, view, cron jobs, RLS, grants.
- New edge function: `supabase/functions/session-heartbeat/index.ts`.
- New hook: `src/hooks/useSessionHeartbeat.ts`.
- Wire into authenticated layout + video player components.
- New component: `src/components/superadmin/ActiveSessionsTab.tsx`.
- New component: `src/components/StudentSessionsHistory.tsx` (used in profile dialog).
- Extend `ActivityLogsDialog` mapping to render `concurrent_session_detected` type.

Confirm and I'll implement.