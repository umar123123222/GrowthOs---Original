

# Add "Create Live Session" from Content Timeline

## Overview
Add an inline "Add Session" button in the Content Timeline's Live Sessions section for each course. Users enter just a title and drip days. The system auto-assigns the course's primary mentor and uses placeholder defaults for required database fields (link, start_time).

## What Changes

### `src/components/superadmin/ContentTimelineDialog.tsx`

1. **Add "+" button** below the Live Sessions list (or as first item if no sessions exist yet) for each course section
2. **Inline creation row**: When clicked, show an inline row with:
   - A text input for the session title
   - A number input for drip days
   - A confirm (checkmark) and cancel (X) button
3. **Auto-resolve mentor**: Query `mentor_course_assignments` for the course to find the primary mentor (`is_primary = true`), falling back to the first assigned mentor. Set `mentor_id` and `mentor_name` on the created session.
4. **Insert with defaults**: Create the session in `success_sessions` with:
   - `title` from user input
   - `drip_days` from user input (cast via `as any` since column not yet in generated types)
   - `course_id` from the current course context
   - `mentor_id` / `mentor_name` auto-resolved
   - `link` = `"TBD"` (placeholder -- can be updated later in Session Management)
   - `start_time` = current timestamp (placeholder)
   - `status` = `"upcoming"`
5. **Refresh list** after successful insert to show the new session inline

### UI Layout

```text
LIVE SESSIONS
  [Video icon] Session Title     2026-02-15   [5] days
  [Video icon] Session Title     2026-02-20   [10] days
  [+ Add Live Session]

-- When adding: --
  [text: Session title...] [drip: 0] days  [checkmark] [X]
```

### No Database Changes Needed
The `drip_days` column migration was already planned in the previous step. The `success_sessions` table already has all other required fields with acceptable defaults.

## Technical Notes
- New state: `addingSessionForCourse` (string | null) to track which course is in "add mode"
- New state: `newSessionTitle` (string) and `newSessionDripDays` (number | null)
- Mentor lookup is done once when the "+" is clicked, cached in a local ref/state
- Input validation: title must be non-empty, trimmed, max 200 chars
- The session will appear in Session Management for full editing (link, time, description, etc.)
