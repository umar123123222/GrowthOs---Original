# Detection-first anti-piracy: identify and suspend, don't block

Switch the current "warn and try to stop recording" behaviour to pure **identification**: detect who is recording or downloading, log the evidence, suspend them immediately, and notify admins. No countdown, no warning UI, no attempt to prevent the capture.

## What changes for the student

- The 5-second countdown overlay is removed entirely. Nothing warns the offender.
- On the first hard signal (screen-capture API, downloader/recorder extension, PiP capture), the account is silently suspended, all sessions revoked, and the user is signed out. They only learn about it at the login screen ("Your account was suspended for attempting to record or download protected content").
- Soft signals (devtools open, screenshot shortcut) are logged as evidence only — never suspend on those, they are too false-positive prone.

## Two detection layers

### 1. In-page detection (existing hook, hardened)

`src/hooks/useCaptureGuard.ts` stays but loses the countdown state machine. On detection it fires one report and suspends. Hardening:

- Expanded extension fingerprint list (IDM/IDMcc, FDM, Video DownloadHelper, SaveFrom, CocoCut, Vimeo/Bunny grabbers, Loom, Screencastify, Awesome Screenshot, Nimbus, Scrnli, Bandicam helper).
- Watch for injected `chrome-extension://` resources on the page and for extra `<video>`/`<a download>` nodes injected next to the player.
- Keep `getDisplayMedia` / `MediaRecorder` hooks and Picture-in-Picture events.

### 2. Server-side behavioural detection (new)

Downloaders like IDM and external recorders like OBS never touch the page, so in-page detection cannot see them. Instead we attribute them from access patterns.

New table `video_access_events`: user_id, recording_id, event type (`open`, `heartbeat`), session id, user agent, IP, created_at.

`src/pages/VideoPlayer.tsx` writes an `open` event when a lesson loads and a heartbeat every ~60s while playing (alongside the existing `recording_views` upsert).

New edge function `detect-capture-patterns` (invoked right after each `open` event, and available as a manual admin rescan) flags a user when, inside a rolling window:

- many distinct recordings opened in a short time with no matching watch progress (classic bulk-download sweep),
- the same recording is re-opened repeatedly in minutes,
- the same account is active from multiple IPs / devices at once,
- opens with no heartbeats at all (page opened only to harvest the stream URL).

A flag creates a `security_incidents` row with `signal = 'bulk_download_pattern'` and the evidence attached, then runs the same suspend + notify path.

## Suspension and evidence trail

`supabase/functions/report-security-incident/index.ts` is updated to:

- Drop the `phase` / countdown logic — any hard signal suspends on first occurrence.
- Record richer evidence in `security_incidents.metadata`: matched fingerprint, page URL, device, IP, recording being watched, recent access pattern summary.
- Keep writing to `admin_logs` so the incident appears in the student's Notes / Activity Logs tab.
- Keep the email alert to the notification address from Company Settings, retitled to "Account auto-suspended".

## Admin view

A **Security Incidents** tab is added to the existing Data Audit page: who was flagged, which signal, device, IP, page, timestamp, current suspension state, plus an "Unsuspend / mark false positive" action (which restores `lms_status` and records the reversal in `admin_logs`).

## Nothing existing breaks

- No change to video delivery, drip logic, enrollments, or billing.
- `recording_views` behaviour is untouched; the new events table is additive and write-only from the player.
- Behavioural thresholds start deliberately conservative and are stored in one constants block so they can be tuned after watching real data.

## Technical notes

- New table `video_access_events` with GRANTs, RLS (student inserts own rows; admin/superadmin read), and an index on `(user_id, created_at desc)`.
- `detect-capture-patterns` runs with the service role; thresholds live at the top of the function.
- `CaptureWarningOverlay.tsx` is reduced to a no-render component (or removed from `App.tsx`) since there is no longer anything to show.
- `Login.tsx` keeps the `?suspended=capture` message.
