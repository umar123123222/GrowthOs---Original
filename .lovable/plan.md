## Problem

Drag-reorder in `/superadmin?tab=modules` (ModulesManagement) and `/superadmin?tab=recordings` (RecordingsManagement) feels like the change isn't saved. Two real causes in the code:

1. **Sequential per-row writes.** Both handlers loop and `await supabase.update()` one row at a time (N round-trips). For a chapter with 10+ items this takes seconds; if the user refreshes or drags again during that window, only some rows are persisted, so the order appears to "revert."
2. **Module reorder in the grouped ("All Courses") view is scoped wrong.** `handleModuleDragEnd` runs `arrayMove` on the **flat** `modules` state and reassigns `order = 1..N` across every course. Dragging Chapter 3 above Chapter 2 inside "Client Acquisition Mastery" also renumbers modules of every other course, and the reindexing doesn't correspond to the visible group — the row can appear to snap back after the next fetch.

## Fix

Change only the two drag handlers. No schema changes, no UI/table restructuring.

### 1. `src/components/superadmin/RecordingsManagement.tsx` — `handleModuleDragEnd`
- Keep the optimistic `setRecordings` patch.
- Replace the `for (const update of updates) { await supabase.from('available_lessons').update(...) }` loop with a **single batched write**: `supabase.from('available_lessons').upsert(updates, { onConflict: 'id' })` (or `Promise.all` of updates — pick upsert for one round-trip).
- On error, revert via `fetchRecordings()` (already there).

### 2. `src/components/superadmin/ModulesManagement.tsx` — `handleModuleDragEnd`
- Detect the affected course group from `active.id` (look up `modules.find(m => m.id === active.id).course_id`).
- Build the reorder against **only that group's modules** (filter `modules` by that `course_id`, `arrayMove` within it, reindex 1..N inside the group).
- Merge the group's new order back into the flat `modules` state (other courses untouched) and `setModules` for the optimistic update.
- Persist with a single `supabase.from('modules').upsert(updates, { onConflict: 'id' })` containing just the touched rows.
- On error, `fetchModules()` to revert.
- The "specific course filtered" path already operates on one course, so it gets the same batched upsert but no scoping change.

### Why this makes it feel "instant"
- One network round-trip instead of N — save completes in ~1 request.
- Group-scoped reindex means the persisted `order` values match what the user sees, so a refresh shows the same arrangement.
- Optimistic UI stays; failure still reverts.

## Out of scope
- Recording ordering already scopes per module correctly — only the write is batched.
- No changes to fetching, RLS, or the table markup fixed earlier.
