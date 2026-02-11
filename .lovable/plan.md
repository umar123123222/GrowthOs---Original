

# Fix: Password Reset - Dual Approach

## Root Cause

The `update-student-details` Edge Function has `verify_jwt = true` in `config.toml`. With Supabase's signing-keys system, this prevents the latest code (which includes the `reset_password` handler) from being served. The deployed version lacks the password reset logic and falls through to the `if (!full_name || !email)` check, which fails because the frontend sends an empty string for email.

## Solution: Two Changes

### 1. Set `verify_jwt = false` for `update-student-details` in `config.toml`

This is needed regardless of the password reset issue -- it aligns with the signing-keys system and may trigger a proper redeployment of the function.

```toml
[functions.update-student-details]
verify_jwt = false
```

The function already has its own internal authorization (checks caller is superadmin/admin), so security is maintained.

### 2. Switch frontend to use the dedicated `reset-student-password` function

Since `reset-student-password` already has `verify_jwt = false` and contains clean, focused password-reset code, the frontend should call it directly instead of piggybacking on the general `update-student-details` function.

In `src/components/superadmin/StudentsManagement.tsx`, update `handleResetPassword` to call:

```typescript
const { data, error } = await supabase.functions.invoke('reset-student-password', {
  body: { user_id: studentId, password: storedPassword }
});
```

This is a simpler, more reliable call -- it only needs `user_id` and `password`, avoiding any issues with missing `full_name` or `email` fields.

## Why This Will Work

- The `reset-student-password` function has had `verify_jwt = false` since the earlier fix, so the infrastructure will not block requests
- The function code is simple and focused -- it validates auth internally, then calls `supabaseAdmin.auth.admin.updateUserById()` to set the password
- Changing `update-student-details` to `verify_jwt = false` fixes it for all future operations too

## Files to Change

1. **`supabase/config.toml`** -- set `verify_jwt = false` for `update-student-details`
2. **`src/components/superadmin/StudentsManagement.tsx`** -- switch `handleResetPassword` to invoke `reset-student-password` with just `user_id` and `password`

