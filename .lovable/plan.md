# Screen-Recording / Extension Detection with Auto-Suspend

Detect likely screen recording or downloader tooling while a user is signed in, show a 5-second countdown warning, and auto-suspend the account if the warning is ignored or a second detection occurs.

## Behaviour

1. A detection fires while any user is logged in (students and staff alike).
2. A full-screen blocking overlay appears: "Screen recording / capture tool detected. Stop it now." with a 5-second countdown.
3. If the offending condition clears within 5 seconds, the overlay closes and a warning is logged (first offence only).
4. If the countdown reaches zero, or a second detection happens at any point, the account is suspended immediately.
5. Suspension = `lms_status` set to `suspended` **and** all sessions revoked, so every device is signed out. The user is redirected to the login screen with an explanatory message.
6. Every detection (warning and suspension) is written to the activity log, appears in the student's Notes/Activity dialog, and triggers an alert email.

## Detection signals

All of the following, evaluated client-side:

- Screen capture: patch `navigator.mediaDevices.getDisplayMedia` to flag any call; also flag active display-surface tracks and Picture-in-Picture entry.
- Known downloader/recorder extensions: probe for their injected DOM nodes, known element IDs/classes, and injected script attributes on a short interval.
- Devtools open (window outer/inner size delta plus debugger timing check) and capture keystrokes: PrintScreen, Win+Shift+S, Cmd+Shift+3/4/5.

Signals are heuristic. To limit false positives, devtools and keystroke signals fire the warning only; screen-capture and extension signals count as full offences. The offence counter is stored server-side per user so it survives reloads and device switches.

## Alerting and records

- Log entry in `admin_logs` (the unified activity log) with the signal type, device label, IP, and page URL, so it shows in the existing Activity Logs and Notes views for that user.
- Email to the address in Company Settings → `notification_email_cc`, containing user name, email, student ID (if any), role, signal detected, timestamp, device, and the action taken.

## Technical details

- New table `security_incidents` (user_id, signal, severity, action_taken, user_agent, ip, page_url, metadata, created_at) with grants, RLS: insert via edge function only; read for admin/superadmin via `public.get_my_role()`.
- New edge function `report-security-incident` (JWT-verified): records the incident, counts prior incidents for the user, decides warn vs suspend, on suspend sets `users.lms_status = 'suspended'` and `users.sessions_revoked_at = now()`, writes to `admin_logs`, and sends the alert email through the existing dual-provider email path (Resend first, SMTP fallback). Registered in `supabase/config.toml`.
- New client hook `src/hooks/useCaptureGuard.ts` holding the detectors, and `src/components/security/CaptureWarningOverlay.tsx` for the countdown UI, mounted once in the authenticated layout so it covers every route.
- On suspend response, the client calls `supabase.auth.signOut()` and routes to login. The existing heartbeat already honours `sessions_revoked_at`, so other open devices drop on their next ping.
- Overlay uses semantic tokens (`bg-background`, `text-destructive`) — no hardcoded colors.

## Not changed

Existing suspension tooling, billing, and drip logic are untouched; admins restore access with the current unsuspend flow.
