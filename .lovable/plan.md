
## Goal
Eliminate "feels stuck" moments across bulk actions, forms, and heavy pages by adding immediate feedback, async backend processing, and a global progress indicator.

## 1. Global top progress bar (foundation)
- Add `nprogress`-style bar via a lightweight custom component (`GlobalProgressBar`) mounted in `App.tsx`.
- Expose `startProgress()` / `stopProgress()` through a Zustand store (`useProgressStore`).
- Auto-hook into:
  - React Router navigation (start on `useNavigation`/route change, stop on render).
  - `supabase.functions.invoke` wrapper (`invokeWithProgress`) so every edge-function call ticks the bar.
- Styling: 2px bar, `bg-primary`, subtle glow, respects dark mode.

## 2. Bulk success-session emails → fire-and-forget
- **Edge function** `send-batch-content-notification` (and any other bulk email path used for success sessions): return `202 Accepted` immediately, wrap the actual send loop in `EdgeRuntime.waitUntil(...)`.
- Write per-job rows into a new `background_jobs` table (`id, kind, status, total, processed, failed, error, created_by, created_at, updated_at`) with RLS scoped to creator + admins.
- Frontend caller:
  - Optimistic toast: "Sending 47 emails in the background…"
  - Subscribe to `background_jobs` realtime for that `job_id`, update toast on completion ("47 sent, 0 failed").
  - Unblock the modal/button instantly.

## 3. Scheduling / updating success sessions
- Same async pattern for the schedule-and-notify path.
- Split the write (fast) from the notify (slow): DB insert commits and closes the dialog immediately; notification dispatch runs via `EdgeRuntime.waitUntil`.
- Add optimistic row insertion in the sessions table so the new session appears before the round trip completes.

## 4. Add/edit forms (modules, videos, students, sessions)
- Standardize a `<SubmitButton>` that:
  - Disables + shows spinner while pending.
  - Uses `useMutation`-style local state (already present in some places, missing in others).
- Replace `window.location.reload()` / full refetches with targeted invalidations where used.
- Add toast **before** refetch resolves (success is known at edge-function 2xx).
- For student creation, show the multi-step progress (create auth user → profile → enrollments → invoices) in the toast description.

## 5. Student `/assignments` page
- Parallelize the 4 sequential fetches in `StudentAssignmentList.fetchData` with `Promise.all` (already close, verify).
- Render skeleton cards immediately instead of the centered "Loading assignments..." text.
- Show assignments as soon as `assignments` + `submissions` arrive; `recording_views` and unlocks can hydrate progressively (assignments render as "checking access…" then flip to unlocked/locked).
- Cache with `useQuery` (React Query is already in the project) so re-entering the page is instant.

## 6. Perceived-perf polish
- Add `<Skeleton />` loaders where spinners are used in list views (payment reports, students management, modules).
- Debounced search inputs (300ms) where they trigger fetches.
- Ensure every long-running button has `disabled={isPending}` + spinner.

## Technical notes
- New table: `public.background_jobs` with `GRANT` block + RLS (creator can select their jobs, admins/superadmins can select all, service_role full).
- Realtime enabled on `background_jobs`.
- New client util: `src/lib/invoke-with-progress.ts` wrapping `supabase.functions.invoke`.
- New component: `src/components/system/GlobalProgressBar.tsx`.
- New store: `src/stores/progress-store.ts`.
- Progressive rollout — I'll ship in this order so each layer is usable on its own:
  1. Global progress bar + invoke wrapper
  2. background_jobs table + bulk email async conversion
  3. Success session scheduling async
  4. Form standardization (SubmitButton)
  5. `/assignments` skeletons + parallel fetch

## Out of scope
- Rewriting individual edge functions for pure performance (only the bulk ones become async).
- Changing database schema beyond `background_jobs`.
- Replacing the toast system.

Shall I proceed with step 1 (global progress bar + invoke wrapper) and step 2 (bulk email async) first? They give the biggest visible win.
