

# Fix Reset Password to Use Original Default Password

## Problem
The approved plan to stop overwriting `password_display` was never applied. The code in `ResetPassword.tsx` (lines 226-241) still syncs `password_display` to whatever new password the student sets. This means the "Reset Password" button on the Students Management page resets to the student's *current* password instead of the *original* one issued at creation.

## Solution

### 1. Add `original_password` column to `users` table
We need a separate field that is set once during student creation and never changed. `password_display` is already being used for "current password" visibility, so we introduce `original_password` as the immutable default.

**Migration:**
```sql
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS original_password text;
UPDATE public.users SET original_password = password_display WHERE original_password IS NULL;
```

### 2. Set `original_password` during student creation
In `create-enhanced-student/index.ts`, when inserting the user record, also set `original_password` to the generated password. This field is never updated again.

### 3. Update Reset Password handler in StudentsManagement
Change `handleResetPassword` to use `original_password` instead of `password_display`. Update the Student interface, the fetch query, and the UI to show the original password in the reset confirmation dialog.

### 4. Keep `password_display` sync in ResetPassword.tsx
Leave the existing sync as-is — it serves the purpose of showing the *current* password to superadmins. The reset button will now use `original_password` instead.

## Files to Change

| File | Change |
|------|--------|
| Migration SQL | Add `original_password` column, backfill from `password_display` |
| `supabase/functions/create-enhanced-student/index.ts` | Set `original_password` alongside `password_display` on creation |
| `src/components/superadmin/StudentsManagement.tsx` | Add `original_password` to Student interface, fetch query, and use it in `handleResetPassword` + dialog text |
| `src/components/admin/StudentManagement.tsx` | Same changes if reset password exists there |
| `src/integrations/supabase/types.ts` | Add `original_password` to users type |

