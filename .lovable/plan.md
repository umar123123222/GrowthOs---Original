
Root cause confirmed from your logs: reminder emails fail before sending because PDF generation throws `Deno.lstatSync is blocklisted` in the Edge runtime. Since the email send call happens after PDF generation, neither student email nor CC is sent.

Implementation plan:

1. Stabilize reminder email sending (main fix)
- File: `supabase/functions/installment-reminder-scheduler/index.ts`
- Refactor all 4 billing email paths (issued, first reminder, second reminder, due) to:
  - Attempt PDF generation in a safe `try/catch`
  - If PDF fails, continue sending the same email without attachment
  - Always apply `BILLING_EMAIL_CC` when configured
- This removes PDF as a hard blocker for delivery.

2. Remove silent failure behavior
- File: `supabase/functions/installment-reminder-scheduler/index.ts`
- Stop swallowing send failures inside helper functions.
- Return/send explicit success/failure to scheduler loop so logs accurately show delivery outcomes.
- Add structured logs per invoice: sent with attachment / sent without attachment / failed send.

3. Fix reminder state ordering (so retries remain possible)
- File: `supabase/functions/installment-reminder-scheduler/index.ts`
- For first/second reminders:
  - Send email first
  - Only then mark `first_reminder_sent` / `second_reminder_sent`
- If sending fails, keep flags false so next scheduler run can retry naturally.

4. Keep billing workflow intact
- Keep due-status transitions, LMS suspension, and in-app notifications as-is.
- Email failure should not block financial enforcement, but should now be clearly logged and retriable where applicable.

5. Validation after deployment
- Redeploy `installment-reminder-scheduler`.
- Trigger a test run and verify:
  - Email reaches student inbox
  - Billing CC receives copy
  - If PDF fails, email still sends (without attachment) and log explicitly states fallback mode.

Optional hardening right after this fix:
- Add a lightweight “email_send_errors” DB log insert for failed sends to make monitoring visible in-app (not only in Edge logs).
