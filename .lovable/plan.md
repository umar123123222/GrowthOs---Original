
# Fix Silent Email Failures in Student Creation

## Root Cause

The `create-enhanced-student` Edge Function sends emails using `EdgeRuntime.waitUntil()` (line 736), which runs in the background **after** the response is already returned. This means:

- If email secrets are missing or incorrect, the error is silently logged and never surfaces to the frontend
- The student creation always shows "Success!" even when the email completely fails
- You have no visibility into what went wrong

## The Fix

### 1. Move Welcome Email Sending Inline (Before Response)

**File:** `supabase/functions/create-enhanced-student/index.ts`

Instead of sending the welcome email in `EdgeRuntime.waitUntil()`, send it **before** returning the response. This way:

- If secrets are missing, the error is caught and reported
- If the Resend API rejects the email (unverified domain, bad API key), we know immediately
- The response will include `email_sent: true/false` so the UI can show the right message

The invoice email (less critical) will stay in the background.

Changes:
- Add email configuration validation at the start of `sendEmailsInBackground` with detailed logging of which secrets are available
- Move the welcome email sending **inline** (before the response is returned)
- Add `email_sent` and `email_error` fields to the response so the frontend knows the status
- Keep the invoice email in the background (non-critical, can be retried)
- Add a try/catch around `SMTPClient.fromEnv()` with a clear error message listing which secrets are missing

### 2. Update Frontend Hook to Show Email Status

**File:** `src/hooks/useEnhancedStudentCreation.ts`

Update the success toast message to reflect whether the email was actually sent:
- If `email_sent: true` -- show "Student created successfully! Welcome email sent."
- If `email_sent: false` -- show "Student created successfully, but the welcome email could not be sent. Please check email configuration."

### 3. Add Secret Diagnostic Logging

At the top of the `create-enhanced-student` handler function, add logging that checks which email secrets are available (without logging the actual values). This will appear in Supabase Edge Function logs so you can verify the configuration:

```
Email config check: {
  RESEND_API_KEY: configured,
  SMTP_FROM_EMAIL: configured,
  SMTP_FROM_NAME: configured,
  SMTP_HOST: not set,
  provider: "resend"
}
```

## Technical Details

### Changes to `create-enhanced-student/index.ts`

1. After line 88 ("Enhanced student creation started"), add email secret diagnostic logging
2. Replace lines 639-736: Move the `SMTPClient.fromEnv()` and welcome email call out of `EdgeRuntime.waitUntil()` and into the main handler flow
3. Add `email_sent` and `email_error` fields to the response object (lines 738-753)
4. Keep only the invoice email in `EdgeRuntime.waitUntil()`

### Changes to `useEnhancedStudentCreation.ts`

1. Update the success toast (around line 95) to conditionally show email delivery status based on `data.email_sent`

### No Other Functions Need Changes

The `smtp-client.ts` and other Edge Functions remain unchanged. This fix is specific to how `create-enhanced-student` calls the email client.
