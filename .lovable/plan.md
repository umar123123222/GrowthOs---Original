## Why Afnan is flagged

Verified in the database:

- Afnan (STU000999) has **one invoice**: Rs 5,000, `status = paid`, `course_id = c71696eb…`.
- His matching enrollment (`dc0f6262…`, same course, `total_amount = 5000`) has **`status = 'completed'`**, not `'active'`.

The scanner pulls only `status = 'active'` enrollments. So for Afnan:
- expected = 0 (no active enrollment counted)
- his paid invoice matches no active enrollment key → counted as an **orphan invoice** of 5,000
- difference = +5,000 → flagged "open"

Same shape across the current open findings: 24 of 30 have `expected_total = 0`, 23 carry an orphan total, and 24 have zero unpaid amount. Raja abdullah (+55,000 orphan, expected 0) is the same case. So the remaining backlog is mostly completed/cancelled enrollments whose fully-paid invoices look orphaned.

## The fix

Change `supabase/functions/detect-billing-drift/index.ts`:

1. **Load all enrollments, not just active.**
   Fetch `status in ('active','completed')` (paged as now).
   - `active` + `completed` both count toward *expected* and both make their invoices legitimately "owned" (not orphans).
   - `cancelled` / other statuses: not counted in expected, but their keys still register as "known" so paid invoices from a cancelled enrollment aren't reported as orphans — they get a separate, softer signal only when **unpaid** amounts remain.

2. **Never treat a paid invoice as drift.**
   Orphan detection only accumulates invoices with `status != 'paid'`. A paid invoice is money actually collected — it can never be "extra billing" to clean up. This alone removes Afnan, Raja, and the other 22 zero-unpaid findings.

3. **Keep the fully-cleared skip, and make it work with zero expected.**
   Current skip requires `expected > 0`. Change to: skip when `unpaid <= tolerance` **and** `paid + tolerance >= expected` (allowing `expected = 0`), unless phantom enrollments exist.

4. **Report status in the finding details** — add `enrollment_statuses` and per-enrollment `status` to `details.per_enrollment`, so a genuine future finding shows whether it came from a completed or active enrollment.

## Verification (after the change)

- Redeploy, run the scan, and confirm Afnan (`11e9962d…`) and Raja move to `auto_cleared`.
- Report the new open-finding count and manually re-check that each remaining open finding has a real unpaid amount, a duplicate, or a phantom enrollment.

## Notes

- Read-only detection logic only — no invoice, enrollment, or student data is written or deleted by this change.
- No UI change needed; the Data Audit page already shows only open findings and refreshes on rescan.
