

## Fix Enrollment Type: Default to "Direct", Show "Your Affiliate" Only for Mentor-Created Students

### Problem
Currently, the enrollment type column shows "Affiliate" for every student who has a `pathway_id` in their enrollment record. This is incorrect -- most students enrolled via pathways are not affiliates.

The correct logic: A student should show as **"Your Affiliate"** only when **the logged-in mentor created that student** (i.e., `users.created_by === current_mentor_id`). All other students should default to **"Direct"**.

### Changes

#### 1. Update `get-user-details` Edge Function to return `created_by`
**File:** `supabase/functions/get-user-details/index.ts`

Add `created_by` to the SELECT query so the mentor dashboard can determine who created each student:
```
.select("id, full_name, lms_status, created_at, created_by")
```

#### 2. Update MentorStudents enrollment type logic
**File:** `src/components/mentor/MentorStudents.tsx`

- Change the `enrollment_type` field type from `'direct' | 'pathway'` to `'direct' | 'affiliate'`
- Store `created_by` from the user data map
- Set `enrollment_type` to `'affiliate'` only when `userInfo.created_by === current_mentor_id`
- Otherwise default to `'direct'`
- Update the display label from "Affiliate" to "Your Affiliate"
- Update the filter dropdown to use the new value

#### 3. Update filter values
- Change filter option value from `'pathway'` to `'affiliate'`
- Display label remains "Affiliate" in filter, "Your Affiliate" in the table badge

### Expected Result
- All students default to showing **"Direct"** enrollment type
- Only students whose `created_by` matches the logged-in mentor show **"Your Affiliate"**
- Filter still works correctly with the updated values
