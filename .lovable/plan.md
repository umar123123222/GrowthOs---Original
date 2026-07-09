## Goal
Make "Unbatched students" a real audience target for Success Sessions. Today the app silently strips the `unbatched` selection on save, so choosing only "Unbatched students" ends up equivalent to "All Batches". We need it to mean: **only students not in any batch, and only those enrolled in the chosen course**.

## Behavior after the change

- In the Schedule/Edit dialog, when "Unbatched students" is selected (with or without batches alongside it), the selection is preserved instead of stripped.
- If "Unbatched students" is the only selection, a **Target Course is required** (form validation blocks save with a clear error). This matches the rule that unbatched targeting is meaningless without a course.
- A saved session with `unbatched` targeting is visible to a student only if all are true:
  - the student has no active batch (`students.batch_id IS NULL`)
  - the student is enrolled in the session's `course_id`
  - session status is `upcoming` / `live` / `completed` (unchanged)
- Batched students remain unaffected: sessions with real batch IDs still show only to those batches.
- The admin table/badge shows an "Unbatched" chip alongside batch chips so admins can see the targeting at a glance.
- Email/in-app notifications on schedule/publish are sent to the qualifying unbatched students of the chosen course (in addition to any batches also selected).

## Where the changes land

### Data (no schema change)
- Continue using the existing `success_sessions.batch_ids` JSONB column. Store the literal string `'unbatched'` inside the array alongside real batch UUIDs.
  - `null` / `[]` → all students (unchanged global session).
  - `['unbatched']` → unbatched students in `course_id` only.
  - `['unbatched', '<batchA>', ...]` → union of unbatched (in course) + those batches.

### Admin UI — `src/components/superadmin/SuccessSessionsManagement.tsx`
- Stop filtering `'unbatched'` out in the save paths (draft, create, update). Persist it as-is inside `batch_ids`.
- Add form validation: if `batch_ids` contains `'unbatched'` and `course_id` is `__all__`/empty, block submit with a toast: "Select a Target Course when targeting unbatched students".
- Update the selected-batches summary label so `['unbatched']` shows "Unbatched students" and mixed selections show e.g. "Unbatched + 2 batches".
- In the sessions table row, render an "Unbatched" chip when `batch_ids` contains `'unbatched'`.
- Admin batch filter dropdown: add an "Unbatched" option that matches sessions whose `batch_ids` includes `'unbatched'`.

### Student visibility — `src/pages/LiveSessions.tsx`
- Load the current student's `batch_id` and enrolled `course_id`s (via existing hooks/queries) before the sessions query.
- Extend the visibility filter `isVisibleToStudent`:
  - global session (no targeting) → visible (unchanged).
  - `batch_ids` contains the student's batch → visible (unchanged).
  - `batch_ids` contains `'unbatched'` AND student has no batch AND session's `course_id` is in the student's enrolled courses → visible.
  - otherwise hidden.
- Adjust the initial `.or(...)` server-side filter so unbatched students still receive candidate rows containing `'unbatched'`, then let the client-side filter enforce the course match.

### Notifications — `supabase/functions/send-batch-content-notification/index.ts` + admin call sites
- Add a new invocation mode: when the admin's resolved audience includes `'unbatched'`, additionally invoke the function with `{ unbatched: true, course_id }` (in place of `batch_id`).
- Inside the edge function, when `unbatched === true`:
  - Look up students where `students.batch_id IS NULL` AND they are enrolled in `course_id` (via `course_enrollments`).
  - Reuse the existing email + in-app notification code path against that user list.
- Admin `handleSubmit` / `handlePublish` fires this alongside the existing per-batch invokes (still fire-and-forget so the dialog closes fast).

## Out of scope
- No schema/migration changes.
- No changes to how batched sessions or fully-global sessions behave.
- No changes to legacy `batch_id` scalar handling beyond what's already in place.
