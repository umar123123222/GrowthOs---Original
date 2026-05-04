# Diagnose: Why does asadali4692@gmail.com see all recordings unlocked?

I can't query the database from plan mode (read-only), so I need to run diagnostics in build mode. Below are the most likely root causes based on a code review of the unlock pipeline, plus the exact checks I'll run to identify which one applies to this user.

## Most likely causes (ranked)

Based on `useCourseRecordings.ts`, `usePathwayGroupedRecordings.ts`, the `get_course_sequential_unlock_status` RPC, and the access-override system documented in `features/access-settings-overrides`:

1. **Per-student drip override is OFF**
   The "Manage Access" dialog (`src/components/admin/ManageAccessDialog.tsx`) lets admins toggle `drip_enabled` / `sequential_unlock_enabled` on the student's `course_enrollments` row. Student-level overrides take highest priority over course/pathway/company defaults. If either was unchecked for this user, all content unlocks immediately.

2. **Course/pathway has drip disabled at source**
   The course or pathway this student is enrolled in may itself have `drip_enabled = false` or no `drip_days` set on its lessons (everything defaults to day 0).

3. **`recording_views` already marked watched for everything**
   Per the `drip-lock-prevention-on-batch-assignment` rule, any recording marked watched stays permanently unlocked. If this account was used to "watch" everything before drip was applied, those rows now bypass drip forever.

4. **No batch assigned + old `created_at`**
   When a student has no batch, the system uses their LMS access date (account creation) as the drip anchor. If this account is old, every drip offset has elapsed and everything is unlocked legitimately.

5. **Frontend `fees_not_cleared` override unlocking everything sequentially**
   The frontend in `useCourseRecordings.ts` (lines 195-222) overrides `fees_not_cleared` locks for any student with `lms_status = 'active'`. Combined with auto-marking videos as watched, this can cascade-unlock the whole course.

6. **Role isn't actually `student`**
   If `user_roles` has admin/mentor/superadmin for this account, RLS-based course filtering and unlock RPC behave differently.

## Diagnostics to run (build mode)

I'll execute a single SQL diagnostic that pulls everything needed to pinpoint the cause:

```sql
-- 1. User identity, status, batch, role
SELECT u.id, u.email, u.full_name, u.role, u.lms_status,
       u.batch_id, u.created_at, u.lms_user_id,
       b.name AS batch_name, b.start_date AS batch_start
FROM users u
LEFT JOIN batches b ON b.id = u.batch_id
WHERE u.email = 'asadali4692@gmail.com';

SELECT role FROM user_roles WHERE user_id = (SELECT id FROM users WHERE email='asadali4692@gmail.com');

-- 2. All enrollments with override flags
SELECT ce.course_id, c.title AS course_title, ce.pathway_id, p.title AS pathway_title,
       ce.status, ce.enrolled_at, ce.access_expires_at,
       ce.drip_enabled, ce.sequential_unlock_enabled
FROM course_enrollments ce
LEFT JOIN courses c ON c.id = ce.course_id
LEFT JOIN pathways p ON p.id = ce.pathway_id
WHERE ce.user_id = (SELECT id FROM users WHERE email='asadali4692@gmail.com');

-- 3. Course/pathway-level drip settings
SELECT id, title, drip_enabled, sequential_unlock_enabled FROM courses
WHERE id IN (SELECT course_id FROM course_enrollments
             WHERE user_id=(SELECT id FROM users WHERE email='asadali4692@gmail.com'));

-- 4. Lesson drip_days for the enrolled course(s)
SELECT al.id, al.recording_title, al.sequence_order, al.drip_days, m.title AS module
FROM available_lessons al JOIN modules m ON m.id = al.module
WHERE m.course_id IN (SELECT course_id FROM course_enrollments
                      WHERE user_id=(SELECT id FROM users WHERE email='asadali4692@gmail.com'))
ORDER BY m.order, al.sequence_order;

-- 5. Recording views (anything marked watched bypasses drip forever)
SELECT COUNT(*) FILTER (WHERE watched) AS watched_count, COUNT(*) AS total_views
FROM recording_views WHERE user_id=(SELECT id FROM users WHERE email='asadali4692@gmail.com');

-- 6. Run the actual RPC the frontend uses
SELECT * FROM get_course_sequential_unlock_status(
  (SELECT id FROM users WHERE email='asadali4692@gmail.com'),
  (SELECT course_id FROM course_enrollments
   WHERE user_id=(SELECT id FROM users WHERE email='asadali4692@gmail.com') LIMIT 1)
);

-- 7. Company-wide defaults
SELECT drip_enabled, sequential_unlock_enabled FROM company_settings LIMIT 1;
```

The combination of these results pinpoints which layer (student override / course setting / lesson drip_days / batch anchor / watched flag) is letting this user through.

## After diagnosis

Once we know the cause, the fix is one of:

- **If student override is off**: re-enable drip for this enrollment in the Manage Access dialog (no code change).
- **If lessons have no `drip_days`**: bulk-set drip in the Content Timeline dialog (no code change).
- **If `recording_views` was pre-watched incorrectly**: clear the spurious `watched=true` rows for this user.
- **If anchor date is too old (no batch)**: assign a batch with a recent `start_date`, OR change drip anchor logic.
- **If RPC is misbehaving**: patch `get_course_sequential_unlock_status` and/or the frontend override.

I won't change any code or data until we see the diagnostics and you confirm which fix to apply.

## Approve to proceed

Approving this plan switches me to build mode so I can run the SQL above and report back with the exact root cause for this account.
