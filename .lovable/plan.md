# Fix "wrong invoice details" on student rows

## What the user sees
Random students show inflated **Total Fee Amount**, wrong **Amount Paid / Outstanding**, and misleading **Invoice Due Date** and **Invoice Status**. Example from the screenshot: STU000638 shows Rs 120,000 total / Rs 65,000 outstanding / due Sep 28 — but that student is really enrolled in a single 55k program.

## Root cause (confirmed from code + prior DB investigation)

`src/components/superadmin/StudentsManagement.tsx` computes every billing field by summing **all rows in `invoices` for that `student_record_id`**, with no filter on `course_id` / `pathway_id`:

- `fetchInstallmentPayments` (lines ~433–472) loads every invoice row for the student into a single flat array keyed only by `student_id`.
- `getPaymentSummary` (lines ~1640–1661), the Total Fee / Amount Paid / Outstanding panel (lines ~3074–3115), `getInvoiceDueDate` (~1620), `getLastInvoiceSentDate` (~1609), `getInvoiceStatus`, and the "Mark 1st/2nd/3rd Paid" buttons (~3159) all read from that flat array.

So the moment a student has **more than one enrollment** (or leftover invoices from a previous enrollment), the row shows the **sum across enrollments**:

- Batch 301 case: students were unenrolled from Master Pathway 1 and re-enrolled into Master Pathway 2, but MP1's unpaid/scheduled invoices were never cleaned up. UI sums MP1 (55k) + MP2 (65k) = 120k.
- Any student with a real second enrollment (individual course + pathway) hits the same bug even without orphans.
- "Invoice Due Date" picks the earliest open invoice across *any* enrollment, so a fresh MP2 installment can masquerade as a late LMS installment (matches the earlier "reminder with wrong amount/due date" report).
- The 1st/2nd/3rd Paid buttons match by `installment_number` only, so installment #2 of MP2 collides with installment #2 of MP1.

Two independent things are broken:

1. **UI aggregation bug** — billing panel doesn't group by enrollment. This is what makes the numbers *look* wrong for correctly-enrolled students.
2. **Data hygiene bug** — unenroll flow leaves orphan invoices behind, which amplifies #1 into obviously wrong totals like 120k.

## Fix

### Part A — UI: show billing per enrollment (no business-logic changes)

In `src/components/superadmin/StudentsManagement.tsx`:

1. Change `fetchInstallmentPayments` to also select `course_id, pathway_id` from `invoices` and store them on each `InstallmentPayment` entry.
2. Add a helper `groupPaymentsByEnrollment(payments)` that returns `Array<{ key, label, courseId?, pathwayId?, payments[] }>` where `label` comes from the student's `course_enrollments` (course/pathway name already loaded elsewhere on the row).
3. In the expanded student panel (lines ~3060–3170), replace the single Total/Paid/Outstanding/Due block with one block **per enrollment group**. Each group renders:
   - Program name header (e.g. "Master Pathway 2" or "Client Acquisition Mastery")
   - Total Fee Amount, Amount Paid, Outstanding, Invoice Due Date, Invoice Status — all computed from that group's payments only
   - "Mark Nth Paid" buttons scoped to that group (pass `course_id`/`pathway_id` into `handleMarkInstallmentPaid` so the correct invoice row is targeted).
4. Keep a small **"All enrollments" summary line** at the top of the panel (sum across groups) so admins still see the combined figure, but clearly labeled as a sum.
5. Update `getInvoiceStatus`, `getInvoiceDueDate`, `getLastInvoiceSentDate`, `isInvoiceOverdue`, `getPaymentSummary` to accept an optional `enrollmentFilter` and use it in the per-group renders. The collapsed row (one line per student) keeps using the aggregate — but we'll switch its badge to say "Multiple enrollments" when >1 group exists so it's never mistaken for a single-program total.
6. CSV export (line ~2403) gets one row per enrollment instead of one row per student, so exported totals also stop being summed.

No changes to invoice creation, reminders, or edge functions in Part A.

### Part B — Data hygiene: stop leaving orphan invoices behind

In `src/components/admin/StudentAccessManagement.tsx` (the unenroll path referenced in earlier turns), when an enrollment is removed:

- Delete `invoices` rows for that `(student_id, course_id|pathway_id)` where `status IN ('pending','scheduled','overdue')` and `paid_at IS NULL`.
- Keep paid invoices (historical record) but tag them so Part A's grouping still labels them under the old program.
- If no invoices were ever paid for that enrollment, delete the enrollment row entirely (already discussed in the earlier Batch-301 plan — reconfirming it here so orphans stop being created going forward).

### Part C — One-time cleanup for existing orphans

A single migration that, for every student, deletes unpaid/scheduled invoices whose `course_id`/`pathway_id` no longer matches any row in `course_enrollments` for that student. This clears the current 120k-style rows without touching anyone's paid history. Runs once; safe to re-run (idempotent).

## Files to change

- `src/components/superadmin/StudentsManagement.tsx` — Part A (grouping, per-enrollment panel, scoped mark-paid, CSV).
- `src/components/admin/StudentAccessManagement.tsx` — Part B (delete orphan invoices on unenroll).
- New migration under `supabase/migrations/` via the migration tool — Part C (cleanup existing orphans).

## Verification

- STU000638 and other batch-301 students should show a single "Master Pathway 2 — Rs 65,000" group after Part C, and the aggregate line should match.
- Students with legitimate multi-enrollment (e.g. Raheel with LMS 55k + Ecom360 65k) should show two separate groups with correct per-program totals and per-program due dates.
- Mark-Paid buttons should update only the targeted enrollment's invoice.

## Safety

- No changes to invoice amounts, statuses, or schedules for paid invoices.
- Part C only deletes `status IN ('pending','scheduled','overdue') AND paid_at IS NULL` rows whose enrollment no longer exists — no paid history is touched.
- Part B mirrors the deletion rule so this class of bug can't reappear.
