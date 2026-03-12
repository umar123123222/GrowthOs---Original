
# LMS Fixes and Improvements — COMPLETED

## ✅ Bug Fixes (Done)

### Fix 1: RoleGuard on unprotected routes (App.tsx)
- `/admin` → admin, superadmin
- `/superadmin` → superadmin
- `/mentor` + all `/mentor/*` sub-routes → mentor
- `/enrollment-manager` → enrollment_manager
- `/support-member` → support_member

### Fix 2: Sidebar integration links (Layout.tsx)
- `/shopify` → `/shopify-dashboard`
- `/meta-ads` → `/meta-ads-dashboard`

## ✅ Improvements (Done)

### 1. Email notification on assignment approval/decline
- Inserts into `email_queue` table when a submission is approved/declined
- Includes assignment name, reviewer name, and feedback notes

### 2. Enhanced admin CSV export
- Now exports 19 columns matching superadmin version: LMS Status, Joining Date, Remaining to Pay, Invoice Status, Invoice Due Date, LMS ID, LMS Password, Recordings Watched, Course/Pathway Access, Batch, Admin Notes

### 3. Dark mode support
- Added `ThemeProvider` from `next-themes` wrapping the app
- Added Sun/Moon toggle button in the header
- Replaced hardcoded colors in header, sidebar, and main content with semantic tokens (`bg-background`, `bg-card`, `border-border`, `text-muted-foreground`)

### 4. Fixed hardcoded paywall invoice data
- Replaced placeholder `amount: 50000` / `invoice_number: 'INV-PENDING'` with real DB query
- Fetches earliest unpaid invoice from `invoices` table via student record

## Remaining items (not in scope)
- Student self-service payment view (deferred)
- No search/filter on Videos page (deferred)
- No pagination on student tables (deferred)
