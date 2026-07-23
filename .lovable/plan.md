## Goal

In the Content Timeline dialog (individual course view), display modules and videos in the exact same order as the `/superadmin?tab=recordings` page — grouped by module, with modules sorted by their `order` column and videos within each module sorted by `sequence_order`. Drip-day values become display-only for sorting; they no longer reshuffle the list.

## Current behavior (verified in `src/components/superadmin/ContentTimelineDialog.tsx`)

- Modules are fetched with `.order('order', ascending)` and recordings with `.order('sequence_order', ascending)` (lines 98–111) — the correct order arrives from the DB.
- But the render layer re-sorts:
  - Modules are re-sorted by `minDrip` (lowest `drip_days` in the module) — lines 643–653.
  - Recordings inside a module are re-sorted by `drip_days` first, then `sequence_order` — lines 656–661.
  - A dedupe-by-title step then drops any recording whose title repeats — lines 663–669.

Result: modules and videos appear in drip-days order, not the order shown on `/recordings`.

## Change

Edit `src/components/superadmin/ContentTimelineDialog.tsx` only:

1. **Module order** (lines 643–654): drop the `minDrip` sort. Iterate modules in the order they arrive from `groupedByCourse` (which already reflects the DB `order` column because `fetchTimeline` inserts them in that order). Preserve insertion order by using `Object.entries(courseData.modules)` directly with no `.sort(...)`.

2. **Recording order within a module** (lines 656–661): replace the `drip_days`-first sort with `sequence_order` ascending (nulls last), matching `/recordings`.

3. **Remove the title-dedupe** (lines 663–669): `/recordings` shows every row, so the timeline should too. If two lessons legitimately share a title, both must appear (drip inputs are keyed by recording id, so this is safe).

4. **Keep everything else intact**: drip inputs, Course-override badges, Reset buttons, drag-to-reorder, save logic, Live Sessions block, pathway-scoped view. Drag-reorder still writes `sequence_order` (already implemented in `handleReorderRecordings`), so reordering here will now also match `/recordings` after save.

## Out of scope

- No DB migration, no RLS change, no edge function change.
- Pathway-scoped view (`type === 'pathway'`) uses the same render path, so it inherits the same corrected ordering — no separate work needed.
- `/recordings` page itself is not touched.

## Verification

- Open Superadmin → Content → Courses → clock icon on "Client Acquisition Mastery". Confirm chapters appear in the same order as `/recordings` (Chapter 1, 2, 3, …) and videos inside each chapter match the `/recordings` sequence (e.g. Chapter 5: "Lead Generation System" → "Meta Setup Done Right" → "Running Ads").
- Confirm drip-day inputs, Course-override badges, Reset, and Save still work.
- Confirm the pathway-scoped timeline (opened from Pathways → clock icon) also renders in `/recordings` order.
