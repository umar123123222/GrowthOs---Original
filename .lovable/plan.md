# Video protection: per-library Bunny token auth, watermarking, hardened detection

You have 5 separate Bunny Stream libraries, each with its own Token Authentication key. All 175 recordings live in these libraries:

| Library ID | Recordings |
| --- | --- |
| 610762 | 50 |
| 634938 | 42 |
| 494424 | 36 |
| 698163 | 28 |
| 665732 | 19 |

Every recording URL is a Bunny embed (`iframe.mediadelivery.net/embed/<libraryId>/<videoGuid>`), so the library ID is already readable from each URL. No database change is needed to know which key to use.

## 1. One secret holding all five keys

Instead of asking for a single key, we store one secret named `BUNNY_TOKEN_AUTH_KEYS` containing a JSON map of library ID to that library's token key:

```json
{
  "610762": "<key for that library>",
  "634938": "<key for that library>",
  "494424": "<key for that library>",
  "698163": "<key for that library>",
  "665732": "<key for that library>"
}
```

Advantages over five separate secrets: adding a sixth library later means editing one value, not redeploying with a new secret name. The keys never touch the database or the browser.

Where to find each key: Bunny dashboard, Stream, pick the library, Security tab. Copy the "Token Authentication Key" and switch on Token Authentication for that library.

Important: enabling Token Authentication on a library immediately breaks any plain embed URL for that library. So the rollout below is staged, and the player keeps a fallback so nothing goes dark for students mid-course.

## 2. New edge function: `sign-video-embed`

- Verifies the caller's JWT and confirms the student actually has access to that recording (same unlock and LMS-status rules the player already relies on).
- Parses the library ID and video GUID out of the stored recording URL.
- Looks up that library's key in the secret map.
- Builds Bunny's signed embed URL: `SHA256(key + videoGuid + expiry)` plus `token`, `expires`, and the existing playback params. Expiry set short (about 10 minutes), refreshed by the player before it lapses.
- If the library ID has no key in the map, it returns the plain embed URL unchanged. This is what makes the rollout safe: libraries you have not enabled token auth on yet keep working exactly as they do today.
- Logs an entry when a student requests a signature, giving you a real per-student playback audit trail.

## 3. Player changes (`src/pages/VideoPlayer.tsx`)

- Replaces the direct `iframe.src = embedUrl` assignment with a call to `sign-video-embed`, so the raw permanent URL never reaches the browser at all.
- Re-signs on an interval so long videos do not cut out when the token expires.
- On signing failure, shows a retry state rather than a blank player.

Result for the screenshot you sent: IDM can still see an HLS request, but the manifest URL it captures is dead within minutes and is bound to that one viewer's token, so the download fails or produces nothing reusable.

## 4. Dynamic student watermark

A new overlay component draws the student's name, email, and user ID over the player at low opacity, repositioning every 20-30 seconds so it cannot be cropped out. Rendered outside the iframe in a `pointer-events: none` layer, so it does not interfere with playback controls.

This does not block OBS. It makes any OBS recording traceable to the student who made it, which is the practical deterrent. Students see it, which is most of the effect.

## 5. Hardened in-page detection

Extends the existing `useCaptureGuard`:
- More downloader/recorder extension fingerprints (Video DownloadHelper, FVD, Free Download Manager, CocoCut, Stream Recorder, IDM's newer injections).
- Detection of injected download buttons that attach themselves near the player element.
- A check for the `mediaSession` and remote-playback APIs being probed by extensions.
- Rate limiting so a single noisy page cannot spam incidents.

Honest limit, unchanged: this still cannot see OBS, cannot see a phone camera pointed at the screen, and cannot see an extension that only watches network traffic without injecting DOM. Token auth in step 2 is what covers the network-sniffing downloaders; the watermark in step 4 is what covers OBS.

## Rollout order (nothing breaks for current students)

1. Deploy the signing function and the player change while the secret map is empty or partial. Behaviour is identical to today because unknown libraries fall through to the plain URL.
2. Add one library's key to the secret and enable Token Authentication for that library in Bunny. Verify a video from that library plays.
3. Repeat for the remaining four libraries, one at a time.

If any step misbehaves, removing that library's entry from the secret restores the old behaviour immediately, with no code change.

## Technical notes

- Secret: `BUNNY_TOKEN_AUTH_KEYS`, JSON object keyed by library ID string.
- New edge function: `supabase/functions/sign-video-embed/index.ts`, registered in `supabase/config.toml`.
- Token formula: Bunny embed token auth uses `SHA256_HEX(tokenKey + videoId + expirationUnix)` appended as `?token=...&expires=...`.
- Files touched: `src/pages/VideoPlayer.tsx`, `src/components/VideoPreviewDialog.tsx`, `src/components/OnboardingVideoModal.tsx` (same signing path), `src/hooks/useCaptureGuard.ts`, plus a new watermark component.
- No database migration required.
