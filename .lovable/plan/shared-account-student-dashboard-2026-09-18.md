# Shared-account student dashboard

The dashboard was built for one student. On shared accounts most cards are already hidden, which leaves a neutral greeting problem and a lonely, narrow Continue Learning card with a large empty area beside it. This tidies up what remains — nothing new is added.

## What changes (shared accounts only)

1. Neutral greeting
   - The welcome line drops the account holder's name and reads "Welcome back" (no personal name anywhere on the page).

2. Financial goal card stays
   - Kept exactly as it is today, unchanged.

3. Continue Learning fills the row
   - On a shared account it stretches to the full width of the page instead of sitting in a third of a three-card grid, so there is no empty space to its right.
   - Inside the card, "Last watched", "Up next", the status line and the "Go to Videos" button lay out side by side on desktop and stack on mobile.

Regular (non-shared) student dashboards are untouched: same greeting, same three-card grid, same cards.

## Technical details

- `src/components/StudentDashboard.tsx`
  - Reuse the existing `isSharedAccount` flag (line 682).
  - Greeting: render "Welcome back" when `isSharedAccount`, otherwise the current name-based greeting.
  - Grid wrapper around Continue Learning / Next Assignment / Integrations: apply `grid-cols-1` when `isSharedAccount`, keep `lg:grid-cols-3` otherwise; the Continue Learning card body becomes a responsive `sm:grid-cols-2 lg:grid-cols-4` block in the shared case.
  - No changes to data fetching, locks, routing or the already-hidden cards (Next Assignment, Integrations, Milestones, Your Rank).
