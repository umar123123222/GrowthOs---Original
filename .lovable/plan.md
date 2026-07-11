
# Enforce Video Feedback via Unlock Gate + Nudges + XP

Goal: Ensure students submit a rating on every video they watch, by gating next-lesson unlock on rating, showing pending-feedback nudges in the UI, and rewarding ratings with leaderboard points. Only applies to lessons watched from the rollout date onward — no retroactive backlog.

## 1. Rating-gate on sequential unlock (only new watches)

The `available_lessons` sequential-unlock chain currently requires: previous lesson watched + assignment (if any) submitted/approved. We add a new required condition: **previous lesson rated**.

- Extend `useSequentialUnlock` / `useRecordingUnlocks` (whichever computes `isUnlocked` and `lockReason` — see `RecordingRow.tsx` rendering) to also check `recording_ratings` for the previous lesson.
- New `lockReason: 'previous_lesson_not_rated'` with copy: `Rate "<previous lesson>" to unlock this lesson`.
- **Grandfathering (only new watches):** apply the rule only when the previous lesson was watched on/after a rollout timestamp. Read `recording_views.updated_at` (or `created_at`) — if it predates the rollout, skip the rating check for that lesson. Store the rollout timestamp as a constant (`FEEDBACK_GATE_ROLLOUT_AT`) in a shared config so we can adjust.
- Same rule applies in `BatchPathwayView` / `RecordingRow` (they read the unlock state, no separate logic needed once the hook returns the new reason).

## 2. UI nudges

- **Auto-open rating modal on video completion** — already wired via `useVideoRating.handleVideoComplete`. Keep as-is but make the modal non-dismissable-until-submitted **only** when this lesson falls under the rollout window (so the student can immediately clear the gate). Allow "Skip" if they want to rate later, but keep the pending badge showing.
- **Pending-feedback badge** on lesson rows in `RecordingRow.tsx` and `LessonRow.tsx`: show an orange "⭐ Rate to continue" chip next to watched-but-unrated lessons that are within the rollout window.
- **Banner under video player** in `VideoPlayer.tsx`: after completion, a subtle "Please rate this lesson to unlock the next one" strip with a "Rate now" button that opens the modal.
- **Pathway progress card** (`BatchPathwayView`): if any lesson in the pathway is pending feedback, show a small "N lessons awaiting your feedback" note.

## 3. XP reward for rating

- On rating insert, award XP (e.g. +2 points) via the existing leaderboard/`user_metrics` pipeline.
- Implemented via a Supabase trigger `AFTER INSERT ON recording_ratings` that increments the student's points and logs the event, or by the existing `build-leaderboard` metric — reuse whichever pattern the current leaderboard uses (will inspect `build-leaderboard` and `useRealRecoveryRate`-style scoring during implementation).
- Show a `+2 XP` toast on successful rating submission in the rating modal.

## 4. Rollout / grandfathering config

Add `FEEDBACK_GATE_ROLLOUT_AT` (ISO string, default = deploy time) to `src/config/ui-constants.ts`. All gating logic checks `recording_views.updated_at >= FEEDBACK_GATE_ROLLOUT_AT` — anything before is exempt.

## Technical details

Files to edit:
- `src/hooks/useRecordingUnlocks.ts` (or wherever `isUnlocked` / `lockReason` is derived per recording) — add rating check + new lock reason.
- `src/components/videos/RecordingRow.tsx` — add pending badge + `previous_lesson_not_rated` copy branch.
- `src/components/LessonRow.tsx` — same badge treatment.
- `src/components/videos/BatchPathwayView.tsx` — pathway-level pending count.
- `src/pages/VideoPlayer.tsx` — post-completion banner + tighter modal behavior.
- `src/hooks/useVideoRating.ts` — expose whether current lesson is under rollout and pass to modal to control dismissibility.
- `src/config/ui-constants.ts` — add `FEEDBACK_GATE_ROLLOUT_AT`.

Database (migration):
- Trigger `award_xp_on_recording_rating` after insert on `recording_ratings` that upserts into `user_metrics` (or the leaderboard points column used today) with +2 points. Exact target column will be confirmed by reading `build-leaderboard` before writing SQL.
- No schema change on `recording_ratings` needed.

Non-changes:
- No change to `recording_ratings` RLS.
- No change to assignment gating.
- No forced-modal for already-watched-but-unrated legacy lessons (per user choice).

## Acceptance

- A student who watches lesson N (post-rollout) sees lesson N+1 locked with reason "Rate lesson N to unlock this lesson" until they submit a rating.
- Watched-but-unrated post-rollout lessons show an orange "Rate to continue" chip in the list.
- On rating submit, next lesson unlocks in-place and a `+2 XP` toast appears; leaderboard reflects the points.
- Lessons watched before rollout do not trigger any gate or badge.
