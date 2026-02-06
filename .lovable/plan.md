
# Amend Email Client to Support Both SMTP and Resend

## Overview
Instead of replacing the existing SMTP setup, we'll modify the shared email client so it **automatically detects** which provider to use based on which secrets are configured. If `RESEND_API_KEY` is present, it uses Resend. Otherwise, it falls back to the existing SMTP secrets. This gives you flexibility -- you can use either provider without changing any code.

## How It Will Work

- If `RESEND_API_KEY` secret is set --> emails are sent via Resend API
- If `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` secrets are set --> emails are sent via the existing SMTP logic
- If both are set --> Resend takes priority (more reliable), SMTP is the fallback
- If neither is set --> error is thrown (same as today)

No other Edge Functions need to change. They all call `SMTPClient.fromEnv()` and `.sendEmail()` the same way.

## What You Need to Do First

1. Go to https://resend.com and sign up (free -- 100 emails/day)
2. Verify your sending domain at https://resend.com/domains (add the DNS records they provide)
3. Generate an API key at https://resend.com/api-keys
4. Add the secret `RESEND_API_KEY` in your Supabase Dashboard under **Settings > Edge Functions > Secrets**

You can keep your existing SMTP secrets in place as a fallback.

## Technical Changes

### 1. Amend `supabase/functions/_shared/smtp-client.ts`

Add a Resend-based sending path alongside the existing SMTP code:

- Import `Resend` from `npm:resend@2.0.0`
- Add a private `resendApiKey` field and a `useResend` flag to the class
- Modify `fromEnv()` to check for `RESEND_API_KEY` first, then fall back to SMTP secrets
- Add a private `sendViaResend()` method that uses the Resend API (supports HTML, CC, and attachments)
- Modify `sendEmail()` to route to `sendViaResend()` when Resend is configured, otherwise use the existing SMTP logic (untouched)

The existing SMTP code (the full TCP/TLS conversation) stays exactly as-is -- it just becomes one of two possible paths.

### 2. Update `supabase/functions/process-email-queue/index.ts`

This function currently simulates sending (it just marks emails as "sent" without actually sending them). We'll wire it up to actually send:

- Import and use `SMTPClient.fromEnv()` (which will auto-detect Resend or SMTP)
- Replace the simulated delay with a real `.sendEmail()` call using the queued email's recipient, subject, and HTML content
- Keep all the existing retry logic and error handling intact

### 3. Functions That Need Zero Changes

These 5 functions already use `SMTPClient.fromEnv()` and `.sendEmail()`, so they'll automatically benefit from the Resend option without any code modifications:

- `create-enhanced-student` (welcome emails and first invoice)
- `create-enhanced-team-member` (welcome emails)
- `update-student-details` (credential update emails)
- `installment-reminder-scheduler` (billing reminders, overdue notices with PDF attachments)
- `send-batch-content-notification` (content drip notifications)

### Required Secret

| Secret | Value | Where to Add |
|--------|-------|--------------|
| `RESEND_API_KEY` | Your Resend API key (starts with `re_...`) | Supabase Dashboard > Settings > Edge Functions > Secrets |

### Supabase Auth Emails (Separate Configuration)

For magic links and password resets (the error you saw earlier), you still need to configure SMTP in the Supabase Dashboard under **Authentication > Email Templates > SMTP Settings**. Resend works there too:

- **Host**: `smtp.resend.com`
- **Port**: `587`
- **Username**: `resend`
- **Password**: Your Resend API key (`re_...`)
- **Sender email**: Must be from your verified domain
