## Plan

Fix the Success Session audience picker so selecting **Unbatched students** means exactly that, not all batches.

### What I will change

1. **Target Batch picker behavior**
   - Make the `Unbatched students` checkbox checked only when `batch_ids` contains `unbatched`.
   - Remove the current behavior where `All Batches` makes `Unbatched students` appear selected.
   - When selecting `Unbatched students` while `All Batches` is active, set `batch_ids` to only `['unbatched']`.
   - When selecting a normal batch while `All Batches` is active, set `batch_ids` to only that selected batch, not all batches plus unbatched.
   - If every specific option is unchecked, fall back to `All Batches` as the default.

2. **Save safety normalization**
   - Before saving, normalize `batch_ids` so `__all__` is never mixed with `unbatched` or batch IDs.
   - Preserve `['unbatched']` as a targeted audience, requiring a Target Course as already intended.

3. **Edit/Duplicate consistency**
   - Keep existing session audiences intact when editing or duplicating.
   - Ensure sessions saved as only unbatched reopen as only `Unbatched students`, not `All Batches`.

4. **Verify**
   - Confirm the picker label changes to `Unbatched students` after selecting only unbatched.
   - Confirm the saved session displays an `Unbatched` badge instead of `All Batches` or all batch badges.

### Technical scope

- Edit only `src/components/superadmin/SuccessSessionsManagement.tsx`.
- No database schema changes.
- No changes to student visibility logic unless this UI fix reveals a separate issue.