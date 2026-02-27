

# Comprehensive LMS Audit: Issues & Missing Features

## BUGS / BROKEN ITEMS

### 1. Missing Route: `/certificates`
The sidebar (Layout.tsx line 141) links to `/certificates`, but **no route exists** in App.tsx. Clicking "Certificates" in the sidebar redirects to `/` (the catch-all). The `Certificates` page component exists but is never imported or routed.

### 2. Missing Route: `/mentorship`
The sidebar (Layout.tsx line 71) shows a "Mentorship" link for students and mentors, but **no `/mentorship` route exists** in App.tsx. Clicking it redirects to `/`.

### 3. LiveSessions page does NOT show "live" sessions
The LiveSessions.tsx query on line 210 filters `.in('status', ['upcoming', 'completed'])` -- it **excludes `'live'` status entirely**. After the edge function auto-updates a session from `upcoming` to `live`, it vanishes from this page. This directly contradicts the dashboard fix just made.

### 4. LiveSessions page disappears sessions at start_time
Line 224: `new Date(session.start_time) >= now` means once a session's start_time passes, it's removed from "upcoming" but NOT caught by the "past" filter either (since `sessionEnd >= now` returns false). Sessions that are currently ongoing are invisible on this page.

### 5. Messages page is non-functional
Messages.tsx (line 46-47) explicitly sets `messages` to an empty array with the comment "messages table doesn't exist." Sending a message writes to `user_activity_logs` instead. The entire page is a dead-end UI.

### 6. Certificates page is a placeholder
Certificates.tsx (line 38-39) hardcodes `setCertificates([])` with comment "Certificates table doesn't exist yet." The page shows a "Coming Soon" banner and static placeholder data.

### 7. No RoleGuard on several routes
Routes like `/students`, `/teams`, `/shopify-dashboard`, `/meta-ads-dashboard`, `/catalog`, and `/connect` in App.tsx have no `RoleGuard`. Any authenticated user can access them regardless of role.

### 8. LiveSessions `user` prop may be undefined
In App.tsx, `<LiveSessions user={user} />` passes the user, but the component's `useEffect` (line 197) only fetches data `if (user?.id)` -- if the auth user object structure differs from what the component expects, sessions won't load.

---

## MISSING FEATURES / SUGGESTIONS

### 1. Session status "live" not reflected in LiveSessions page
The dashboard was fixed but the LiveSessions page still uses the old logic. It should include `'live'` in the status filter and show currently-live sessions prominently.

### 2. No search/filter on Videos page
Students have no way to search recordings by name. With many modules, this becomes a UX problem.

### 3. No pagination on student management tables
The superadmin and admin student management pages fetch all students at once. With hundreds of students, this causes slow loads.

### 4. No email notification on assignment status change
When an admin approves/declines a submission, there's no email notification to the student -- only in-app.

### 5. No dark mode support
The app uses hardcoded light colors in many places (e.g., `bg-gray-50`, `text-gray-600`) rather than semantic Tailwind classes, making dark mode impossible.

### 6. No session recording upload for admins
Admins can set a link for live sessions but there's no dedicated recording upload/management after a session ends.

### 7. No student self-service payment view
Students see a paywall modal but have no dedicated page to view invoices, payment history, or make payments.

### 8. Admin CSV export missing on admin-level StudentManagement
The comprehensive 23-column CSV export was added to superadmin's `StudentsManagement.tsx` but NOT to admin-level `StudentManagement.tsx`.

---

## PRIORITY FIX LIST

| # | Issue | Severity |
|---|-------|----------|
| 1 | LiveSessions excludes `'live'` status -- sessions vanish | **Critical** |
| 2 | `/certificates` route missing -- sidebar link broken | **High** |
| 3 | `/mentorship` route missing -- sidebar link broken | **High** |
| 4 | Messages page non-functional | **Medium** |
| 5 | No RoleGuard on several routes | **Medium** |
| 6 | Admin CSV export not updated | **Low** |

