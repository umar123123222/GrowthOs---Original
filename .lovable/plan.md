

# Add Live Sessions to Content Timeline Dialog

## Overview

Add a `drip_days` column to the `success_sessions` table and display live sessions inside the Content Timeline dialog alongside recordings. Each course section will show its recordings grouped by module, followed by a "Live Sessions" subsection with editable drip days for each session.

## What Changes

### 1. Database Migration -- Add `drip_days` to `success_sessions`
- Add a nullable `drip_days integer` column (default `NULL`) to the `success_sessions` table
- This allows sessions to be scheduled relative to a batch's start date, just like recordings

### 2. Update `ContentTimelineDialog.tsx`
- Add a `SessionItem` interface (id, title, schedule_date, drip_days, course_id, course_title, step_number)
- Fetch `success_sessions` filtered by `course_id` for course mode, or by all course IDs in the pathway for pathway mode
- Display sessions in a separate "LIVE SESSIONS" subsection under each course's recordings, with the same inline editable drip_days input
- Track session drip_days edits in a separate `editedSessionDripDays` state
- Save session drip_days updates to `success_sessions` table alongside recording saves

### 3. Visual Layout (per course section)
```text
CHAPTER 1 (module)
  1  Recording Title        13m   [0] days
  2  Recording Title        24m   [1] days

LIVE SESSIONS
  Session Title     2026-02-15   [5] days
  Session Title     2026-02-20   [10] days
```

- Sessions are visually distinguished with a "Video" icon and a different subsection header
- The scheduled date is shown for reference but drip_days controls when the session becomes visible/accessible

## Technical Details

### Migration
```sql
ALTER TABLE success_sessions ADD COLUMN drip_days integer DEFAULT NULL;
```

### Files Modified
- **`src/components/superadmin/ContentTimelineDialog.tsx`** -- Add session fetching, display, and save logic
  - New state: `sessions`, `editedSessionDripDays`
  - New fetch: query `success_sessions` by `course_id`
  - Grouped display: sessions appended after modules within each course group
  - Save handler: update both `available_lessons` and `success_sessions` drip_days

### No Other Files Affected
- The `SuccessSessionsManagement.tsx` and student-facing pages don't need changes for this feature -- they can continue using `schedule_date` for display. The `drip_days` on sessions will be used by the sequential unlock system in a future step if needed.

