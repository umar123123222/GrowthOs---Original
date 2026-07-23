## Goal

Loosen the "duplicate Zoom link" block so a link can be reused across different (course, batch) targets. Only block when link + course + batch all match an existing session.

## Current behavior

- DB has a unique index `success_sessions_unique_link_start` on `(link, start_time)` — any second session with the same Zoom link at the same start time is rejected, regardless of course/batch (migration `20260616190206_...sql`).
- `SuccessSessionsManagement.tsx` (~line 747) catches `23505` and shows "A session with this Zoom link already exists at the same start time."
- Sessions target audience via `course_id` (single) and `batch_ids` (jsonb array; may contain batch UUIDs or the sentinel `'unbatched'` / `'__all__'`).

## Change

### 1. Drop the DB-level uniqueness

Drop `success_sessions_unique_link_start`. Multi-value `batch_ids` (jsonb) cannot be expressed cleanly in a partial unique index that means "any overlapping batch", so we move the check into the app where the semantics are clear.

### 2. Application-level duplicate check (create + edit)

Before insert/update in `SuccessSessionsManagement.tsx` `handleCreateSession` / update path:

- Skip check if `link` is empty or `'TBD'`.
- Query `success_sessions` for rows where:
  - `link = formData.link`
  - `course_id = formData.course_id`
  - `id <> editingSession?.id` (so editing a session doesn't collide with itself)
- For each candidate row, compare `batch_ids` arrays:
  - Normalize both sides to a `Set<string>` of ids.
  - Treat `'__all__'` in either side as "matches every batch of the other" (an all-batches session collides with any batch selection on the same course + link).
  - Otherwise, collision = the two sets share at least one id (including the `'unbatched'` sentinel).
- If any candidate collides, block with a toast:
  > "A session with this Zoom link already exists for the same course and batch. Change the link, course, or batch to create a new one."
- If no collision, proceed with insert/update.

Same check runs in both the create branch and the edit branch of the submit handler.

### 3. Error-handling cleanup

Remove the `23505 / success_sessions_unique_link_start` branch in the catch block — the DB constraint is gone, so the branch is dead. Keep generic error toast.

## Out of scope

- No changes to visibility logic, RLS, reminder emails, or the batch/host pickers.
- `start_time` is no longer part of the uniqueness key at all (per the request: link + course + batch is the full rule).

## Files touched

- New migration: drop `success_sessions_unique_link_start`.
- `src/components/superadmin/SuccessSessionsManagement.tsx`: add pre-submit duplicate check for create + edit; remove obsolete 23505 branch.
