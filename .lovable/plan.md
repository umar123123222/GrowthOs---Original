

## Comprehensive Student Activity Logging

### Problem
The activity logs dialog for each student shows "No activity logs found" because most student activities are not being logged to the `user_activity_logs` table. Currently, only **page visits** are logged (from Layout.tsx). All other events -- login, logout, video watched, assignment submitted/approved/declined, recording unlocked, support tickets, success sessions -- are missing.

### Solution
Add `logUserActivity` calls at each key action point across the codebase, with rich metadata (course name, module name, reviewer name, etc.). Also enhance the activity logs dialog to display new activity types with proper formatting.

### Changes Required

#### 1. Add Login Activity Logging (`src/pages/Login.tsx`)
- After successful `signInWithPassword`, call `logUserActivity` with `activity_type: 'login'` and metadata including the user's email.

#### 2. Add Logout Activity Logging (`src/components/Layout.tsx`)
- Before `supabase.auth.signOut()`, call `logUserActivity` with `activity_type: 'logout'`.

#### 3. Add Video Watched Logging (`src/pages/VideoPlayer.tsx`)
- When a student watches/completes a video, log with metadata including video title, module name, and course name (fetched from `available_lessons` joined with `modules` and `courses`).

#### 4. Add Assignment Submitted Logging (`src/components/assignments/EnhancedStudentSubmissionDialog.tsx`)
- After successful submission insert, log `activity_type: 'assignment_submitted'` with metadata including assignment name and version number.

#### 5. Add Assignment Approved/Declined Logging (`src/components/assignments/SubmissionsManagement.tsx`)
- In `handleReviewSubmission`, after updating the submission status, log activity to the **student's** `user_activity_logs`:
  - `activity_type: 'assignment_approved'` or `'assignment_declined'`
  - Metadata includes: assignment name, reviewer name (the admin/mentor who reviewed), review notes
  - The `user_id` in the log should be the **student** (not the reviewer), so it appears in the student's activity feed.

#### 6. Add Recording Unlocked Logging
- In the sequential unlock flow (where `user_unlocks` is inserted), log `activity_type: 'recording_unlocked'` with the recording title and module/course info.
- Key locations: `SubmissionsManagement.tsx` (on approval), `SequentialUnlockAdmin.tsx` (manual unlock), and the content drip processor.

#### 7. Add Support Ticket Created/Replied Logging (`src/pages/Support.tsx`)
- After creating a ticket, log `activity_type: 'support_ticket_created'` with ticket title and type.
- After sending a message/reply, log `activity_type: 'support_ticket_replied'` with ticket ID.

#### 8. Add Success Session Logging
- When a success session is scheduled or attended, log the appropriate activity type with session details.

#### 9. Add New Activity Types to `src/lib/activity-logger.ts`
- Add constants: `ASSIGNMENT_APPROVED`, `ASSIGNMENT_DECLINED`, `RECORDING_UNLOCKED`, `SUCCESS_SESSION_SCHEDULED`, `SUCCESS_SESSION_ATTENDED`, `SUPPORT_TICKET_REPLIED`

#### 10. Update Activity Logs Dialog (`src/components/superadmin/StudentsManagement.tsx`)
- Add badge colors for new activity types: `assignment_approved`, `assignment_declined`, `recording_unlocked`, `success_session_scheduled`, `success_session_attended`, `support_ticket_created`, `support_ticket_replied`
- Add human-readable detail formatters for each new type in the switch statement (lines ~2351-2383)
- Add new filter options in the activity filter dropdown

### Technical Details

**Logging pattern** (consistent across all additions):
```typescript
import { logUserActivity, ACTIVITY_TYPES } from '@/lib/activity-logger';

// Example: assignment approval logging (logged under the student's ID)
await logUserActivity({
  user_id: studentId,
  activity_type: 'assignment_approved',
  reference_id: assignmentId,
  metadata: {
    assignment_name: assignmentName,
    reviewed_by: reviewerName,
    notes: reviewNotes,
    version: submissionVersion
  }
});
```

**Files to modify:**
1. `src/lib/activity-logger.ts` -- add new ACTIVITY_TYPES constants
2. `src/pages/Login.tsx` -- log login
3. `src/components/Layout.tsx` -- log logout
4. `src/pages/VideoPlayer.tsx` -- log video watched with course/module context
5. `src/components/assignments/EnhancedStudentSubmissionDialog.tsx` -- log assignment submission
6. `src/components/assignments/SubmissionsManagement.tsx` -- log approval/decline
7. `src/pages/Support.tsx` -- log ticket creation and replies
8. `src/components/superadmin/StudentsManagement.tsx` -- update dialog with new activity types, badges, formatters, and filter options
9. `src/hooks/useProgressTracker.ts` -- already logs module_completed, verify metadata includes module/course names

