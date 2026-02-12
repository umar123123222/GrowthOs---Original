

# Fix: Password Reset from Student Management Portal

## Problem

The current password reset code tries to call `admin-reset-password` first, with a `try/catch` fallback to `update-student-details`. However, `supabase.functions.invoke()` does **not throw exceptions** on failure -- it returns errors in the `{ data, error }` response object. This means the fallback in the `catch` block never executes, and the first call silently fails.

Additionally, the `admin-reset-password` function may not be deployed yet, causing a "Failed to send request" error.

## Solution

Rewrite `handleResetPassword` in `StudentsManagement.tsx` to use proper error-checking (not try/catch) for the fallback logic:

1. Call `admin-reset-password` first
2. Check if the response has an error (using `if` checks, not `catch`)
3. If it fails, fall back to `update-student-details` with the full payload
4. Also fall back to `reset-student-password` as a third option

This ensures at least one of the three deployed functions handles the password reset.

## Technical Details

**File: `src/components/superadmin/StudentsManagement.tsx`**

Replace the `handleResetPassword` function (lines 642-689) with:

```typescript
const handleResetPassword = async (studentId: string, studentName: string, storedPassword: string, studentEmail?: string) => {
  if (!storedPassword) {
    toast({ title: 'Error', description: 'No stored password found for this student', variant: 'destructive' });
    return;
  }

  try {
    console.log('Resetting auth password for:', studentId);

    // Attempt 1: dedicated admin-reset-password function
    let result = await supabase.functions.invoke('admin-reset-password', {
      body: { user_id: studentId, password: storedPassword }
    });

    // Attempt 2: if first failed, try reset-student-password
    if (result.error || result.data?.error) {
      console.log('admin-reset-password failed, trying reset-student-password...');
      result = await supabase.functions.invoke('reset-student-password', {
        body: { user_id: studentId, password: storedPassword }
      });
    }

    // Attempt 3: if still failed, try update-student-details
    if (result.error || result.data?.error) {
      console.log('reset-student-password failed, trying update-student-details...');
      result = await supabase.functions.invoke('update-student-details', {
        body: {
          user_id: studentId,
          full_name: studentName,
          email: studentEmail || '',
          reset_password: storedPassword
        }
      });
    }

    console.log('Final reset response:', JSON.stringify(result.data));

    if (result.error) throw result.error;
    if (result.data?.error) throw new Error(result.data.error);

    toast({
      title: 'Password Reset',
      description: `${studentName}'s authentication password has been reset successfully`,
    });
  } catch (error) {
    console.error('All password reset attempts failed:', error);
    toast({
      title: 'Error',
      description: error instanceof Error ? error.message : 'Failed to reset password',
      variant: 'destructive'
    });
  }
};
```

## Why This Will Work

- Uses proper conditional checks (`result.error || result.data?.error`) instead of relying on exceptions
- Tries three different Edge Functions in sequence, so whichever one is actually deployed will handle the request
- All three functions contain the same core logic: `supabaseAdmin.auth.admin.updateUserById(user_id, { password })` which updates the **authentication** password (not just the database field)
- The fallback chain is transparent -- console logs show which function succeeded

## Files to Change

1. **`src/components/superadmin/StudentsManagement.tsx`** -- rewrite `handleResetPassword` with proper fallback chain using conditional checks instead of try/catch

