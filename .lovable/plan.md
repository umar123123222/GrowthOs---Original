

# Add Content Timeline Manager to Courses and Pathways

## Overview

Add a "Timeline" (clock icon) button to each course row in Course Management and each pathway row in Pathway Management. Clicking it opens a dialog that shows all recordings in that course/pathway, organized by module, with inline-editable `drip_days` fields. This replaces the old batch-level timeline with per-course and per-pathway drip configuration.

## What the Admin Will See

**On Course Management table:**
- New clock icon button in the Actions column for each course
- Clicking it opens a "Content Timeline - [Course Name]" dialog

**On Pathway Management table:**
- New clock icon button in the Actions column for each pathway
- Clicking it opens a "Content Timeline - [Pathway Name]" dialog showing recordings across all courses in the pathway, grouped by Course > Module

**Timeline Dialog contents:**
- Recordings listed in sequence order, grouped under their module headers
- Each recording row shows: sequence number, title, duration, and an editable "Drip Days" input
- A "Save All" button to batch-update all changed drip_days values
- For pathways: an additional course-level grouping header (Step 1: Course A, Step 2: Course B, etc.)

## Technical Details

### New Component: `src/components/superadmin/ContentTimelineDialog.tsx`
- Accepts `type` ("course" | "pathway"), `entityId`, `entityName`, `open`, `onOpenChange` props
- For type="course": fetches modules and recordings for that course
- For type="pathway": fetches pathway_courses, then all modules/recordings across those courses
- Displays recordings grouped by (course >) module with inline `drip_days` number inputs
- Tracks local edits and saves changed values via batch update to `available_lessons.drip_days`

### Modified: `src/components/superadmin/CourseManagement.tsx`
- Add state for `timelineCourse` (the course whose timeline is open)
- Add clock icon button in Actions column (next to edit/delete)
- Render `ContentTimelineDialog` with type="course"

### Modified: `src/components/superadmin/PathwayManagement.tsx`
- Add state for `timelinePathway` (the pathway whose timeline is open)
- Add clock icon button in Actions column (next to manage courses/edit/delete)
- Render `ContentTimelineDialog` with type="pathway"

### Data Flow
- Reads: `available_lessons` (with module join), `modules` (with course_id), `pathway_courses` (for pathway mode)
- Writes: `available_lessons.drip_days` (batch update on save)
- No schema changes needed -- `drip_days` already exists on `available_lessons`

