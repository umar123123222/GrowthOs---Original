

# Remove Batch Timeline, Use Pathway/Course Drip Settings Instead

## What's Changing

Batches will become **grouping-only** -- they group students together and provide a shared `start_date` for drip calculations. All content scheduling (which recordings unlock when, live sessions, etc.) will come from the **pathway and course settings** (specifically the `drip_days` field on each recording and the `get_course_sequential_unlock_status` RPC).

The entire `batch_timeline_items` system and its admin UI will be removed.

## Summary of Changes

### 1. Remove Batch Timeline Components and Hooks
Delete these files entirely:
- `src/components/batch/BatchTimelineView.tsx` -- student-facing timeline cards
- `src/components/batch/BatchTimelineManager.tsx` -- admin timeline manager
- `src/components/batch/timeline/ImportCourseDialog.tsx` -- course import into timeline
- `src/components/batch/timeline/TimelineGroupItem.tsx` -- timeline drag items
- `src/components/batch/timeline/TimelineGroupedList.tsx` -- grouped timeline list
- `src/hooks/useBatchTimelineStatus.ts` -- RPC-based timeline status hook
- `src/hooks/useBatchTimeline.ts` -- admin timeline CRUD hook
- `src/hooks/useBatchPathwayRecordings.ts` -- batch-specific pathway hook (replaced by pathway hook)
- `src/pages/BatchTimelinePage.tsx` -- standalone timeline page

### 2. Update `src/components/batch/index.ts`
Remove exports for `BatchTimelineManager` and `BatchTimelineView`.

### 3. Update Student Dashboard (`src/components/StudentDashboard.tsx`)
- Remove the "Your Learning Timeline" section that uses `BatchTimelineView`
- Replace with a simpler "Upcoming Lessons" preview that reads from the pathway/course drip schedule (using `usePathwayGroupedRecordings` or `useCourseRecordings`)
- Show next 3 upcoming/unlockable recordings with their drip unlock dates, plus a "View All" link to `/videos`

### 4. Update Videos Page (`src/pages/Videos.tsx`)
- Remove `useBatchPathwayRecordings` import and usage
- Remove batch detection logic (the `detectBatch` useEffect)
- Keep `usePathwayGroupedRecordings` as the primary hook for pathway students -- it already supports both batch and non-batch students via `get_course_sequential_unlock_status`
- Remove `isBatchPathwayMode` flag; just use `isInPathwayMode` with the pathway grouped view

### 5. Update `src/hooks/usePathwayGroupedRecordings.ts`
- Remove the batch drip override logic (lines ~90-110 that fetch `batch_timeline_items`)
- Rely entirely on `get_course_sequential_unlock_status` RPC which already handles drip using `drip_days` from `available_lessons` and the enrollment/batch start date

### 6. Update `src/hooks/useCourseRecordings.ts`
- Remove the batch timeline override logic (lines ~101-160 that fetch `batch_timeline_items` and override unlock status)
- Keep only the `get_course_sequential_unlock_status` RPC call which handles all unlock logic

### 7. Update `src/pages/MentorDashboard.tsx`
- Remove live session count that queries `batch_timeline_items`
- Replace with a query against `success_sessions` table instead

### 8. Update `src/components/batch/BatchManagement.tsx`
- Remove the Settings/Timeline icon button that navigates to `BatchTimelinePage`

### 9. Update Router (`src/App.tsx`)
- Remove the `/batch-timeline/:batchId` route

### 10. Update `src/components/batch/BatchStudentAssignment.tsx`
- Check if it references batch timeline; remove any such references

## What Stays the Same
- Batches still exist for grouping students
- `batch_id` stays on `course_enrollments` for identifying which group a student belongs to
- Batch `start_date` is still used as the reference date for drip calculations (via the `get_course_sequential_unlock_status` RPC)
- The `drip_days` field on each recording controls when it unlocks relative to the start date
- Sequential unlock logic remains unchanged
- Live sessions continue via `success_sessions` table

## Technical Details

### Files to Delete (9 files)
- `src/components/batch/BatchTimelineView.tsx`
- `src/components/batch/BatchTimelineManager.tsx`
- `src/components/batch/timeline/ImportCourseDialog.tsx`
- `src/components/batch/timeline/TimelineGroupItem.tsx`
- `src/components/batch/timeline/TimelineGroupedList.tsx`
- `src/hooks/useBatchTimelineStatus.ts`
- `src/hooks/useBatchTimeline.ts`
- `src/hooks/useBatchPathwayRecordings.ts`
- `src/pages/BatchTimelinePage.tsx`

### Files to Modify (8 files)
- `src/components/batch/index.ts` -- remove 2 exports
- `src/components/StudentDashboard.tsx` -- remove BatchTimelineView, add simple upcoming lessons
- `src/pages/Videos.tsx` -- remove batch detection, simplify to pathway-only grouped view
- `src/hooks/usePathwayGroupedRecordings.ts` -- remove batch_timeline_items override
- `src/hooks/useCourseRecordings.ts` -- remove batch_timeline_items override
- `src/pages/MentorDashboard.tsx` -- replace batch_timeline_items query with success_sessions
- `src/components/batch/BatchManagement.tsx` -- remove timeline settings button
- `src/App.tsx` -- remove BatchTimelinePage route

### Database Note
The `batch_timeline_items` table can remain in the database for now (no schema migration needed). It will simply no longer be read by the frontend. You can clean it up later if desired.

