
# Fix Missing Edge Function Registrations in config.toml

## Problem
18 Edge Functions exist in the codebase but are not registered in `supabase/config.toml`. Without registration, Supabase returns **404 Not Found** when any of them are invoked. This directly caused:
- The `delete-user-with-role` 404 error you reported
- Potential failures in other unregistered functions like `process-email-queue`, `create-user-with-role`, `update-student-details`, etc.

## Solution
Add all 18 missing functions to `supabase/config.toml` with the correct JWT verification settings.

## Technical Details

### Changes to `supabase/config.toml`

Add the following entries. Functions that require an authenticated user (create, delete, update operations) will have `verify_jwt = true`. Background/scheduled/webhook functions will have `verify_jwt = false`.

| Function | verify_jwt | Reason |
|---|---|---|
| `delete-user-with-role` | `false` | Validates auth in code (line 20-31) |
| `create-enhanced-team-member` | `true` | Requires authenticated admin |
| `create-student-v2` | `true` | Requires authenticated admin |
| `create-team-member` | `true` | Requires authenticated admin |
| `create-user-with-role` | `false` | Supports bootstrap (first user) |
| `cleanup-inactive-students` | `false` | Background/cron job |
| `encrypt-token` | `true` | Requires authenticated user |
| `mark-invoice-paid` | `true` | Requires authenticated admin |
| `motivational-notifications` | `false` | Background/cron job |
| `notification-scheduler` | `false` | Background/cron job |
| `process-email-queue` | `false` | Background/cron job |
| `process-onboarding-jobs` | `false` | Background/cron job |
| `secure-encrypt-token` | `true` | Requires authenticated user |
| `secure-user-creation` | `true` | Requires authenticated admin |
| `update-student-details` | `true` | Requires authenticated admin |
| `validate-shopify` | `true` | Requires authenticated user |
| `sync-shopify-metrics` | `false` | Background/cron job |
| `whoami` | `true` | Returns current user info |

### Important Note About Email Delivery
This fix ensures functions are deployed and reachable (no more 404 errors). However, for emails to actually send, you still need to add the `RESEND_API_KEY` secret to your Supabase Edge Function secrets as discussed earlier. The code changes we made to `smtp-client.ts` are ready -- they just need the API key to work.
