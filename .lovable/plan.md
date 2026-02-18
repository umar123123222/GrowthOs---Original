

## Fix Mentor Dashboard: Unknown Names, Incorrect LMS Status, and Enrollment Type

### Root Cause Analysis

Three issues are causing incorrect data in the mentor dashboard:

1. **"Unknown" names**: The `get-user-details` Edge Function was created but **never registered** in `supabase/config.toml`. Without registration, the function call fails silently ("Failed to fetch"), so no user data is returned and all names default to "Unknown".

2. **"Inactive" LMS status**: Because the Edge Function fails, the user data map is empty. The code falls back to `userInfo?.lms_status || 'inactive'`, making every student appear as "Inactive".

3. **"Affiliate" enrollment type**: Many enrollment records have a `pathway_id` value set even when no meaningful pathway association exists. The current check `!!enrollment.pathway_id` triggers too broadly, incorrectly labeling students as "Affiliate" instead of "Direct".

The admin dashboard works fine because admin/superadmin users have RLS policies allowing direct access to the `users` table.

### Fix Plan

#### Step 1: Register the Edge Function
Add `get-user-details` to `supabase/config.toml` so it gets deployed and is callable. It will use `verify_jwt = true` since it already validates the caller's auth token internally.

#### Step 2: Add error handling with fallback
Update the Edge Function call in `MentorStudents.tsx` to log errors visibly when the function fails, so issues are easier to diagnose in the future.

#### Step 3: Strengthen enrollment type logic
Tighten the "pathway" detection to require both a non-null `pathway_id` AND a valid `learning_pathways` record with a non-empty `name`. This ensures enrollment type defaults to "Direct" unless there's a genuine pathway association.

### Technical Details

**File changes:**

1. **`supabase/config.toml`** -- Add:
```toml
[functions.get-user-details]
verify_jwt = true
```

2. **`src/components/mentor/MentorStudents.tsx`** -- Add console error logging when edge function fails, so the mentor dashboard shows a warning toast if data couldn't be loaded. Also ensure the `hasPathway` check remains strict (already correct in current code, just needs the function to work).

### Expected Outcome
Once the Edge Function is registered and deployed, the mentor dashboard will:
- Show actual student names from the `users` table
- Display correct LMS statuses (active, inactive, suspended, etc.) from the database
- Default enrollment type to "Direct" unless a genuine pathway exists

