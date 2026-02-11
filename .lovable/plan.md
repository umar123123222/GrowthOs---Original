

# Fix: Reset Student Password Edge Function

## Root Cause

The `reset-student-password` Edge Function is configured with `verify_jwt = true` in `supabase/config.toml`. With Supabase's signing-keys system, this setting causes the request to be rejected at the infrastructure level *before* the function code executes. That is why the error message (`"Missing required fields"`) does not match any code path in the new function -- an older cached version or gateway rejection is responding instead.

## Solution

Two changes are needed:

### 1. Set `verify_jwt = false` in `supabase/config.toml`

Change the configuration so the request reaches the function code, which already performs its own authorization (checks the caller is superadmin/admin).

```toml
[functions.reset-student-password]
verify_jwt = false
```

### 2. Add version logging to `reset-student-password/index.ts`

Add a version constant and include it in all responses. This confirms the correct version of the function is deployed and running.

- Log the version on every request
- Include `_version` in the JSON response body
- This ensures we can verify the deployed code matches expectations

## Technical Details

- **File 1**: `supabase/config.toml` -- change `verify_jwt` from `true` to `false`
- **File 2**: `supabase/functions/reset-student-password/index.ts` -- add version logging constant and include in responses

The function's internal auth logic (checking Authorization header, verifying user role) remains unchanged and provides the necessary security.

