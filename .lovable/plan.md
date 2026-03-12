

# Comprehensive Activity Logging Overhaul

## Problem

The logging system is split across two disconnected tables with major gaps:

1. **`user_activity_logs`** — stores student self-actions (login, video watched, assignment submitted) but the per-student ActivityLogsDialog queries `admin_logs` instead, so these are invisible
2. **`admin_logs`** — stores admin/system actions but has no concept of "target student," only `performed_by`
3. **`logUserActivity()` blocks cross-user logging** — line 21-24 checks `user_id === auth.uid()` and silently skips when an admin logs an action on a student
4. **Many actions have zero logging**: profile updates, password changes, LMS status changes (active/inactive/dropout/complete), content CRUD (modules/recordings/assignments), mentor assignment to students, batch enrollment, drip content toggles, invoice payments (mark-invoice-paid), recording unlocks, certificate downloads, leaderboard views

## Architecture Decision

Unify on `admin_logs` as the single source of truth for all activity displayed in the admin UI. Add a `target_user_id` column so actions done TO a student are queryable by that student's ID.

```text
admin_logs (unified)
├── performed_by  → WHO did it (admin, student, system/null)
├── target_user_id → WHO it was done TO (the student)
├── entity_type   → what kind of thing (user, invoice, recording, assignment...)
├── entity_id     → ID of that thing
├── action        → what happened
├── description   → human-readable summary
└── data          → JSON metadata
```

## Changes

### 1. Database migration
Add `target_user_id` column to `admin_logs` table (nullable UUID). This lets us query all logs for a specific student regardless of who performed the action.

### 2. Rewrite `activity-logger.ts`
- Remove the `user_id === auth.uid()` check that blocks cross-user logging
- Add a new `logToAdminLogs()` function that inserts into `admin_logs` with `performed_by` (current user or null for system), `target_user_id` (the student being acted on), `entity_type`, `action`, `description`, and `data`
- Keep `logUserActivity()` for backward compat but also mirror to `admin_logs`
- Add a `logAdminAction()` helper for admin/mentor/system actions on students

### 3. Update ActivityLogsDialog (per-student view)
- Query `admin_logs` using `target_user_id = studentId` OR `performed_by = studentId` — this captures both actions BY the student and actions ON the student
- Show a "Performed By" column distinguishing student self-actions vs admin/system actions

### 4. Update GlobalActivityLogs
- Already queries `admin_logs` — just needs to show the new `target_user_id` as a "Target Student" column

### 5. Add logging calls to all missing actions

| Location | Action to Log |
|----------|--------------|
| `Profile.tsx` | profile_updated, password_changed |
| `StudentManagement.tsx` | lms_status_changed (all statuses), drip_content_toggled |
| `StudentsManagement.tsx` | same as above |
| `SubmissionsManagement.tsx` | already logs — add `target_user_id` |
| `RecordingsManagement.tsx` | recording_created, recording_updated, recording_deleted |
| `ModulesManagement.tsx` | module_created, module_updated, module_deleted |
| `CourseManagement.tsx` | course_created, course_updated |
| `PathwayManagement.tsx` | pathway_created, pathway_updated |
| `MentorManagement.tsx` | mentor_assigned, mentor_removed |
| `BatchManagement.tsx` | batch_created, student_enrolled_in_batch |
| `CompanySettings.tsx` | settings_updated |
| `Leaderboard.tsx` | leaderboard_viewed |
| `Certificates.tsx` | certificate_downloaded |
| `VideoPlayer.tsx` | already logs — add mirror to admin_logs |
| `Login.tsx` | already logs — add mirror to admin_logs |
| `Layout.tsx` (logout) | already logs — add mirror to admin_logs |
| Edge: `mark-invoice-paid` | invoice_paid (already in admin_logs — add target_user_id) |
| Edge: `installment-reminder-scheduler` | already logs — add target_user_id |
| Edge: `create-enhanced-student` | already logs — add target_user_id |

### 6. Update types
Add `target_user_id` to admin_logs types in `src/integrations/supabase/types.ts`.

## Files to modify

| File | Change |
|------|--------|
| Migration SQL | Add `target_user_id` column |
| `src/lib/activity-logger.ts` | Rewrite: remove user_id check, add `logAdminAction()`, mirror to admin_logs |
| `src/integrations/supabase/types.ts` | Add `target_user_id` to admin_logs type |
| `src/components/ActivityLogsDialog.tsx` | Query by `target_user_id` OR `performed_by`, show who performed action |
| `src/components/superadmin/GlobalActivityLogs.tsx` | Show target student column |
| `src/components/admin/ActivityLogs.tsx` | Show target student column |
| `src/pages/Profile.tsx` | Add logging for profile update and password change |
| `src/pages/Login.tsx` | Mirror login to admin_logs with target_user_id |
| `src/components/Layout.tsx` | Mirror logout + page visits to admin_logs |
| `src/pages/VideoPlayer.tsx` | Mirror video watched to admin_logs |
| `src/components/assignments/SubmissionsManagement.tsx` | Add target_user_id to approval/decline logs |
| `src/components/admin/StudentManagement.tsx` | Log all LMS status changes to admin_logs |
| `src/components/superadmin/StudentsManagement.tsx` | Same |
| `src/components/superadmin/RecordingsManagement.tsx` | Log CRUD |
| `src/components/superadmin/ModulesManagement.tsx` | Log CRUD |
| `src/components/superadmin/CourseManagement.tsx` | Log CRUD |
| `src/components/superadmin/PathwayManagement.tsx` | Log CRUD |
| `src/components/superadmin/CompanySettings.tsx` | Log settings updates |
| `src/components/batch/BatchManagement.tsx` | Log batch operations |
| `src/pages/Leaderboard.tsx` | Log view |
| Edge functions | Add target_user_id to existing admin_logs inserts |

