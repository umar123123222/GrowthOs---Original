
# Phase 3: Duplicate-Enrollment Guard

Prevent the "same student enrolled twice into the same pathway/course" class of bug that caused the 55k → 120k drift on Batch 301. Existing students — including the 3 pathway-duplicated ones already in the DB — are not touched or blocked.

## Existing state (checked)

Live scan found 3 students with duplicate enrollments in the same pathway (`a16b8328-…` = Master Pathway 2):
- `21f8c871-…` (3 rows)
- `5bf46d46-…` (3 rows)
- `e30af719-…` (2 rows)

A strict `UNIQUE` index would reject these on migration → not acceptable. We use a **trigger-based guard** instead: blocks only NEW duplicates, tolerates existing ones.

## What gets built

### 1. Migration — BEFORE INSERT trigger on `course_enrollments`

- Function `public.prevent_duplicate_enrollment()`:
  - For pathway inserts (`pathway_id IS NOT NULL`): raise if a row already exists with same `student_id + pathway_id`.
  - For standalone course inserts (`course_id IS NOT NULL AND pathway_id IS NULL`): raise if a row already exists with same `student_id + course_id AND pathway_id IS NULL`.
  - Error message includes the existing enrollment id so admins can see which record is the conflict.
- No `UNIQUE` constraint, no backfill, no updates to existing rows.
- Trigger is `BEFORE INSERT` only — updates/deletes unaffected, so all current admin flows (Mark Paid, Delete, Reprice, etc.) keep working.

### 2. Drift scanner — new `DUPLICATE_ENROLLMENT` finding

Extend `detect-billing-drift` to also report duplicate enrollments (read-only). Shows up in the existing Data Audit page under Billing Drift with:
- Student id + name
- Kind: `pathway` or `course`
- Target id + name
- Number of duplicate rows and their ids

This surfaces the 3 known duplicates so a superadmin can review and manually clean them via the existing per-enrollment Delete button — no auto-fix.

### 3. Friendly error in `StudentAccessManagement.tsx`

Wrap the 4 enrollment insert calls (pathway + course tabs) to detect the trigger error and show a clear toast: "This student is already enrolled in {name}. Remove the existing enrollment first." Falls back to the raw error otherwise.

## Explicitly NOT in this phase

- No `UNIQUE` constraints
- No automatic cleanup of the 3 existing duplicates
- No changes to invoices, totals, LMS access, or drip logic
- No changes to update/delete paths

## Rollback

- Drop the trigger + function (1 statement) → behavior reverts exactly to today
- Revert the toast wrapper (cosmetic only)
- Remove the `DUPLICATE_ENROLLMENT` finding from the scanner (Data Audit still works)

## Approval

Confirm and I'll ship steps 1–3 in order. No existing student's data changes.
