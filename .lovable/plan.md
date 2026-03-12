

# Batch-Based Invoice Scheduling

## What Changes

### 1. Invoice generation in `create-enhanced-student/index.ts`
When a student is assigned to a batch, the 2nd+ installments should use the **batch start date** as the anchor instead of the current date:
- **1st installment**: Issued immediately (status: `pending`) — no change
- **2nd installment**: Issue date = batch start date + 27 days, due date = issue date + 5 days (status: `scheduled`)
- **3rd+ installments**: Each subsequent installment adds another 27 days from the batch start date

Currently the code at lines 632-648 calculates dates from `new Date()` using `invoice_send_gap_days`. The change: if `batch_id` is provided and `batchData.start_date` exists, use `batchStartDate + (i-1) * 27 days` as the issue date for installment `i >= 2`, with `due_date = issueDate + 5 days`.

### 2. Scheduler transition logic in `installment-reminder-scheduler/index.ts`
The scheduler currently checks `scheduled` invoices using `created_at <= today` (line 49) to transition them to `pending`. This is wrong for batch-based scheduling because `created_at` is always the creation timestamp.

**Fix**: Add an `issue_date` column to `invoices` table via migration. When present, the scheduler checks `issue_date <= today` instead of `created_at`. For non-batch invoices, `issue_date` defaults to `created_at`.

### 3. Auto-suspension with activity log
The scheduler already suspends LMS on overdue (lines 120-153). Need to also add an entry to `user_activity_logs` with `activity_type: 'lms_suspended'` and metadata noting `"Auto-suspended due to non-payment of fees"`.

### 4. CC on invoice emails
The `BILLING_EMAIL_CC` secret is already used in the email functions (line 267, 348). No changes needed here — already implemented.

---

## Files to Change

| File | Change |
|------|--------|
| **Migration** | Add `issue_date` column to `invoices` table (nullable, defaults to `created_at`) |
| `supabase/functions/create-enhanced-student/index.ts` | Use batch start date + 27 days for 2nd+ installment issue dates; set `issue_date` field |
| `supabase/functions/installment-reminder-scheduler/index.ts` | Use `issue_date` instead of `created_at` for scheduled→pending transition; add `user_activity_logs` entry on suspension |
| `src/integrations/supabase/types.ts` | Add `issue_date` to invoices type |
| `src/lib/invoice-generator.ts` | Support `batchStartDate` parameter for batch-aware invoice generation |

## Key Logic

```text
Batch student with 3 installments:
  Inst 1: issue now,              due = now + 5 days
  Inst 2: issue batch_start + 27, due = batch_start + 32
  Inst 3: issue batch_start + 54, due = batch_start + 59

Scheduler daily check:
  IF invoice.status == 'scheduled' AND invoice.issue_date <= today:
    → set status = 'pending', send issue email (CC: BILLING_EMAIL_CC)
  
  IF invoice.status == 'pending' AND today >= due_date:
    → set status = 'due', suspend LMS
    → insert user_activity_logs: "Auto-suspended due to non-payment of fees"
    → insert admin_logs (already exists)
```

