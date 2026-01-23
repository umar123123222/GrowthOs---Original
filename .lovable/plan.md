
### Goal
When a superadmin schedules a Success Session, they must be able to select:
- the **Course**
- the **Batch** (or an option that covers “unbatched / all batches”)

Then:
- **Students** only see sessions that match the course they are currently enrolled in **and** (if specified) their batch.
- **Mentors** only see sessions relevant to them (filtered), instead of all sessions.

---

## What’s currently happening (why this is needed)
- `success_sessions` already has `course_id` in the DB types, but the UI does not select it today.
- There is **no `batch_id`** on `success_sessions`, so you can’t target a specific batch.
- RLS currently allows **all authenticated users** to view **all** success sessions; even if the UI filters, a student could still query other sessions if they knew how.

---

## Proposed behavior (matches your requirement)
### Scheduling (Superadmin)
In **/superadmin?tab=success-sessions** (SuccessSessionsManagement):
1. Select **Course**
2. Select **Batch**
   - Show batches belonging to that course
   - Include one extra option to cover students “currently doing ecommerce” but not in a batch:
     - **Unbatched students (no batch assigned)**

### Student visibility (Live Sessions page)
A student will see a success session if:
- they have an **active** enrollment (`course_enrollments.status = 'active'`) in that session’s `course_id`, AND
- either:
  - session has a specific `batch_id` and the student’s enrollment has the same `batch_id`, OR
  - session is marked **unbatched** (batch_id is NULL) and the student’s enrollment is also unbatched (batch_id is NULL)

This supports your “batch number + currently doing ecommerce (course/pathway)” request because both pathways and direct course enrollments are stored in `course_enrollments` via `course_id` (and optionally `pathway_id`).

### Mentor visibility (Mentor Sessions page)
A mentor will only see sessions where:
- `success_sessions.mentor_id = auth.uid()`

(So mentors are filtered, as you requested.)

---

## Implementation steps (in order)

### 1) Database: add batch targeting to success sessions
Create a new migration:
- Add column: `success_sessions.batch_id uuid NULL REFERENCES batches(id) ON DELETE SET NULL`
- Add index for performance: `idx_success_sessions_batch_id`
- (Optional but recommended) update the view `segmented_weekly_success_sessions` to include `course_id` and `batch_id` as well, so it stays consistent.

### 2) Database security (RLS): enforce visibility rules server-side
Update `success_sessions` SELECT policy so it is no longer “all authenticated users can view everything”.

New SELECT logic:
- Staff (`admin`, `superadmin`, `enrollment_manager`) can still view all
- Mentors can view sessions where `mentor_id = auth.uid()`
- Students can view sessions only if an active enrollment exists that matches course+batch rules

This prevents accidental data exposure and ensures the UI and DB agree.

### 3) Update Supabase TypeScript types used by the app
Update `src/integrations/supabase/types.ts` `success_sessions` row/insert/update types to include:
- `batch_id: string | null`

This keeps the app type-safe when we store/fetch the new field.

### 4) Superadmin UI: add Course + Batch selectors to “Schedule Session”
Modify `src/components/superadmin/SuccessSessionsManagement.tsx`:
- Add state for:
  - list of courses (`courses`)
  - list of batches (`batchesForSelectedCourse`)
- Load courses via Supabase (`courses` table)
- When `course_id` changes, load batches for that course from `batches` (probably only `status='active'`, but we can also show all if you prefer)
- Extend `SessionFormData` with:
  - `course_id`
  - `batch_id` (nullable; allow “unbatched” by storing NULL)
- Include course_id + batch_id in insert/update payload
- Update the sessions table list to display course/batch (helps admins verify targeting)

### 5) Student UI: show only relevant sessions
Modify `src/pages/LiveSessions.tsx`:
- In the authenticated flow (`fetchAttendance`), fetch the student’s enrollments:
  - `students` table to get the `student_id` from `user_id`
  - `course_enrollments` filtered to `status='active'`
- Fetch success sessions filtered to only those matching:
  - `course_id in enrolled course_ids`
  - plus batch filtering rules described above
- Pick “next upcoming session” from those results
- Past sessions filtering can continue, but instead of using `users.created_at`, prefer:
  - use `course_enrollments.enrolled_at` (more correct)
  - if multiple enrollments, use the earliest relevant enrolled_at

### 6) Mentor UI: filter to assigned sessions
Modify `src/components/mentor/MentorSessions.tsx`:
- Change query from “fetch all success_sessions” to:
  - `.eq('mentor_id', user.id)`
- Keep the rest of the UI the same.

### 7) Validate end-to-end
Manual test checklist:
- Superadmin: create a session with Course A + Batch 1 → only students in Batch 1 see it
- Superadmin: create a session with Course A + Unbatched → only unbatched students in Course A see it
- Student in Course B → should not see Course A sessions
- Mentor assigned as host → sees their sessions; other mentors do not

---

## Decisions already inferred from your answers
- Enrollment status qualifying visibility: **Active only**
- Visibility: **Students filtered and mentors filtered**
- Targeting must support both “batch number” and “currently doing ecommerce” across pathway or direct enrollment: handled via `course_enrollments.course_id` + optional `batch_id`

---

## Small clarifications (we can proceed without blocking, but these affect details)
1) Should admins/enrollment managers see all sessions in management pages? (Recommended: yes.)
2) For the batch selector, should we show only `status='active'` batches or include archived/inactive too?

If you approve this plan, I’ll implement the DB migration + RLS + UI changes together so everything stays consistent.