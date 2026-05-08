## Diagnosis: mrowais014@gmail.com

**Student state**
- Enrolled in pathway `a16b8328` via batch **287** (start date **2026-04-03**).
- The "Freelancing with AI" course in question (`915a661b`) is part of that pathway (no direct course enrollment).
- Today is 2026-05-08.

**What the RPC returns for the locked Chapter 5 lessons**
| # | Title | drip_days | Computed unlock | Displayed |
|---|---|---|---|---|
| 3 | Fiverr - Ranking Tips & Tricks | 93 | 2026-07-05 | "Unlocks 7/5/2026" |
| 4 | Fiverr - Communication with client | 94 | 2026-07-06 | "Unlocks 7/6/2026" |
| 5 | Fiverr - Conclude.mp4 | 95 | 2026-07-07 | "Unlocks 7/7/2026" |

`get_course_sequential_unlock_status` calculates `drip_unlock_date = batch.start_date + drip_days`, i.e. **April 3 + 93 days = July 5, 2026**.

**Root cause (two issues)**

1. **Drip schedule is absolute pathway-wide, not per-course.** Every lesson in the Freelancing course has `drip_days` 87…106 (course #1 of pathway uses 1…86, etc.). So drip is a single linear "day N from batch start" counter across all courses in the pathway. There is **no course-level offset column** (`courses`, `pathway_courses`, `batch_courses` have no `drip_offset_days` / `start_day` column), so the RPC has no way to anchor a course to "the day this course is supposed to start."
2. **UI date format is ambiguous.** `RecordingRow.tsx` uses `new Date(...).toLocaleDateString()` (no locale, no options). In the user's browser this renders as `7/5/2026` (M/D/Y), which is easily misread as 7 May (D/M/Y). The student/admin reading the screenshot believed the unlock was "yesterday" (May 7) when the system actually scheduled it for **July 5**.

So technically the lessons are NOT overdue — they are scheduled correctly per the configured `drip_days`. The two real problems are:

- (A) The displayed date is locale-ambiguous and is being misread.
- (B) If the intent is "Chapter 5 of Freelancing should unlock about a month after enrollment, not 3 months", the `drip_days` values themselves need to be corrected (or a course-level offset feature needs to be added).

**Project-wide check**
- 658 / 667 students have an active `course_enrollments` row, so the RPC's batch-anchored drip path applies to almost everyone.
- 9 students have **no** `course_enrollments` at all (asaad_1995, aftab.gsk, aqibh2909, coolghazi2012, snapshop1980, syed.jaffery90, shayanbilal2112000, modernplastic.ash, abdulrahmankhi917). For them the RPC falls back to `students.enrollment_date` as the drip anchor and `v_has_course_access` is **false**, so every lesson shows `not_started_yet`. They effectively cannot see any content. This is a separate bug worth flagging.

---

## Proposed fix (two parts)

### Part 1 — Unambiguous date display (frontend only)
In `src/components/videos/RecordingRow.tsx`, change the lock label from
`new Date(d).toLocaleDateString()` to a format that cannot be misread, e.g. `"Unlocks 5 Jul 2026"` using `toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })`. Apply the same to any other place that prints `dripUnlockDate` (`StudentDashboard.tsx`, `SequentialUnlockAdmin.tsx`, `assignments/StudentAssignmentList.tsx`, `superadmin/RecordingsManagement.tsx`).

This alone resolves the "yesterday vs July" confusion in the screenshot.

### Part 2 — Confirm the drip schedule intent (needs your input)
Before changing data or the RPC, please confirm which of these matches your intent so I can plan the right migration:

- **Option A — drip_days are correct as-is.** Chapter 5 of Freelancing is genuinely meant to unlock in early July for a batch that started Apr 3. No data change needed; only Part 1 applies.
- **Option B — drip_days should be reset per course** (lesson 1 of every course = day 1 of that course). I will add a `drip_offset_days` column on `pathway_courses` (and/or `batch_courses`), backfill it from existing pathway sequencing, and update `get_course_sequential_unlock_status` to use `batch_start + course.offset + lesson.drip_days`.
- **Option C — drip_days values are wrong and need to be re-numbered** (e.g. each course should start at day 1). I will rewrite `available_lessons.drip_days` per course.

### Part 3 — Fix the 9 orphaned students
Either backfill `course_enrollments` for the 9 students above (preferred) or extend the RPC's fallback to grant pathway access via `students.enrollment_date` when no `course_enrollments` row exists. I'll handle this as a separate migration once you confirm.

---

## Files / objects affected
- `src/components/videos/RecordingRow.tsx` (and 3-4 other files showing `dripUnlockDate`) — date format change.
- DB function `get_course_sequential_unlock_status` — only if Option B.
- `pathway_courses` / `available_lessons` data — only if Option B or C.
- `course_enrollments` — backfill for the 9 orphaned students (Part 3).

Please pick A / B / C for the drip schedule and confirm whether to backfill the 9 orphan students, and I'll write the migration + code edits.