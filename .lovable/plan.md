## Goal

Restrict the in-app notifications visible to **students** (bell dropdown + `/notifications` page) to only those directly relevant to them. Staff (admin, superadmin, mentor, enrollment_manager, support_member) keep seeing everything they see today.

## Student allowlist (final)

| # | Event | Source notification |
|---|---|---|
| 1 | Success session added or edited | `learning_item_changed` where `item_type='success_session'` and `action in ('insert','update')` (also legacy `success_session` type) |
| 2 | Invoice generated | existing `invoice_issued` |
| 3 | Invoice marked paid | NEW `invoice_paid` — emit from `mark-invoice-paid` edge function |
| 4 | New video dripped (newly unlocked for this student) | NEW `content_unlocked` — emit from `notify-content-unlocked` for recordings only |
| 5 | New assignment unlocked | NEW `assignment_unlocked` — emit when the gating recording for an assignment unlocks for the student |
| 6 | Assignment approved / declined | NEW `assignment_reviewed` (status in payload) — emit from the submission-review path (currently only mentor is notified) |
| 7 | Resource added or edited | NEW `resource_changed` — emit from a DB trigger on `resources` / `resource_sections` for every student in the resource's audience |

Everything else is hidden for students: `ticket_updated`, `student_added`, `module`, `financial`, `lms_suspended`, `fee_extension`, `installment_*`, updates/deletes of recordings, raw `recording`/`learning_item_changed` for new content additions by admins (those become noise — students get the `content_unlocked` / `assignment_unlocked` events instead).

## Implementation

### A. Frontend allowlist (immediate effect on existing data)

New `src/lib/notification-filter.ts` exporting `isStudentRelevantNotification(n, role)`:
- If `role !== 'student'` → return `true`
- Else return `true` only when the notification's `template_key || type` is in the allowlist above, with payload-level checks for action (`insert|update` for success sessions; `approved|declined` for assignment review).

Apply in:
- `src/components/NotificationDropdown.tsx` — filter after fetch + on realtime insert; recompute `unreadCount` from the filtered list.
- `src/pages/Notifications.tsx` — same, plus filter the realtime INSERT handler.

Also extend the display/enrichment maps in both files with titles + links for the new keys:
- `invoice_paid` → "Fee payment confirmed" → `/fees`
- `content_unlocked` → "New video unlocked: <title>" → `/videos?recordingId=<id>`
- `assignment_unlocked` → "New assignment unlocked: <name>" → `/assignments?assignmentId=<id>`
- `assignment_reviewed` → "Assignment <approved|declined>: <name>" → `/assignments?assignmentId=<id>`
- `resource_changed` → "Resource <added|updated>: <title>" → `/resources`

User role is read via the existing `useUserRole` hook (used elsewhere).

### B. Backend emitters (so the allowlisted events actually fire)

1. **`invoice_paid`** — in `supabase/functions/mark-invoice-paid/index.ts`, after the invoice row flips to `paid`, insert into `notifications` for that student's `user_id` with `type='invoice_paid'`, `template_key='invoice_paid'`, payload `{ title, message, data: { invoice_id, amount, installment_number } }`.

2. **`content_unlocked`** + **`assignment_unlocked`** — in `supabase/functions/notify-content-unlocked/index.ts` (already triggered on `user_unlocks` inserts):
   - When the unlocked item is a recording → emit `content_unlocked` to that student.
   - Additionally look up the recording's `assignment_id`; if present, emit `assignment_unlocked` to the same student.

3. **`assignment_reviewed`** — find the place that updates submission status to `approved`/`declined` (search for `submissions` table updates / `notify_submission_status_change`). Add a `notifications` insert targeting the student `user_id` with payload `{ title, message, data: { submission_id, assignment_id, status } }`.

4. **`resource_changed`** — DB trigger on `resources` (and `resource_audiences` change): for each user that `user_can_see_resource(_user, resource_id)` returns true for, insert a `notifications` row with `type='resource_changed'`. Use a SECURITY DEFINER function `notify_resource_change(resource_id, action)` invoked from AFTER INSERT/UPDATE triggers.

### C. Phasing (recommended)

1. **Phase 1 (small, ships now):** Frontend filter + display strings. Immediately cleans up the student view — old noisy notifications stop appearing. (No backend change.)
2. **Phase 2:** Add the 4 new backend emitters (`invoice_paid`, `content_unlocked`/`assignment_unlocked`, `assignment_reviewed`, `resource_changed`). Each is a small focused change.

I'll do both phases in one pass unless you want Phase 1 first to verify the filter behaves right.

## Out of scope

- Email / SMS templates for the new events (in-app only).
- Backfilling / cleaning historic noisy rows from `notifications` (they're just filtered out of the student UI).
- Notification mute settings UI changes.

## Files touched

New: `src/lib/notification-filter.ts`
Modified: `src/components/NotificationDropdown.tsx`, `src/pages/Notifications.tsx`, `supabase/functions/mark-invoice-paid/index.ts`, `supabase/functions/notify-content-unlocked/index.ts`, submission-review path (TBD on read), one new SQL migration for `resource_changed` trigger.
