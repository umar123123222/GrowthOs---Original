**Plan**

1. **Fix the likely database trigger failure**
   - Update the `award_xp_on_recording_rating` trigger so rating submission cannot fail because the daily XP metric already exists.
   - Change it from a plain insert into `user_metrics` to an idempotent upsert/addition against the existing `(user_id, source, metric, date)` unique key.

2. **Harden the frontend submit flow**
   - In `LectureRating`, replace the blind `.upsert(...)` with a conflict-targeted upsert on `recording_id, student_id` so duplicate/previous attempts update cleanly instead of failing.
   - Use `.maybeSingle()` for existing-rating checks instead of `.single()` to avoid noisy “no row” errors.
   - Show the real Supabase error in logs while keeping the user-facing toast simple.

3. **Verify the flow**
   - Confirm `recording_ratings` grants/RLS remain correct.
   - Test that submitting the relogin feedback modal succeeds and dispatches the refresh event so the pending prompt disappears.

**Technical detail**
- The table permissions and RLS appear valid; the most suspicious failure point is the XP trigger inserting `rating_reward_xp` into `user_metrics`, which has a unique constraint per user/source/metric/date. A second rating on the same day can make the trigger fail, rolling back the rating insert and causing the visible “Failed to submit rating” toast.