## Goal

In the superadmin **/recordings** page:
- Group videos by **Course → Module** (module acts as a section header).
- The "Order" badge shows the video's position **within its module**, restarting at **1** for each module.
- Drag-to-reorder is scoped to a single module; you cannot drag a video from one module into another.
- Reordering saves back to `available_lessons.sequence_order` per-module (1..N), which is the same field the student `/videos` page reads — so student playback order stays in sync automatically.
- No changes to `/courses` content pipeline (course drip) or `/pathway` content pipeline (pathway drip). Those keep controlling drip dates for their respective enrollments exactly as today.

## What changes

**File: `src/components/superadmin/RecordingsManagement.tsx`** (only file touched)

1. **Grouping**
   - Extend the existing `groupedRecordings` memo to a two-level structure: `Course → Module → recordings[]`.
   - Sort modules by `modules.order`, and recordings inside each module by `sequence_order` ascending.
   - Render each course as a collapsible section (as today), and inside it render one collapsible sub-section per module with a header showing the module title and video count.

2. **Order badge**
   - Replace `{recording.sequence_order || 0}` with the video's index within its module + 1 (i.e., `1, 2, 3…` restarting per module). The stored `sequence_order` value backs this — no display drift.

3. **Drag-to-reorder scope**
   - Wrap each module's list in its own `DndContext` + `SortableContext` (one per module, not one per course/page).
   - `handleRecordingDragEnd` becomes module-scoped: it receives the module's recordings, runs `arrayMove`, then writes `sequence_order = index + 1` for **only that module's rows**. This fixes the current bug where drags renumber across mixed modules.
   - Dragging outside a module's list simply does nothing (no cross-module moves in this pass).

4. **No DB migration**
   - `sequence_order` semantics stay per-module. We simply enforce per-module 1..N on every reorder.
   - Optional, low-risk cleanup on load: for any module whose recordings have gaps/duplicates in `sequence_order`, silently renumber them 1..N in place. Skipped if the user prefers zero writes on load — I'll leave it OFF by default and only renumber when the user drags.

5. **Filters preserved**
   - Search, course filter, module filter continue to work. When a module filter is active, only that module's group renders. When a course filter is active, only that course's modules render.

## What does NOT change

- Student `/videos` page ordering logic (`useVideosData`, `usePathwayGroupedRecordings`) — unchanged. It already sorts by `modules.order` then `sequence_order`, which is exactly what we're maintaining.
- Sequential unlock, drip days, `/courses` and `/pathway` content pipelines — untouched.
- Database schema, RLS, triggers — untouched.
- Add/Edit recording dialog, attachments, ratings, sync-unlocks button — untouched.

## Technical details

- Grouped structure built in a single `useMemo` from `filteredRecordings + courses + modules`:
  ```
  [{ courseId, courseTitle, modules: [{ moduleId, moduleTitle, moduleOrder, recordings: [...] }] }]
  ```
- `SortableRecordingRow` receives `displayOrder = index + 1` (the module-local index) and renders it in the badge instead of `sequence_order`.
- `handleRecordingDragEnd(moduleId, event)` is curried per module. Persistence loop only updates rows within that module.
- On drag end, UI updates optimistically; failure reverts via `fetchRecordings()` (same pattern as today).

## Verification

- Reorder a video inside Module A → badge renumbers 1..N in Module A only; Module B untouched.
- Reload the superadmin page → order persists.
- Open student `/videos` as an enrolled student → same order as superadmin shows for that module.
- Course drip in `/courses` and pathway drip in `/pathway` still gate unlock dates as before.
