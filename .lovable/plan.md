


# Add Content Timeline Manager to Courses and Pathways

## Status: ✅ COMPLETED

## Overview

Added a "Timeline" (clock icon) button to each course row in Course Management and each pathway row in Pathway Management. Clicking it opens a dialog that shows all recordings in that course/pathway, organized by module, with inline-editable `drip_days` fields.

## What Was Built

- **`src/components/superadmin/ContentTimelineDialog.tsx`** — Reusable dialog accepting `type` ("course" | "pathway"), fetches recordings grouped by module (and by course for pathways), with inline drip_days editing and batch save.
- **`src/components/superadmin/CourseManagement.tsx`** — Added clock icon button in Actions column, renders ContentTimelineDialog.
- **`src/components/superadmin/PathwayManagement.tsx`** — Added clock icon button in Actions column, renders ContentTimelineDialog.
