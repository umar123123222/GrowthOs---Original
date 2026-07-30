## What I verified for Makhdoom (STU000887)

- Student record `59a362f6…`, one active enrollment: pathway `a16b8328…` **and** `course_id 425c1782…` both set, `total_amount = 55,000`, `snapshot_price = 65,000` (catalog price).
- Two invoices, both **paid**, 27,500 each = 55,000, with `pathway_id` set and **`course_id = NULL`**.
- His open finding was created on **2026-07-28** with `expected 55,000 / actual 0 / difference -55,000`, `paid_total 55,000`, `unpaid_total 0`, `snapshot_mismatch: true`.

## Why he still shows up (three separate causes)

1. **Invoice matching key mismatch.** The scanner groups invoices by `student::course::pathway`. His enrollment key is `student::425c1782::a16b8328` but his invoices key is `student::(empty)::a16b8328`. Nothing matches, so "Actual (invoices)" reads 0 and the difference reads -55,000 even though he paid in full.
2. **The finding is stale.** The "skip fully cleared students" rule was added after 2026-07-28. Old rows are only auto-cleared on the next scan run, and no scan has run since — so the row survives with its old numbers.
3. **Snapshot mismatch is a false positive.** `snapshot_price` 65,000 vs agreed fee 55,000 is a legitimate negotiated discount, but the scanner treats any snapshot ≠ total as drift, which would keep flagging him even after a rescan.

## Plan

### 1. Fix invoice matching in `detect-billing-drift`
Match invoices to an enrollment by **pathway first, then course**, instead of the strict triple key:
- If the enrollment has a `pathway_id`, sum invoices for that student with the same `pathway_id` (ignore `course_id`).
- Else match on `course_id` (ignore `pathway_id`).
- Apply the same relaxed rule to the orphan-invoice detection, so pathway invoices are no longer counted as orphans.

### 2. Stop treating negotiated discounts as drift
Only flag `snapshot_mismatch` when the snapshot differs from the **current catalog price** (indicating a catalog price change after enrollment). Drop the `snapshot vs total_amount` comparison — a discounted total is expected and admin-set.

### 3. Clear stale findings
Re-run the scanner once after the fixes; the existing auto-resolve path will mark every no-longer-drifting student (including Makhdoom) as `auto_cleared`. Additionally, mark pre-fix open findings that are fully paid as auto-cleared in the same pass so the 499/693 open count drops to real cases only.

### 4. UI touch in Data Audit
Add a "Re-scan now" button on the Billing drift tab (superadmin only) that invokes `detect-billing-drift` and refetches, plus show a "last scanned" timestamp, so stale findings are obvious and fixable without waiting for cron.

## Safety

- The scanner and the rescan are read-only against `course_enrollments` and `invoices`; only `billing_drift_findings` rows are written. No student, enrollment, invoice, or access record is modified, so no existing student can be affected.
