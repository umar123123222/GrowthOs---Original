

## Improvements Plan: Auto schedule_date, Logger Cleanup, and Type Safety

### 1. Auto-calculate schedule_date for new sessions (ContentTimelineDialog)

When a session is created via the Content Timeline dialog with a `drip_days` value, the system currently does not set `schedule_date`. This means newly created sessions are invisible in the "This Week's Live Sessions" view.

**Fix**: In the `handleConfirmAddSession` function, after creating a session with `drip_days`, calculate the `schedule_date` for each batch associated with the course. Since a session can belong to multiple batches, the schedule_date will be set based on the earliest associated batch's start_date + drip_days. If no batch is found, `schedule_date` remains null.

Similarly, when saving edited `drip_days` via `handleSave`, the `schedule_date` should be recalculated for affected sessions.

**Technical details**:
- In `handleConfirmAddSession`: query `batch_courses` (or `batch_pathways`) to find batches for the course, pick the earliest `start_date`, and compute `schedule_date = start_date + drip_days` days.
- In `handleSave`: for each session with edited `drip_days`, recalculate `schedule_date` using the same logic.
- File: `src/components/superadmin/ContentTimelineDialog.tsx`

---

### 2. Replace console.error with logger in ContentScheduleCalendar

Two `console.error` calls in the calendar component will be replaced with the project's `logger.error` utility for consistency.

**Technical details**:
- Import `logger` from `@/lib/logger`
- Replace `console.error(...)` at lines ~335 and ~374
- File: `src/components/admin/ContentScheduleCalendar.tsx`

---

### 3. Add drip_days to Supabase TypeScript types for success_sessions

The `drip_days` column exists in the database but is missing from the generated types, forcing `as any` casts throughout the codebase.

**Technical details**:
- Add `drip_days: number | null` to `Row`, `Insert` (optional), and `Update` (optional) for `success_sessions` in `src/integrations/supabase/types.ts`
- Remove `as any` casts in `ContentTimelineDialog.tsx` and `ContentScheduleCalendar.tsx` where `drip_days` is referenced
- Files: `src/integrations/supabase/types.ts`, `src/components/superadmin/ContentTimelineDialog.tsx`, `src/components/admin/ContentScheduleCalendar.tsx`

