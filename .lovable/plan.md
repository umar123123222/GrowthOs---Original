## Diagnosis

I checked the DB and the frontend sort/save code. There are **no duplicate `sequence_order` values per module and no duplicate `order` values per course** right now, so the "switching" isn't stale data — it's caused by four real weaknesses in the code that combine to make the order look unstable:

1. **No tiebreaker on any sort.** Both fetches use `.order('sequence_order')` / `.order('order')` with nothing after it, and the client-side sorts do `(a.sequence_order || 0) - (b.sequence_order || 0)` / `a.moduleOrder - b.moduleOrder`. Any time two rows share a value (or are `NULL`/`0`), Postgres and JS `sort` are free to return them in different orders on different fetches. That is exactly the "it flipped by itself" feeling.
2. **Create/edit forms default `order` and `sequence_order` to `0`.** `ModulesManagement` `formData` starts `order: 0` and `RecordingsManagement` `formData` starts `sequence_order: 0`. If an admin creates a new module/recording without typing a number, the row lands at position 0 and shoves everything else visually. Editing an existing row and clearing the field does the same.
3. **Drag saves aren't serialized.** `handleModuleDragEnd` / `handleModuleDragEnd(moduleRecordings)` fire `Promise.all` writes but there's no guard against a second drag starting while the first is still in-flight. Two overlapping drags can interleave writes and produce a final DB state that doesn't match the last on-screen arrangement — then the next fetch "reverts" the order.
4. **New rows are inserted with `sequence_order = 0` / `order = 0` instead of `max+1`.** So every new item collides with the smallest existing value and re-triggers issue 1.

## Fix (frontend + one small backfill migration, no schema breakage)

### `src/components/superadmin/RecordingsManagement.tsx`
- `fetchRecordings`: chain `.order('sequence_order', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true }).order('id', { ascending: true })` so ties always resolve the same way.
- `groupedRecordings` memo: change the within-module sort to a stable comparator — first `sequence_order` (nulls last), then `created_at`, then `id`.
- New-recording default: when opening the create dialog, compute `sequence_order = (max sequence_order in that module) + 1` instead of `0`. On save, if the field is blank/0, fall back to that computed value.
- `handleModuleDragEnd`: add an `isReorderingRef` (useRef boolean). Ignore drag-end events while a save is in flight; re-enable in `finally`. Keeps rapid drags from racing.

### `src/components/superadmin/ModulesManagement.tsx`
- `fetchModules`: chain `.order('order', { ascending: true, nullsFirst: false }).order('created_at').order('id')`.
- `groupedByCourse` memo (lines ~218-240): same stable tiebreaker on the module list per course.
- Create/edit form: default `order` to `(max order in that course) + 1` instead of `0`; on submit, if left at 0 fall back to that value. Show it as a hint in the input.
- `handleModuleDragEnd`: same `isReorderingRef` guard as recordings.

### Small one-time backfill migration
- For any `modules` rows still at `order = 0` or `NULL` per course: renumber them to `max(order)+1, +2, ...` in `created_at` order so no course has duplicates or zeros going forward.
- Same for `available_lessons.sequence_order` per `module`.
- No table/column/RLS changes.

### Why this stops the "auto-switching"
- Stable tiebreakers mean the same list always renders in the same order, even when values tie.
- New rows get a real position instead of `0`, so they don't push older rows around.
- The drag-in-flight guard removes the interleaved-write race that made a fresh page load show a different order than what the admin just dropped.

## Out of scope
- No changes to unlock logic, drip days, batch/pathway assignment, or the timeline dialog.
- No unique index on `(module, sequence_order)` yet — we can add one later if you want the DB to enforce it, but with the backfill + max+1 defaults it isn't necessary.
