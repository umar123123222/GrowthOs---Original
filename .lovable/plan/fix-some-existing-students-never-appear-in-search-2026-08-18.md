# Fix: some existing students never appear in search

## What's happening

`azlan19005@gmail.com` exists in the database (role `student`, LMS suspended, has a student record), but the Students Management page can't find him.

Confirmed cause: the page loads students with queries that are not paginated, and Supabase caps every query at **1000 rows**. Actual counts today:

- `user_roles` with role student: **1063**
- `users` with role student: **1044**
- `students` records: **1041**

So roughly 40-60 students are silently cut off from the loaded list. Search filters only the already-loaded rows in memory, so anyone beyond the 1000-row cut simply "doesn't exist" in the UI. The header card showing 1038 total is computed from the same truncated set, which is why the count also looks off.

Side effect of the same cap: the `students` lookup (student ID, installment count) and the invoice/enrollment/batch maps can also truncate, so some students show a blank Student ID or wrong fees structure.

## The fix

1. Add a small paginated fetch helper (repeat `.range(from, from+999)` until a short page comes back) and use it for every unbounded list query on the students page:
   - `user_roles` (role = student)
   - `users` (role = student) and the all-users visibility check
   - `students` (id, user_id, student_id, installment_count)
   - the batch / enrollment / course-enrollment maps used for filters
2. Keep the existing chunked `.in()` user fetch as-is; it is already safe.
3. Recompute the Total / Active / Suspended cards from the complete set so the numbers match reality.
4. Apply the same pagination to the admin students page (`src/components/admin/StudentManagement.tsx`) so it doesn't have the same blind spot.

## Verification

- Search `azlan19005@gmail.com` and confirm the row appears with correct Student ID, batch and LMS status (suspended).
- Confirm Students Directory total matches the database student count (~1044) instead of 1038.
- Spot-check a couple of oldest and newest students to confirm both ends of the list load.

## Notes

- No database or schema changes, no changes to any student's data, access, billing or enrollment. This is purely a read/pagination fix in the frontend.
