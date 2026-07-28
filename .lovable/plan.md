# Safe Rollout Plan — Improvements Without Breaking Existing Students

Guiding principle for every phase: **additive first, backfill from current truth, no destructive change without a dry-run report and a reversible migration.** Nothing in this plan modifies existing invoices, enrollments, sequence orders, or student access unless a preview clearly shows the change is a no-op or a strict correction.

---

## Global Safety Rules (apply to every phase)

1. **Additive schema only.** New columns are nullable with defaults; no `DROP`, no `NOT NULL` on existing rows until backfill is verified.
2. **Backfill = snapshot of current reality.** Every new field is seeded from the value the app is *already* computing today, so day-1 behavior is identical.
3. **Feature-flagged reads.** New logic is gated behind a flag in `feature_flags` / `env-config`. Old code path stays as the default until we flip per-role.
4. **Dry-run reports before any data mutation.** Cleanup/reconciliation jobs first write to an `audit_findings` table; a human approves before any `UPDATE`/`DELETE`.
5. **Scoped to new records first.** New rules (duplicate-enrollment guard, snapshot pricing, etc.) apply to *new* writes. Existing rows are grandfathered.
6. **Reversible migrations.** Each migration ships with a documented rollback in `docs/supabase-migration-guide.md`.
7. **No touching Batch 301 / existing enrollments in Phase 1–3.** Data corrections are Phase 4 only, after audit tooling exists.

---

## Phase 1 — Observability (read-only, zero risk)

Ship first so we can *see* the impact of later phases.

- New page `src/pages/admin/DataAudit.tsx` (superadmin only) with tabs:
  - Invoice changes (last 30d) — pulled from `admin_logs` + a new read-only view.
  - Enrollment changes — course/pathway add/remove events.
  - Content order changes — module/recording `sequence_order` diffs.
- New edge function `detect-billing-drift` (cron, read-only): compares each student's invoice sum vs. their active enrollments and writes rows into a new `billing_drift_findings` table. **No writes to invoices.**
- Admin notification when drift is detected (uses existing notifications table).

Guarantee: pure reads. Cannot break anything.

---

## Phase 2 — Enrollment Snapshots (additive, grandfathered)

Problem being solved: global price changes retroactively altering old students' totals.

- Migration adds nullable columns to the enrollment tables:
  - `enrolled_price numeric`, `enrolled_currency text`, `snapshot_at timestamptz`.
- **Backfill** = copy today's computed price for each existing enrollment into `enrolled_price`. Because we snapshot the *current* value, no student's total changes.
- New enrollments (via `create-enhanced-student`, admin Manage Access, etc.) write the snapshot at creation time.
- Reads: invoice/total calculators prefer `enrolled_price` when present, else fall back to the current live price lookup (identical to today).
- Flag: `USE_ENROLLMENT_SNAPSHOTS` — default ON only for enrollments created after the migration timestamp; existing rows unaffected either way because their snapshot equals today's live price.

Guarantee: no student sees a different number on day 1.

---

## Phase 3 — Duplicate-Enrollment Guard (new writes only)

- Add a **partial unique index** on active enrollments `(student_id, course_id)` and `(student_id, pathway_id)` where `status = 'active'`.
- Before creating the index, run a dry-run query and surface any existing duplicates in the Data Audit page. **Do not** auto-clean; admin resolves them manually via existing per-enrollment delete UI.
- Admin UI (`StudentAccessManagement.tsx`) shows a clear "already enrolled" state instead of allowing a second enrollment.

Guarantee: existing duplicates are visible but preserved; only new duplicates are blocked.

---

## Phase 4 — Data Reconciliation Tooling (opt-in fixes)

- The `detect-billing-drift` findings page gets per-row actions: "Recompute invoices from snapshot" / "Mark as intentional".
- Each action is scoped to *one* student, requires confirmation, logs to `admin_logs`, and is reversible from the same UI within 7 days (soft-delete pattern already in use).
- No bulk auto-fix. No cron mutation.

Guarantee: no mass update ever runs without an admin click per student.

---

## Phase 5 — Success Session Preview + Session Safety

- Add a "Preview visibility" panel to the schedule dialog: shows the exact list of students who will see this session, using the same RLS function students use. Purely a read; no schema change.
- Retain existing duplicate-detection (link + course + batch overlap).
- No change to visibility rules — just makes them observable.

---

## Phase 6 — Content Ordering: Single Source of Truth

- Extract the ordering used by `/recordings` and `/course/modules` into one hook `useOrderedCourseContent` and switch the student `Videos.tsx` page to use it.
- Ship behind flag `STUDENT_USES_UNIFIED_ORDERING`. Rollout: enable for one test student first via a per-user override, then broaden.
- Includes an automated diff test: for each course, compare admin order vs. student order; CI fails if they diverge.

Guarantee: same query = same order, forever. Rollout is per-user so any regression is contained.

---

## Phase 7 — Content Order Change Alerts

- Trigger on `available_lessons` / `modules` writes: if `sequence_order` changes on a course that has active enrollments, log to `admin_logs` and notify superadmin. No blocking, just visibility.

---

## What is explicitly NOT in this plan (to avoid regressions)

- No changes to Batch 301, Master Pathway 2, or any historical invoice.
- No changes to existing `sequence_order` values.
- No changes to `has_role`, RLS recursion prevention, or the auth flow.
- No removal of the current billing UI cards until Phase 4 audit tools are live for 2 weeks.
- No changes to email sending toggles (`LIVE_SESSION_EMAILS_ENABLED` stays off as you set it).

---

## Rollout Order & Verification Checkpoints

```text
Phase 1  →  ship, watch drift dashboard for 3–7 days
Phase 2  →  ship snapshot migration, verify totals unchanged for 20 sample students
Phase 3  →  publish duplicates report, admins clean up, then enable index
Phase 4  →  enable per-row reconciliation actions (manual only)
Phase 5  →  ship visibility preview
Phase 6  →  unified ordering behind flag, per-user rollout
Phase 7  →  order-change alerts
```

At each checkpoint I'll pause and show you: migration SQL, a sample of before/after data, and the rollback command — you approve before it goes live.

---

## Technical Details (for reference)

- Feature flags land in `src/lib/feature-flags.ts` + `feature_flags` table (already present).
- New tables: `billing_drift_findings`, `audit_findings` — both with `GRANT` to `authenticated`/`service_role` and superadmin-only RLS via `public.get_my_role()`.
- Cron jobs registered in `supabase/config.toml` with `verify_jwt=false` and internal role checks.
- New edge functions follow existing PDF-reliability pattern (catch `Deno.lstatSync`).
- Rollback docs appended per migration; each phase has a single revert migration prepared before ship.

Approve and I'll start with Phase 1 (pure observability, cannot break anything).
