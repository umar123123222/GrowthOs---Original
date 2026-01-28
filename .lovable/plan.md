

## Summary

When a student is created without a batch (using LMS access date) and later assigned to a batch by an admin, the system currently recalculates ALL drip unlock dates based on the batch's start date. This can lock videos the student has already watched.

## Current Behavior (Problem)

The `get_course_sequential_unlock_status` function calculates unlock status like this:

```sql
-- Priority: batch start_date > enrollment_date
IF v_batch_start_date IS NOT NULL THEN
  v_drip_base_date := v_batch_start_date;
ELSE
  v_drip_base_date := v_enrollment_date;
END IF;
```

When a batch is assigned later with a **more recent** start date, all videos become drip-locked again based on the new date — even ones the student already watched.

## Proposed Behavior (Fix)

1. Videos the student has **already watched** remain unlocked regardless of drip schedule
2. Videos **not yet watched** follow the new batch-based drip schedule
3. Sequential unlock rules still apply for assignments

This ensures:
- No regression for students who have made progress
- Future content follows the batch timeline
- Assignments are still required where applicable

---

## Implementation Steps

### Step 1: Update `get_course_sequential_unlock_status` Database Function

Modify the function to check if the student has already watched each recording. If `recording_views.watched = true`, that video is always unlocked.

**Changes:**
- Add a LEFT JOIN to `recording_views` for the CURRENT lesson (not just prev lesson)
- In the unlock calculation, add condition: `current_watched = true` → always unlocked
- Update `unlock_reason` to show `'already_watched'` when applicable

**SQL logic update:**
```text
full_status AS (
  SELECT 
    ...
    -- ADD: Check if THIS video was watched
    COALESCE(curr_rv.watched, false) as current_watched,
    ...
  FROM prev_lesson_status pls
  ...
  -- ADD: Join for current recording's watch status
  LEFT JOIN recording_views curr_rv 
    ON curr_rv.recording_id = pls.id 
    AND curr_rv.user_id = p_user_id
)
SELECT 
  ...
  (
    fs.current_watched OR  -- NEW: Already watched = always unlocked
    fs.manually_unlocked OR 
    NOT v_sequential_enabled OR 
    ... existing conditions ...
  )::BOOLEAN as is_unlocked,
  
  CASE 
    WHEN fs.current_watched THEN 'already_watched'  -- NEW
    WHEN fs.manually_unlocked THEN 'manually_unlocked'
    ...
  END as unlock_reason
```

### Step 2: Update TypeScript Types

Update `src/integrations/supabase/types.ts` to include the new `'already_watched'` unlock reason in the return type (for type safety).

### Step 3: Test Scenarios

After deployment, verify:
1. Student A (no batch) watches videos 1-3
2. Admin assigns Student A to Batch X (start date = today)
3. Videos 1-3 remain accessible
4. Video 4+ follows the batch drip schedule

---

## Technical Details

### Database Migration

```sql
CREATE OR REPLACE FUNCTION public.get_course_sequential_unlock_status(...)
-- Key changes in the full_status CTE:
-- 1. Add join to recording_views for current recording
-- 2. Check current_watched in unlock conditions
-- 3. Add 'already_watched' to unlock_reason CASE
```

### Files to Modify

1. **New migration**: Update `get_course_sequential_unlock_status` function
2. **src/integrations/supabase/types.ts**: Add `'already_watched'` to unlock_reason union type (auto-generated after migration)

### Edge Cases Handled

| Scenario | Expected Behavior |
|----------|-------------------|
| Student watched video, batch assigned later with newer date | Video stays unlocked |
| Student didn't watch video, batch assigned | Video follows batch drip |
| Batch removed from student | Falls back to LMS access date for unwatched videos; watched videos stay unlocked |
| Video watched but assignment not submitted | Video unlocked, but next video blocked by sequential rules |

---

## Expected Outcome

- Students who have already made progress won't lose access to content they've watched
- The batch schedule applies only to **future** content dripping
- Sequential unlock rules (watch previous + assignment approval) still apply
- No changes needed to UI code — it already reads `is_unlocked` from the RPC

