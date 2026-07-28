
## Why this is happening (verified in code + DB)

I traced the enrollment path used by "Add Student" → `useEnhancedStudentCreation` → edge function `supabase/functions/create-enhanced-student/index.ts`. Two behaviors in that function can attach the wrong course to a pathway student and generate an invoice that later suspends them.

### Cause 1 — Batch "derivation" overrides the pathway selection
Lines ~328–342:
```ts
let selectedCourseId  = course_id  || null;
let selectedPathwayId = pathway_id || null;

if (batch_id && (!selectedPathwayId || !selectedCourseId)) {
  const batchRow = await ...('batches').select('pathway_id, course_id')...
  if (!selectedPathwayId && batchRow.pathway_id) selectedPathwayId = batchRow.pathway_id;
  if (!selectedCourseId  && batchRow.course_id)  selectedCourseId  = batchRow.course_id;
}
```
Then lines ~455 / ~497:
```ts
if (selectedCourseId) {           // ← wins even when pathway was selected
  insert course_enrollments { course_id: selectedCourseId, pathway_id: null,
                              enrollment_source: 'direct',
                              total_amount: finalFeeAmount,
                              payment_status: 'pending' }
} else if (selectedPathwayId) { ... }
```
So when an admin picks **Master Pathway** and a batch that has a `course_id` attached (most legacy batches do), the derivation fills in `selectedCourseId`, the `if` branch fires first, and the student is enrolled as a **direct course** for the pathway's fee → invoice is issued for the wrong item, and the pathway is never recorded. Then `mark-invoice-paid` / overdue jobs suspend the account when that "phantom" course invoice ages.

### Cause 2 — Silent "default course" fallback
Lines ~549+ (`else` after the two branches):
```ts
// Fallback: Auto-enroll in default course
const { data: defaultCourse } = await ...('courses')
  .eq('is_active', true).order('sequence_order').limit(1).maybeSingle();
insert course_enrollments { course_id: defaultCourse.id, total_amount: finalFeeAmount, payment_status: 'pending' }
```
If the request ever reaches the edge function without a course *or* pathway (form regression, batch with neither field, network retry that drops the body field), the student is silently enrolled in whatever course happens to sort first and invoiced for the full fee. This is the classic "random course showed up" symptom.

### Cause 3 — No trigger-level guard
`pg_trigger` on `course_enrollments` only has `trg_fill_enrollment_snapshot` and `prevent_duplicate_enrollment_trg`. Nothing rejects an enrollment whose `enrollment_source='pathway'` but `pathway_id IS NULL`, so Cause 1 writes succeed silently.

DB confirms the pattern: pathway students already show varying placeholder `course_id`s (Ecom 360 / Nurturing Sessions / Creative Psychology) tied to whichever batch they were placed in, and 4 pathway students carry an *extra* `enrollment_source='direct'` row on top of their pathway row.

---

## Fix plan (backend only — no student-facing UI change)

### 1. `supabase/functions/create-enhanced-student/index.ts`
- **Pathway wins**: change the branch order so that if `selectedPathwayId` is set, we always take the pathway branch. Only fall into the course branch when the admin explicitly picked a course and *no* pathway.
- **Scope batch derivation**: only derive `course_id` from batch when `selectedPathwayId` is also null. If a pathway is present, ignore `batchRow.course_id` — pathway enrollments intentionally use the pathway's first-step course as the anchor (already handled downstream).
- **Kill the default-course fallback**: replace the `else { auto-enroll in first active course }` block with a hard error (`return 400 { error_code: 'NO_ENROLLMENT_TARGET' }`) and log to `admin_logs`. No student should ever be created without an explicit course/pathway selection.
- Log a warning to `admin_logs` whenever batch derivation had to fill in a missing field, so we can spot future regressions.

### 2. Database guard (new migration)
Add a `BEFORE INSERT` trigger `enforce_enrollment_target_consistency` on `course_enrollments` that raises when:
- `enrollment_source = 'pathway'` and `pathway_id IS NULL`, or
- both `course_id` and `pathway_id` are `NULL`.

This makes Cause 1/2 impossible to reproduce even if another code path regresses. Grants and RLS unchanged.

### 3. One-time reconciliation (opt-in, run from Data Audit)
Extend `detect-billing-drift` with a new finding type `phantom_course_enrollment`:
- flag any `course_enrollments` row where the same student also has an active `pathway_id` enrollment covering that course via `pathway_courses`, AND the direct row was created within 60s of the pathway row (i.e. same signup, wrong branch), AND its invoices are still unpaid.
- Add a matching `reconcile-billing-finding` action `remove_phantom_enrollment` that hard-deletes the phantom `course_enrollments` row and any of its unpaid invoices, logged to `admin_logs` and reversible for 7 days (same pattern already used by Phase 4).

Nothing runs automatically — the audit surfaces the rows; you click "Reconcile" per finding. Paid invoices are never touched.

### 4. Existing pathway students are not affected
- No change to how the pathway enrollment row is written or read.
- No backfill or bulk update — the only writes happen when you explicitly reconcile a listed finding.
- Videos/access/drip logic is untouched.

---

## Technical details

**Files changed**
- `supabase/functions/create-enhanced-student/index.ts` — branch reorder, remove default-course fallback, scoped batch derivation.
- `supabase/functions/detect-billing-drift/index.ts` — add `phantom_course_enrollment` detector.
- `supabase/functions/reconcile-billing-finding/index.ts` — add `remove_phantom_enrollment` action.
- `src/pages/admin/DataAudit.tsx` — render the new finding type + action button (reuses existing card layout).
- New migration: `enforce_enrollment_target_consistency` trigger on `course_enrollments`.

**Rollout order**
1. Ship edge-function fix + trigger together (stops the bleeding).
2. Run the audit; review flagged rows; reconcile the 4 currently-known phantom rows.
3. Monitor `admin_logs` for `NO_ENROLLMENT_TARGET` errors to catch any form callers that were relying on the fallback.

**Risk**
- Trigger could reject a legitimate insert if any other code path writes `enrollment_source='pathway'` without `pathway_id`. `rg` shows only `create-enhanced-student` and `StudentAccessManagement.tsx` write pathway enrollments and both set `pathway_id`, so the risk is nil.
- Removing the default-course fallback will surface (not create) any form regression as a visible error instead of a silent wrong enrollment — desired behavior.
