

# LMS Fixes and Improvements Plan

## Bug Fixes

### Fix 1: Add RoleGuard to unprotected routes (App.tsx)
Wrap these routes with appropriate `RoleGuard`:
- `/shopify-dashboard` → admin, superadmin
- `/meta-ads-dashboard` → admin, superadmin  
- `/catalog` → admin, superadmin
- `/connect` → student, admin, superadmin
- `/certificates` → student
- `/admin` → admin
- `/superadmin` → superadmin
- `/mentor` → mentor
- `/enrollment-manager` → enrollment_manager
- `/support-member` → support_member
- All `/mentor/*` sub-routes → mentor

### Fix 2: Fix sidebar integration links (Layout.tsx)
- Change `/shopify` → `/shopify-dashboard`
- Change `/meta-ads` → `/meta-ads-dashboard`
- Update the `location.pathname` checks to match

---

## Improvements

### 1. Email notification on assignment approval/decline
In `SubmissionsManagement.tsx`, after a submission is approved/declined, insert a row into the `email_queue` table (or call `process-email-queue` edge function) to notify the student via email. Will use the existing SMTP infrastructure via `supabase.functions.invoke('process-email-queue')` or insert into `notifications` table with email channel.

### 2. Enhance admin CSV export
In `src/components/admin/StudentManagement.tsx`, expand `handleExportCSV` to include the additional columns the superadmin version has: LMS Status, Joining Date, Remaining to Pay, Invoice Status, Invoice Due Date, LMS ID, LMS Password, Assignments stats, Recordings Watched, Course/Pathway Access, Activity Logs, Admin Notes.

### 3. Dark mode support
- The CSS already has `.dark` variables defined in `index.css`
- Replace hardcoded colors (`bg-gray-50`, `text-gray-600`, `bg-white`, etc.) with Tailwind semantic classes (`bg-background`, `text-foreground`, `bg-muted`, `text-muted-foreground`, `bg-card`, `border-border`) across Layout.tsx and other major components
- Add a dark mode toggle button in the header using `next-themes` (already installed)
- Wrap the app with `ThemeProvider` in `main.tsx`

### 4. Fix hardcoded paywall invoice data
In `App.tsx`, replace the hardcoded `amount: 50000` and `invoice_number: 'INV-PENDING'` with a real database query. Fetch from `installment_payments` or `invoices` table to get the student's actual pending invoice amount and number.

---

## Files to modify
- `src/App.tsx` — RoleGuards + paywall fix
- `src/components/Layout.tsx` — sidebar links + dark mode classes + theme toggle
- `src/main.tsx` — ThemeProvider wrapper
- `src/components/assignments/SubmissionsManagement.tsx` — email notification on review
- `src/components/admin/StudentManagement.tsx` — enhanced CSV export
- Several component files — replace hardcoded gray colors with semantic tokens

## Estimated scope
~8 files modified, primarily Layout.tsx (largest change for dark mode class replacements).

