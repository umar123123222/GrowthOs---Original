# How To Set Different Drip Days Per Context

After the migration + UI changes ship, here's exactly how you'll set separate drip timings for the same lesson across different contexts.

## Where you do it

`ContentTimelineDialog` (the "Content Timeline" dialog opened from a Pathway, a Course, or the standalone Recordings admin view). It's the same dialog — behavior changes based on **where you opened it from**.

## The 3 contexts

| Opened from | What you're editing | Written to |
|---|---|---|
| Pathway → Course → Lesson | Drip days for that lesson **only when accessed via this pathway** | `lesson_drip_overrides(pathway_id, course_id, lesson_id)` |
| Course → Lesson (no pathway) | Drip days for that lesson **when the course is enrolled standalone** | `lesson_drip_overrides(pathway_id=NULL, course_id, lesson_id)` |
| Recordings admin (global default) | Global fallback for the lesson | `available_lessons.drip_days` |

## Example — your original scenario

Lesson: **Course A · Lesson 1**

1. Open Pathway A → Course A → Timeline. Set Lesson 1 drip = **3 days**. Save.
   → Row inserted: `(pathway_a, course_a, lesson_1, 3)`
2. Open Pathway B → Course A → Timeline. Set Lesson 1 drip = **12 days**. Save.
   → Row inserted: `(pathway_b, course_a, lesson_1, 12)`
3. Open Course A (standalone) → Timeline. Set Lesson 1 drip = **1 day**. Save.
   → Row inserted: `(NULL, course_a, lesson_1, 1)`

Result at unlock time, per student:
- Student in Pathway A → unlocks on day 3
- Student in Pathway B → unlocks on day 12
- Student with direct Course A enrollment → unlocks on day 1

## Visual cues in the dialog

Each lesson row shows:
- The current effective value (number input)
- A badge: **Pathway override** / **Course override** / **Default**
- A **"Reset to default"** button — deletes the override row, falls back to the next tier

## Resolution order (backend)

When `get_sequential_unlock_status` computes an unlock date it does:

```
COALESCE(
  pathway+course override,   -- most specific
  course-only override,      -- standalone / cross-pathway
  available_lessons.drip_days, -- global default
  0
)
```

## Existing students

Backfill seeds `lesson_drip_overrides` with today's effective value for every active `(pathway, course, lesson)` enrollment, so **no student's unlock dates shift**. New overrides you set afterwards only apply going forward to that context.

## What stays unchanged

- `available_lessons.drip_days` — still the global fallback
- `success_sessions` — sessions still use fixed calendar dates, not drip
- `course_enrollments`, `user_unlocks`, `batches` — untouched

Approve to keep executing the already-proposed migration + UI wiring.
