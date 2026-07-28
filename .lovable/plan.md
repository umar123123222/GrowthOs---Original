
# Phase 2: Enrollment Price Snapshots

Goal: prevent the "total fee drifted from 55k → 120k" class of bug by locking each enrollment to the price it was created with. Nothing about existing student data, invoices, LMS access, or UI totals changes on rollout — the snapshot is added and used only going forward.

## Why this is safe for existing students

- The snapshot column is **added, not enforced**. Existing rows get a backfill equal to their current effective price, so their displayed totals stay identical.
- No invoice amounts are recalculated. No enrollment is re-priced. No RLS or access rule changes.
- Reads keep working exactly as today. New reads that want the snapshot can opt in; nothing is forced to migrate.
- Every write path stays backward compatible: if a caller doesn't pass a snapshot, we auto-fill from the current course/pathway price (same behavior as today).

## What gets built

### 1. Schema (single migration, additive only)

Add to `public.course_enrollments`:
- `snapshot_price numeric` — the locked price at enrollment time
- `snapshot_currency text` — currency at enrollment time
- `snapshot_source text` — `'course' | 'pathway' | 'manual_override'`
- `snapshot_taken_at timestamptz`

No `NOT NULL`, no defaults that would touch existing rows, no unique constraints. All nullable so nothing breaks if a legacy row lacks a snapshot.

### 2. Backfill (idempotent, read-only against source data)

For every existing enrollment where `snapshot_price IS NULL`:
- If `pathway_id` set → copy `pathways.price` / `pathways.currency`
- Else if `course_id` set → copy `courses.price` / `courses.currency`
- Fallback: use `total_amount` from the enrollment itself so the number matches what admins already see

The backfill only writes the four new snapshot columns. `total_amount`, `amount_paid`, invoices — untouched.

### 3. Write path updates (enrollment creation)

In `StudentAccessManagement.tsx` (and any other place that inserts into `course_enrollments`), when creating a new enrollment:
- Read the current `courses.price` or `pathways.price`
- Store it in `snapshot_price` on the insert
- Also keep passing `total_amount` as today (so invoicing logic is unchanged)

If a superadmin changes the pathway/course price later, the enrollment keeps its snapshot. New enrollments after that use the new price. Old students are unaffected.

### 4. Data Audit page — new "Price Drift" check

Extend the `detect-billing-drift` edge function with a new finding type: `SNAPSHOT_MISMATCH` — flags enrollments where `snapshot_price` differs from `total_amount` or from the current course/pathway price. Read-only, surfaced in the existing `/superadmin?tab=data-audit` UI. No auto-fix.

### 5. Optional per-enrollment "Repricing" tool (manual, gated)

On each enrollment card in `StudentsManagement.tsx`, add a small "Reprice" action visible to superadmin only. It:
- Shows: snapshot price vs current catalog price
- Requires explicit confirmation to update `snapshot_price` + `total_amount`
- Logs the change to `admin_logs`

Not run automatically anywhere. Purely a manual reconciliation tool for edge cases.

## What is explicitly NOT in this phase

- No changes to how invoices are generated
- No changes to how totals are summed in the UI (Phase 1 grouping already handles the 120k bug visually)
- No new constraints that could reject existing rows
- No changes to unenrollment, LMS access, drip, or sequential logic
- No cron jobs that mutate data

## Rollout order

1. Migration: add columns + backfill in one transaction
2. Update insert code paths to write snapshot on new enrollments
3. Add `SNAPSHOT_MISMATCH` check to drift scanner
4. Ship "Reprice" manual tool (superadmin-only)
5. Watch Data Audit for a few days; if clean, propose Phase 3 (duplicate-enrollment guard)

## Rollback plan

Every step is reversible:
- Drop the 4 columns (no dependency on them anywhere critical)
- Revert the insert code (snapshot becomes NULL, existing reads unaffected)
- Remove the drift check (Data Audit still works)

## Approval needed

Confirm you want me to proceed with steps 1–4 in this order. I will not touch any existing student's invoices, totals, or access at any point.
