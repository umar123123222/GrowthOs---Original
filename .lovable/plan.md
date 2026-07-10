## Why the cards show 0

Both metrics live in `src/components/admin/PerformanceMetrics.tsx` and both silently return 0 because of a **status string casing mismatch** against the database.

### Live Session Attendance → 0.0%
- The query filters active students with `.eq('status', 'Active')` (capital A).
- In the DB, `users.status` values are lowercase: `active`, `suspended`.
- Result: `activeStudents = 0` → `expected = sessions × 0 = 0` → the function early‑returns `0`.
- Confirmed: there are 363 `session_attendance` rows and 27 completed/live sessions in the last 30 days, so the data exists — only the divisor is broken.

### Dropout Rate → 0.0%
- Uses `.or('lms_status.in.(suspended,refunded,inactive),status.eq.suspended')`. Those values are already lowercase and match the DB, so the filter itself is fine.
- However, the denominator (`uniqueUsers` — students with an overdue installment mapped through `students.user_id`) is coming back empty in this project, so the function early‑returns `0`. This needs a second look at the mapping (installment_payments → students → users) once the attendance fix is in.

## Fix

1. In `fetchAttendanceRate`, change the active‑student query from `.eq('status', 'Active')` to a case‑insensitive match: `.ilike('status', 'active')` (or `.eq('status', 'active')`).
2. In `fetchDropoutRate`, apply the same case‑insensitive treatment on `status` and additionally check whether `installment_payments.student_id` in this project points to `users.id` directly (skip the `students` lookup and fall back to it only if needed). Also treat effective due date comparison in UTC ISO consistently.
3. No UI/visual changes — the cards stay as they are; only the numbers will populate.

## Verification
- After the change, reload `/superadmin?tab=analytics` (Overview tab) and confirm:
  - Live Session Attendance shows a non‑zero % with a real "prev 30d" comparison.
  - Dropout Rate reflects currently suspended/refunded students among those with overdue installments.
- Spot‑check with a SQL count of `session_attendance` in the last 30 days vs. `sessions × active students`.
