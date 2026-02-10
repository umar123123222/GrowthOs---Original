

## Show All Scheduled Sessions for Mentor

The Mentor Sessions page currently shows 0 sessions because it relies on an RLS (Row Level Security) policy that may be filtering too aggressively. The fix is to explicitly query sessions assigned to the logged-in mentor by matching the `mentor_id` column.

### What changes

**File**: `src/components/mentor/MentorSessions.tsx`

1. **Update the query** (line 49-52): Instead of relying solely on RLS, explicitly filter by `mentor_id` equal to the current user's ID. This ensures all sessions where the mentor is the host appear, whether or not they have Zoom details configured.

2. **Remove the "upcoming only" filter for scheduled sessions**: Currently, `processSessions` splits by date into upcoming vs completed. The upcoming section will show all sessions with `start_time >= today`, and completed will show past ones -- no changes needed there.

3. **Add a visual indicator for incomplete sessions**: Sessions missing Zoom details (meeting ID, passcode, or link) will get a "Needs Setup" warning badge so the mentor knows which sessions still need configuration by the admin.

### Technical Details

- Change query from:
  ```ts
  supabase.from('success_sessions').select('*').order(...)
  ```
  to:
  ```ts
  supabase.from('success_sessions').select('*').eq('mentor_id', user.id).order(...)
  ```

- Add a "Needs Setup" badge on sessions where `zoom_meeting_id`, `zoom_passcode`, or `link` are empty, so the mentor can see which sessions aren't fully configured yet.

