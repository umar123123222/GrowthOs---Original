# Setting Drip Days for Client Acquisition Mastery (Course-Only Context)

Since you opened the Content Timeline dialog from **Superadmin → Content → Courses tab → clock icon on Client Acquisition Mastery**, you're editing the **course-only** drip context.

## What this means

- Any drip day you set here is saved to `lesson_drip_overrides` with `pathway_id = NULL`, `course_id = <Client Acquisition Mastery>`, `lesson_id = <lesson>`.
- These values apply **only** to students who are enrolled directly in Client Acquisition Mastery (not through a pathway).
- Students already in Pathway A or Pathway B who reach this course through their pathway are **not affected** — they use the pathway-scoped override row instead.

## How to set the values

1. In the open dialog, locate each lesson row.
2. Change the "Drip days" number to the desired value (e.g., Lesson 1 = 1, Lesson 2 = 3, Lesson 3 = 7).
3. Click **Save**. Each row upserts into `lesson_drip_overrides` with `pathway_id = NULL`.
4. To revert a lesson to the global `available_lessons.drip_days` default, click **Reset to default** on that row — this deletes the course-only override.

## Confirming the context in the UI

Right now the dialog title doesn't explicitly say "Course-only" vs "Pathway X". Proposed small UI addition (to be built in the same change):

- Add a **context badge** in the dialog header:
  - "Editing: Course-only drip (Client Acquisition Mastery)" when opened from the Courses tab
  - "Editing: Pathway A drip → Client Acquisition Mastery" when opened from a pathway
- Add a per-row badge already planned: **Course override** / **Pathway override** / **Default** so you can see at a glance which tier the current value comes from.

## Existing students

- Backfill (already in the shipped migration) seeded rows for every active enrollment, so today's unlock schedule is frozen.
- New values you set now only change unlock dates for **future** direct enrollments in Client Acquisition Mastery. No existing student's dates shift.

## What stays untouched

- Pathway A / Pathway B rows for the same lessons
- `available_lessons.drip_days` global defaults
- `success_sessions`, `course_enrollments`, `user_unlocks`, `batches`

Approve to add the context badge + per-row tier badges to `ContentTimelineDialog` so you always know which scope you're editing.
