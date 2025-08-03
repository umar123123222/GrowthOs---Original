# Admin Logs FK Constraint Fix

## Problem
The `admin_logs.performed_by` column had a strict NOT NULL FK constraint to `auth.users(id)`. When Supabase's service role (UUID `00000000-0000-0000-0000-000000000000`) deleted users, the audit trigger attempted to log this UUID, causing FK violations since it doesn't exist in `auth.users`.

## Solution
- Made `performed_by` nullable with `ON DELETE SET NULL` FK constraint
- Updated `handle_auth_user_deleted()` trigger to skip logging for service role deletions
- Preserves audit trail for real admin actions while preventing FK errors

## Extending for New System Actors
To add more system UUIDs that should skip logging:
```sql
IF current_setting('request.jwt.claim.sub', true) IN (
  '00000000-0000-0000-0000-000000000000',  -- service role
  'new-system-uuid-here'                    -- new system actor
) THEN
  RETURN OLD;
END IF;
```

## Testing
Run `supabase test` to verify functionality. Tests cover normal user deletion audit logging and service role deletion success.

## Rollback
Use the down migration to restore original behavior if needed.