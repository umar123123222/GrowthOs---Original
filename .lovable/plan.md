

# Show All Pathway Courses on Videos Page for Batch Students

## Overview
For students enrolled in a batch with a pathway, the Videos page will display **all courses in pathway order** (e.g., Nurturing Sessions -> Ecom 360 -> Google Ads -> ...) on a single page, with drip/unlock dates driven by the **batch timeline settings**.

## Current Behavior
- Videos page shows only **one course at a time** (the current pathway step)
- `useCourseRecordings` fetches recordings for a single `courseId`
- Batch timeline drip override was recently added but only applies to the single active course

## Planned Changes

### 1. Create a new hook: `useBatchPathwayRecordings`
A new hook that fetches recordings across **all courses in pathway order** for batch students:
- Accept `batchId` and `pathwayId` as parameters
- Fetch pathway courses in step order from `pathway_courses`
- For each course, fetch its modules and recordings (ordered by module order, then sequence order)
- Fetch batch timeline items (`batch_timeline_items`) for the batch to get `drip_offset_days` per recording
- Fetch the batch `start_date` to calculate unlock dates
- Fetch `recording_views` and `submissions` for watched/assignment status
- Return data grouped by **course** (with course title, step number) then by **module** within each course
- Calculate unlock status: `unlockDate = batch start_date + drip_offset_days`; if today >= unlockDate, unlocked

### 2. Update `src/pages/Videos.tsx`
- Detect if the student is in a batch (check `course_enrollments` for a `batch_id`)
- If in a batch with a pathway:
  - Use `useBatchPathwayRecordings` instead of `useCourseRecordings`
  - Render all courses in pathway step order, each as a collapsible section
  - Within each course section, show modules and recordings as currently done
  - Show drip dates from batch timeline on locked recordings
  - Show overall pathway progress (total watched / total recordings)
- If NOT in a batch: keep existing behavior unchanged

### 3. UI Structure for Batch Students
```text
+--------------------------------------------+
| Pathway Progress: 5/35 lessons (14%)       |
| [========================                ] |
+--------------------------------------------+
|                                            |
| Step 1: Nurturing Sessions                 |
|   > Chapter 1                              |
|     - Welcome to IDMPakistan  [Watched]    |
|   > Chapter 2                              |
|     - What is Marketing       [Watch Now]  |
|   > Chapter 3                              |
|     - Where to Work?          [Locked]     |
|                                            |
| Step 2: Ecom 360                           |
|   > Chapter 1                              |
|     - Meet Your Mentor     [Locked Day 5]  |
|   > Chapter 2                              |
|     - E-commerce Models    [Locked Day 6]  |
|   ...                                      |
|                                            |
| Step 3: Google Ads                         |
|   (All locked - future drip dates)         |
+--------------------------------------------+
```

### Technical Details

**New file**: `src/hooks/useBatchPathwayRecordings.ts`
- Queries: `pathway_courses` (ordered by step_number), `modules` (per course, ordered), `available_lessons` (per module, ordered by sequence_order), `batch_timeline_items` (for drip offsets), `batches` (for start_date), `recording_views`, `submissions`
- Returns: `{ courseGroups: CourseGroup[], totalProgress: number, loading, error, refreshData }`
- Each `CourseGroup` contains: `courseId, courseTitle, stepNumber, modules: CourseModule[]`

**Modified file**: `src/pages/Videos.tsx`
- Add batch enrollment detection (query `course_enrollments` for `batch_id`)
- Conditional rendering: batch pathway view vs current single-course view
- Course-level collapsible sections with step numbers
- Reuse existing recording row UI (lock reasons, watch buttons, assignment badges)

