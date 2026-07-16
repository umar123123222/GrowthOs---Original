## Goal

For unbatched students only, restrict Success Session visibility (upcoming, live, and recordings) to sessions that are:
1. Explicitly targeted at unbatched students, AND
2. In a course the student is enrolled in, AND
3. Scheduled strictly after the student's enrollment date in that course.

Batched students: no changes.

## Targeting field (verified against schema)

`success_sessions.batch_ids` (jsonb array) is the audience field. When the admin selects the "unbatched" audience, this array contains the sentinel string `'unbatched'` (confirmed via DB — rows exist with `batch_ids = ["unbatched"]`). `batch_id` (singular) and non-sentinel UUIDs in `batch_ids` are batch targets and must be hidden from unbatched students.

## Changes — `src/pages/LiveSessions.tsx` only

### 1. `fetchAttendance` — build per-course enrollment date map
Replace the `studentCourseIds: string[]` derivation with a `Map<string, Date>` of `course_id → earliest enrolled_at` (from active `course_enrollments` rows for this student). Pass this map into `fetchSessions` in place of `studentCourseIds`.

### 2. `fetchSessions` — server query for unbatched students
For unbatched students (no `studentBatchId`), simplify the server `.or(...)` to fetch only sessions that could possibly match: rows where `batch_ids` contains `'unbatched'`. Drop the "global session" and "batch-targeting" clauses for this path — unbatched students should never see globally-untargeted or batch-targeted sessions per the new rule. Batched students keep the existing `.or(...)` shape unchanged.

### 3. `isVisibleToStudent` — new unbatched branch
- Batched student branch: unchanged (global sessions + batch match on `batch_id`/`batch_ids`).
- Unbatched student branch (strict, replaces current logic):
  - `batch_ids` must include `'unbatched'` (explicit targeting required).
  - `session.course_id` must be present AND exist as a key in the enrollment-date map.
  - `new Date(session.start_time) > enrolledAt` for that course (strictly after — same-day excluded).
  - If any check fails, hide.

### 4. Recordings filter
Keep the existing `effectiveEnd(session) < now && hasRecordingLink` filter for the recorded list. Visibility rule above applies uniformly to upcoming, live, and recorded sessions (the visibility filter runs before the upcoming/past split), which matches the requirement.

## Verification

- Unbatched student enrolled in Course A on Jan 4:
  - Session in Course A on Jan 5 targeted at `unbatched` → visible.
  - Session in Course A on Jan 4 (same day) targeted at `unbatched` → hidden.
  - Session in Course B targeted at `unbatched` → hidden.
  - Session in Course A on Jan 5 targeted at a specific batch (no `'unbatched'` in `batch_ids`) → hidden.
  - Session with empty/global `batch_ids` → hidden.
- Batched student: identical output to current behavior.

No database, RLS, or edge function changes.
