## Goal
Introduce a new **`viewer`** role. Viewers can only navigate to:
1. Dashboard
2. Modules & Videos (Recordings)
3. Resources
4. Submissions
5. Success Sessions
6. Students Management
7. Batches

On every allowed page, all buttons/controls that create, edit, delete, assign, unassign, toggle, approve/reject, send, reset, or otherwise mutate data must be hidden for viewers. They can still open detail dialogs in read-only mode (no save/edit/delete actions visible).

## Implementation

### 1. Database
- Add `'viewer'` to the `app_role` enum.
- RLS: viewers get the same SELECT permissions as admin (read-only). They get **no** INSERT/UPDATE/DELETE policies — write attempts fail server-side as a defense-in-depth backup to the UI guards.
- Add `has_role(uid, 'viewer')` to relevant SELECT policies on the tables shown on the listed pages (students, batches, recordings, resources, assignment_submissions, success_sessions, etc.).

### 2. Auth & Types
- Add `'viewer'` to the `role` union in `src/types/common.ts` and `src/hooks/useAuth.ts` re-exports.
- `RoleGuard` already takes string[] — no change needed.

### 3. Routing (`src/App.tsx`)
- Root `/` and `/dashboard` for viewer → render a new lightweight `ViewerDashboard` (or reuse `SuperadminDashboard` in read-only mode — see decision below).
- Add `RoleGuard` allow `viewer` on: `/videos`, `/videos/:moduleId/:lessonId`, `/resources`, `/students`, plus a new `/viewer` route that hosts the Submissions / Success Sessions / Batches views (re-using existing superadmin components, gated to read-only).
- Block all other routes for viewer (`<Navigate to="/" />`).

### 4. Navigation (`src/components/Layout.tsx`)
- Add `isUserViewer`. Build a dedicated nav list for viewer containing only the 7 allowed entries.
- Hide Teams, Support, Admin Panel, Super Admin, Connect, Profile-edit links beyond what's needed.

### 5. Read-only enforcement on shared components
Add a single helper `useIsReadOnly()` (returns `user.role === 'viewer'`). In each of the following components, wrap action buttons with `{!isReadOnly && …}`:
- `src/components/superadmin/StudentsManagement.tsx` — Add Student, Edit, Delete, Reset Password, Assign/Unassign Pathway, Skip Drip, Suspend, etc.
- `src/components/superadmin/SuccessSessionsManagement.tsx` — Create/Edit/Delete/Reschedule.
- `src/components/assignments/SubmissionsManagement.tsx` — Approve/Reject/Comment/Score.
- `src/components/superadmin/RecordingAttachmentsManager.tsx` + recordings tab UI — Upload/Edit/Delete.
- Resources page — Upload/Edit/Delete.
- Batches tab UI — Create/Edit/Delete/Assign.
- Dashboard quick-action cards — keep navigation cards, hide any "create" CTAs.

### 6. Creation flow
- Superadmin can create a viewer from `/teams` (same dialog as other staff roles). Add `'viewer'` to the role dropdown and to the `create-enhanced-team-member` edge function's allowed roles.

### 7. Activity logging
- Viewer logins are logged like any other user. No write-action logs (they can't write).

## Decisions needed
1. Where should viewer land for "Submissions / Success Sessions / Batches"? Options:
   a) Reuse the existing `/superadmin?tab=…` URLs and let viewer access just those tabs (simpler, requires guarding the SuperadminDashboard tab list to only show allowed tabs for viewer).
   b) Build a dedicated `/viewer` page mirroring those tabs.
   **Recommendation: (a)** — much less duplication; we just filter the tab list and pass a `readOnly` flag to each tab component.

2. Should viewer be allowed to **download/export** (CSV, PDF, attachments)? These don't mutate data.
   **Recommendation: yes, allow downloads** (still read-only).

3. Should viewer see student PII (emails, phone, payment status)?
   **Recommendation: yes** — needed for the listed pages to be useful. Confirm if you want anything redacted.

## Files to touch (high level)
- 1 migration (enum + policies)
- `src/types/common.ts`, `src/hooks/useAuth.ts`
- `src/App.tsx`, `src/components/Layout.tsx`, `src/components/RoleGuard.tsx` (no change), `src/pages/SuperadminDashboard.tsx` (filter tabs for viewer)
- `src/components/superadmin/StudentsManagement.tsx`, `SuccessSessionsManagement.tsx`, batches component, recordings components
- `src/components/assignments/SubmissionsManagement.tsx`
- `src/pages/Resources.tsx` / admin `ResourcesManagement.tsx`
- `src/pages/Teams.tsx` + `supabase/functions/create-enhanced-team-member/index.ts` (add viewer to allowed roles)

Please confirm decisions 1–3 (or just say "go ahead with the recommendations") and I'll implement.