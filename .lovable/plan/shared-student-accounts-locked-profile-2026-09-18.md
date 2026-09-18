# Shared student accounts (locked profile)

Some accounts are shared by several students. Those accounts must not allow anyone signed in as the student to change the name, login email, or password. Only admins/superadmins can change those details.

## What the admin sees

- A "Shared account" switch when adding a student and when editing a student.
- Students Directory shows a small "Shared" badge on those rows, so staff can spot them.
- Turning the switch on/off is recorded in activity logs.

## What the student sees

On a shared account, the Profile page shows:

- Name and email fields as read-only, with a short note: "This is a shared account. Contact support to update these details."
- The "Change password" section hidden, with the same note.

Everything else on the profile page keeps working as it does today. The sign-in page is untouched — shared accounts have no mailbox access, so email password reset isn't a route they can use anyway.

## Technical details

1. Migration
   - `ALTER TABLE public.users ADD COLUMN is_shared_account boolean NOT NULL DEFAULT false;`
   - Trigger `prevent_shared_account_self_edit` (BEFORE UPDATE on `public.users`): if `OLD.is_shared_account` and the caller is the row owner (`auth.uid() = OLD.id`) and `full_name` or `email` changed, raise an exception. Admin/superadmin paths (service role in edge functions, or `has_role`) are exempt.
   - No new table, no RLS policy changes; existing grants stay as they are.

2. UI
   - `src/pages/Profile.tsx`: read `is_shared_account` from the user record, disable name/email inputs, hide the save button for those fields, hide the password card, show the note.
   - `src/components/EnhancedStudentCreationDialog.tsx` and `src/components/EditStudentDialog.tsx`: add the switch, pass the flag through `create-enhanced-student` / `update-student-details`.
   - `src/components/admin/StudentManagement.tsx`: show the "Shared" badge.
   - `supabase/functions/update-student-details`: persist the flag and log the change to `admin_logs`.

Existing students are unaffected: the flag defaults to false, so current behaviour is unchanged until an admin turns it on.
