

# Fix Session Scheduling Crash + Add Student Notifications & Homepage Visibility

## Problem 1: Page Crash (The Error in Screenshot)

The "Oops! Something went wrong" error is caused by `<SelectItem value="">` on line 598 of `SuccessSessionsManagement.tsx`. Radix UI's Select component does not allow empty string values -- this throws a runtime error that crashes the entire component via the ErrorBoundary.

**Fix:** Change `value=""` to `value="__all__"` for the "All students" option, and update the submit handler to treat `"__all__"` as null (no course filter).

**File:** `src/components/superadmin/SuccessSessionsManagement.tsx`
- Line 98: Change default `course_id` from `''` to `'__all__'`
- Line 231: Change `resetForm` to use `'__all__'` 
- Line 266: Map `'__all__'` back to `''` in `handleOpenDialog`
- Line 307: In `handleSubmit`, treat `course_id === '__all__'` as `null`
- Line 592: Change `onValueChange` to reset `batch_id` when course changes
- Line 598: Change `<SelectItem value="">` to `<SelectItem value="__all__">`

## Problem 2: Students Don't See Scheduled Session on Homepage

The Student Dashboard (`StudentDashboard.tsx`) currently has no widget showing upcoming success sessions. Students can only see them if they navigate to the Live Sessions page.

**Fix:** Add an "Upcoming Live Session" card to the Student Dashboard that queries `success_sessions` for the next upcoming session matching the student's course/batch enrollment.

**File:** `src/components/StudentDashboard.tsx`
- Add state for `upcomingSession`
- In `fetchDashboardData`, query `success_sessions` for upcoming sessions filtered by the student's active course and batch
- Add a prominent card in the dashboard grid showing the next session with title, date/time, mentor name, and a "Join Session" button

## Problem 3: Email Reminder Not Sent When Session Is Scheduled

Currently, when a success session is created in `SuccessSessionsManagement`, only an in-app notification is sent to the assigned mentor. No email or in-app notification goes to batch students.

**Fix:** After successfully creating a session with a `batch_id`, call the existing `send-batch-content-notification` Edge Function (which already has a LIVE_SESSION email template) to notify all enrolled students.

**File:** `src/components/superadmin/SuccessSessionsManagement.tsx`
- After the session is created successfully (line 334), if a `batch_id` is set, invoke the `send-batch-content-notification` function with `item_type: "LIVE_SESSION"`, passing the session title, description, meeting link, and start time
- Add the Supabase functions import for this call
- Show a toast confirming notifications were sent to students

## Technical Details

### Change 1: Fix SelectItem crash
```text
SuccessSessionsManagement.tsx:
- Replace value="" with value="__all__" in SelectItem (line 598)
- Update formData defaults, resetForm, handleOpenDialog, and handleSubmit
  to map "__all__" <-> null for course_id
```

### Change 2: Upcoming session on Student Dashboard
```text
StudentDashboard.tsx:
- Add upcomingSession state
- In fetchDashboardData, query success_sessions where start_time > now,
  filtered by active course enrollment's course_id and batch_id
- Render a card before the existing grid showing the next session
  with date, time, mentor, and Join button
```

### Change 3: Student email notifications on session creation
```text
SuccessSessionsManagement.tsx:
- After creating a session (line 351), if batch_id exists:
  invoke supabase.functions.invoke('send-batch-content-notification', {
    body: {
      batch_id: sessionData.batch_id,
      item_type: 'LIVE_SESSION',
      item_id: newSession.id,
      title: sessionData.title,
      description: sessionData.description,
      meeting_link: sessionData.link,
      start_datetime: sessionData.start_time
    }
  })
- Also create in-app notifications for batch students directly
```

