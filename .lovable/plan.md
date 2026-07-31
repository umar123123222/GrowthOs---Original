# Per-library Bunny token authentication (and optional DRM)

Your embeds already carry the library ID in the URL: `https://iframe.mediadelivery.net/embed/{libraryId}/{videoGuid}`. So "one auth key won't work" is solved by storing **one key per library** and picking the key from the library ID at play time. Nothing about how videos are added changes.

## What this stops (and what it doesn't)

- **Token auth (signed, expiring, IP-locked embed URLs)** — kills IDM / SaveFrom / m3u8 grabbers and shared links: the stream URL dies within minutes and only works for the IP that requested it. This is the real fix for extension downloading.
- **MediaCage DRM (Widevine/FairPlay/PlayReady)** — additionally blocks OBS and screen recorders on supported browsers (black frame). It is a **paid Bunny add-on** that must be enabled per library in the Bunny dashboard; there is no way to enable it from this app.
- Watermark + playback-signal logging stay as-is for whatever slips through (phone camera, unsupported browsers).

## How it works after this change

1. Superadmin opens **Settings → Video Security** (new tab) and sees every Bunny library ID detected across recordings. For each one, they paste the library's **Token Authentication Key** (Bunny dashboard → Stream → the library → Security → Token Authentication Key) and tick "Token auth enabled".
2. Keys are stored server-side only (never sent to the browser).
3. When a student opens a lesson, the player no longer uses the raw embed URL. It calls a new edge function `sign-video-embed` with the recording ID.
4. The function: verifies the caller's JWT, re-checks that this student is actually unlocked for that recording (drip/sequential/LMS status — same rules as today), then builds the signed embed URL:
   `.../embed/{lib}/{guid}?token={sha256(key + guid + expires + ip)}&expires={now+15min}&token_path=...` plus the existing player params.
5. The iframe gets the signed URL. It expires in ~15 minutes and is bound to the student's IP, so a copied URL is useless and a downloader can't re-fetch segments later.
6. Bunny library setting **"Block direct URL file access"** + referer allow-list (your domains) must also be turned on per library — the plan's settings page lists this as a checklist item per library, since only you can toggle it in Bunny.

## Admin experience

- One row per library: library ID, a masked "key set / not set" state, enabled toggle, and a "Test" button that signs a sample video and reports whether Bunny accepted it.
- Fallback is safe: if a library has no key or token auth is off, the player uses the current plain embed URL exactly as today. Nothing breaks for courses you haven't configured yet.

## Technical notes

- New table `video_library_keys` (library_id text PK, token_key_encrypted, token_auth_enabled, drm_enabled, notes, timestamps) with GRANTs, RLS: no anon/authenticated read of the key — reads restricted to admin/superadmin for metadata only via a view that omits the key; the edge function reads it with the service role.
- New edge function `sign-video-embed` (`verify_jwt = true`, registered in `supabase/config.toml`): input `{ recording_id }`, validates access, returns `{ url, expires_at }`.
- `src/pages/VideoPlayer.tsx` (and `VideoPreviewDialog` for admins) fetch the signed URL instead of building the embed inline; a refresh timer re-signs before expiry so long lessons don't cut out mid-watch.
- Token algorithm follows Bunny Stream embed token spec (SHA256 over key + video GUID + expiry [+ IP]); the expiry window and IP-lock strictness live in one constants block.
- Existing watermark, `useSecuritySignals`, `useCaptureGuard` and auto-suspension are untouched.

## What you need from Bunny

For each library: the Token Authentication Key, and (if you want OBS blocked) DRM enabled on the account. Everything else is handled in the app.
