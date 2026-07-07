
## Goal
Cut initial render time and memory pressure on the heaviest lists by loading only what's visible. Tables get numbered pagination (50/page); card/feed lists get a "Load more" button (50 at a time).

## Shared primitives (build once, reuse)

1. **`useServerPagination<T>(query, { pageSize })`** — hook that runs a Supabase `.range()` query with `count: 'exact'`, returns `{ rows, total, page, setPage, pageCount, loading, refetch }`. Handles filter/sort deps.
2. **`<TablePagination />`** — shadcn-based pager: `‹  1 2 3 … 42  ›` + "Showing 51–100 of 2,109" + optional page-size selector. Uses existing `components/ui/pagination.tsx`.
3. **`useLoadMore<T>(query, { pageSize })`** — same idea but appends: `{ rows, loadMore, hasMore, loading, reset }`.
4. **`<LoadMoreButton />`** — full-width outline button with spinner + "Showing X of Y".

All four go under `src/components/common/` and `src/hooks/`.

## Per-list changes

### Tables → numbered pagination, 50/page
- **Students Management** (`src/components/superadmin/StudentsManagement.tsx`)
  - Server-side pagination with `count: 'exact'`, `range(from, to)`.
  - Filters (status, batch, search) reset to page 1 and re-query.
  - Debounce search 300ms.
  - Bulk-select stays scoped to current page (with an explicit "Select all N matching" affordance if selection is used).
- **Payment Reports** (`src/components/admin/PaymentReports.tsx`)
  - Same treatment; already sorts server-side, just add `range` + count.
- **Submissions Management** (`src/components/assignments/SubmissionsManagement.tsx`)
  - Numbered pagination on the submissions table (admin/mentor view).
- **Support Tickets — admin** (`src/components/superadmin/SupportManagement.tsx`)
  - Table with numbered pagination.

### Card lists → Load more, 50 at a time
- **Student /assignments** (`src/components/assignments/StudentAssignmentList.tsx`)
  - Pull assignments in pages of 50, "Load more" appends.
  - Search stays client-side over loaded rows (or triggers server fetch if q is set — I'll keep it client-side over the loaded batch for simplicity; matches current UX).
- **Support Tickets — student view** (`src/pages/Support.tsx`)
  - Card list with Load more.

## Not touched (out of scope this round)
- Analytics dashboards / charts (they aggregate, not list; will address separately if needed).
- FinancialManagement / GlobalFinancials (aggregate views — same reason).
- Notification lists (already relatively small; will add later if you flag it).

## Technical notes
- Every query uses `.select('...', { count: 'exact' })` + `.range(from, to)`.
- Progress bar (already shipped) auto-ticks on every fetch through the wrapper — good perceived feedback.
- Preserve existing sort/filter state across page changes.
- Reset to page 1 when any filter changes.

## Rollout order
1. Shared hooks + components
2. Students Management (biggest file, biggest win)
3. Payment Reports
4. Submissions Management + Support admin
5. StudentAssignmentList + Support student page

Proceeding now.
