

## Batch Content Notification System

This plan implements automated email notifications to students enrolled in a batch whenever:
- A **recording** is dropped/unlocked (based on drip date)
- An **assignment** is deployed/unlocked  
- A **live session** is scheduled

---

### Overview

When content becomes available for a batch (either immediately upon creation or when a drip date arrives), all students enrolled in that batch will receive a custom email notification informing them about the new content.

---

### Implementation Components

#### 1. New Edge Function: `send-batch-content-notification`

A dedicated edge function that:
- Accepts batch_id, content type (recording/assignment/live_session), and item details
- Fetches all students enrolled in the batch via `course_enrollments`
- Sends personalized emails to each student using the existing SMTP client
- Logs notifications to the `notifications` table for in-app display
- Uses the existing CC functionality (`NOTIFICATION_EMAIL_CC` secret)

**Email Templates:**
- **Recording Unlocked**: "New Recording Available: {title}"
- **Assignment Available**: "New Assignment: {name} - Due in {days} days"
- **Live Session Scheduled**: "Live Session Scheduled: {title} on {date}"

---

#### 2. Database: Add Tracking Column

Add a column to `batch_timeline_items` to track notification status:

```text
notification_sent_at: timestamp (nullable)
```

This prevents duplicate notifications if the scheduler runs multiple times.

---

#### 3. New Edge Function: `batch-content-drip-processor`

A scheduled function (runs daily or hourly) that:
- Checks `batch_timeline_items` for content that has reached its drip date
- Filters items where `notification_sent_at IS NULL`
- Calculates the deploy date: `batch.start_date + drip_offset_days`
- For each item where deploy date is today or in the past:
  - Calls `send-batch-content-notification`
  - Updates `notification_sent_at`

---

#### 4. Immediate Notification on Creation (Optional Enhancement)

When creating timeline items with `drip_offset_days = 0`:
- Trigger notification immediately after successful insert
- Update the `useBatchTimeline` hook to call the notification function

---

### Technical Details

#### Edge Function: `send-batch-content-notification`

```text
Location: supabase/functions/send-batch-content-notification/index.ts

Input Parameters:
- batch_id: string
- item_type: 'RECORDING' | 'LIVE_SESSION' | 'ASSIGNMENT'
- item_id: string
- title: string
- description?: string
- meeting_link?: string (for live sessions)
- start_datetime?: string (for live sessions)

Process:
1. Validate input
2. Fetch batch details (name, start_date)
3. Query course_enrollments for batch_id → get students
4. Join with users table to get email addresses
5. For each student:
   - Queue email in email_queue OR send directly via SMTP
   - Insert in-app notification
6. Return success/failure counts
```

#### Edge Function: `batch-content-drip-processor`

```text
Location: supabase/functions/batch-content-drip-processor/index.ts

Scheduled via pg_cron (daily at midnight or hourly)

Process:
1. Get all batch_timeline_items where:
   - notification_sent_at IS NULL
   - Has a linked batch with start_date
2. For each item:
   - Calculate deploy_date = batch.start_date + drip_offset_days
   - If deploy_date <= NOW():
     - Call send-batch-content-notification
     - Update notification_sent_at = NOW()
3. Return processed count
```

#### Database Migration

```sql
-- Add notification tracking to batch_timeline_items
ALTER TABLE public.batch_timeline_items
ADD COLUMN notification_sent_at timestamptz;

-- Index for efficient querying by processor
CREATE INDEX idx_batch_timeline_notification_pending 
ON public.batch_timeline_items(notification_sent_at) 
WHERE notification_sent_at IS NULL;
```

---

### Email Templates

**Recording Unlocked:**
```text
Subject: New Recording Available: {title}

Body:
Hi {student_name},

A new recording is now available in your course!

Recording: {title}
{description if available}

Login to start watching now.

[Start Learning Button → LMS URL]
```

**Live Session Scheduled:**
```text
Subject: Live Session Scheduled: {title}

Body:
Hi {student_name},

A live session has been scheduled for your batch!

Session: {title}
Date & Time: {formatted_datetime}
{Meeting link if provided}

Mark your calendar and join on time.

[View Details Button → LMS URL]
```

**Assignment Available:**
```text
Subject: New Assignment Available: {title}

Body:
Hi {student_name},

A new assignment has been unlocked for you!

Assignment: {title}
{description if available}

Complete this before the next recording unlocks.

[View Assignment Button → LMS URL]
```

---

### Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/send-batch-content-notification/index.ts` | Create |
| `supabase/functions/batch-content-drip-processor/index.ts` | Create |
| `supabase/config.toml` | Add function configs |
| `src/hooks/useBatchTimeline.ts` | Modify to trigger notifications on item creation |
| Migration file | Add `notification_sent_at` column |
| `src/integrations/supabase/types.ts` | Auto-updated |

---

### Scheduling Setup

After implementation, a cron job needs to be configured:

```sql
-- Run drip processor every hour
SELECT cron.schedule(
  'batch-content-drip-processor',
  '0 * * * *',  -- Every hour
  $$ SELECT net.http_post(...) $$
);
```

---

### Summary

This implementation provides:
1. Automated email notifications when batch content is deployed
2. Support for recordings, assignments, and live sessions
3. Drip-based scheduling with daily/hourly processing
4. Duplicate prevention via `notification_sent_at` tracking
5. Both email and in-app notifications
6. Reuse of existing SMTP infrastructure and CC functionality

