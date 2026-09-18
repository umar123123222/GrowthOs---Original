# Shared accounts: close the remaining gaps

Four follow-ups on the shared-account work, so a shared student's experience stays consistent no matter how they reach a page. Nothing here changes any existing student's data, access, or invoices — every change is gated behind the shared-account flag only.

## What changes

**1. Pages hidden from the menu are hidden for real.**
Right now the menu items are removed for shared accounts, but a student who types the address directly still gets in. After this, a shared student who opens one of those addresses lands back on their dashboard instead.
Affected: Assignments, Leaderboard, Certificates, Connect Accounts, Support, Shopify Dashboard, Meta Ads Dashboard.
Still open to shared students: Dashboard, Catalog, Videos, Success Sessions, Resources, Support Details, Profile, Notifications.

**2. No lesson-rating prompts for shared accounts.**
"Rate this lesson" on the lesson page, the popup that auto-asks for feedback after a lesson, and the "N awaiting your feedback" badge on the videos page all depend on one shared history — one person rating a lesson hides it from everyone. These are hidden for shared accounts only.

**3. No blended celebration or motivational nudges for shared accounts.**
Milestone-celebration and motivational entries are generated from total lessons watched, which on a shared account is a mix of many people. These stop appearing for shared accounts. (The full-screen celebration window itself is not live in the app today — it is imported but never rendered — so I will also remove that dead wiring so it cannot reappear.)

**4. Shared accounts are easy to find and clearly marked.**
A "Shared account" filter in Students Management (All / Shared only / Regular only) alongside the existing LMS Status and Batch filters, plus the Shared badge on the student detail dialog so it is visible without opening the edit form.

The chat bubble stays available to shared accounts, as you chose.

## Technical details

- **New `src/components/SharedAccountRouteGuard.tsx`** — reads `useAuth`; when `user.role === 'student' && user.is_shared_account`, renders `<Navigate to="/" replace />`, otherwise renders children. Wrap the seven routes in `src/App.tsx` (assignments, leaderboard, certificates, connect, support, shopify-dashboard, meta-ads-dashboard).
- **`src/pages/VideoPlayer.tsx`** — the `<LectureRating>` panel (line ~620) renders only when the signed-in user is not a shared student.
- **`src/components/Layout.tsx`** — `<PendingFeedbackPrompt />` (line ~1353) renders only for non-shared students.
- **`src/pages/Videos.tsx`** — the `PendingFeedbackChip` badge (line ~320) is skipped when `isSharedAccount` is true, reusing the flag already in that file.
- **Notification sources** — `src/components/NotificationDropdown.tsx` (fetch, line ~159) and `src/pages/Notifications.tsx` (fetch, line ~152) exclude notification types `milestone_celebration` and `motivation` for shared students, keeping the unread count consistent with the list. `src/components/MotivationalNotifications.tsx` returns early for shared students.
- **`src/components/admin/StudentManagement.tsx`** — new `sharedFilter` state and a Select in the existing filter row (near line ~1597), applied inside `filterStudents()` (line ~398) as `Boolean(student.is_shared_account)`; the flag is already loaded and used for the row badge (line ~1724).
- **`src/components/admin/StudentEngagementDetail.tsx`** — widen the `student` prop with `is_shared_account?: boolean` and show a "Shared" badge beside the name (line ~187); pass the value through from its caller `src/components/admin/StudentAnalytics.tsx` (line ~603).
- **`src/App.tsx`** — remove the unused `MilestoneCelebrationProvider` / `MilestoneCelebrationPopup` imports.
- No database migration and no data edits; the shared-account column, trigger, and admin switches from the earlier work stay as they are.

## Verification

- Typecheck and build clean, with `build-errors.log` checked after the edits.
- Shared account: menu unchanged; typing `/leaderboard`, `/certificates`, `/assignments`, `/support`, `/connect`, `/shopify-dashboard`, `/meta-ads-dashboard` returns to the dashboard; no rating panel, no feedback popup or badge; no milestone-celebration or motivational entries; chat bubble still visible.
- Regular student: every one of those surfaces unchanged.
- Admin: the new filter returns only shared accounts, and the Shared badge shows in the student detail dialog.
- A signed-in walkthrough of the live preview is not possible for this project (its sign-in backend is not one I can generate a test session for), so after the automated checks I will ask you to glance at a shared account and a normal one.
