# User Deletion Fix Documentation

## Overview
Fixed the 500 "Database error deleting user" when deleting users from `auth.users` via service role operations.

## Root Cause
The audit trigger `log_user_deletions()` attempted to write to `admin_logs` with `performed_by` set to the service role UUID (`00000000-0000-0000-0000-000000000000`). The original foreign key constraint required a valid `auth.users.id`, causing deletions to fail.

## Solution
1. **Relaxed FK Constraint**: Made `admin_logs.performed_by` nullable with `ON DELETE SET NULL`
2. **Enhanced Trigger**: Added service role detection to set `performed_by = NULL` for system operations
3. **Maintained Audit Trail**: Service role deletions are still logged with clear identification

## Extension
To add more system actors, modify the trigger condition to include additional service UUIDs or implement a system users lookup table.