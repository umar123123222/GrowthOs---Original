
# Fix "Invalid from field" Email Error

## Root Cause

The error `550 Invalid 'from' field` is coming from Resend's SMTP relay server. Your system is using the **SMTP path** (not the Resend API), which means either:

- `RESEND_API_KEY` is not set in Edge Function Secrets (only in Auth SMTP settings, which is a separate config), OR
- `SMTP_FROM_EMAIL` contains a display name like `Growth OS <noreply@domain.com>` instead of just the plain email address `noreply@domain.com`

In the SMTP code, the sender is sent as `MAIL FROM:<your-from-email-value>`. If the value already includes angle brackets or a name, it becomes malformed: `MAIL FROM:<Growth OS <noreply@domain.com>>` — which Resend rejects.

## The Fix (Two Parts)

### Part 1: Configuration Check (No Code Change)

Please verify these in your **Supabase Dashboard > Settings > Edge Functions > Secrets**:

| Secret | Correct Value | Common Mistake |
|--------|--------------|----------------|
| `RESEND_API_KEY` | `re_xxxxxxxxx` | Not set in Edge Function secrets (only set in Auth SMTP) |
| `SMTP_FROM_EMAIL` | `noreply@yourdomain.com` | `Growth OS <noreply@yourdomain.com>` (name included) |

**Important distinction:** Auth SMTP settings (under Authentication > SMTP) and Edge Function secrets are completely separate configurations. The SMTP settings you configured for password resets do NOT automatically apply to Edge Functions.

### Part 2: Code Fix — Make SMTP Path Robust

Even after fixing the configuration, we should make the code defensive so this error can never happen again.

**File:** `supabase/functions/_shared/smtp-client.ts`

Add a `sanitizeEmail()` helper method to the `SMTPClient` class that extracts just the email address from any format:
- `noreply@domain.com` stays as-is
- `Name <noreply@domain.com>` extracts `noreply@domain.com`
- `<noreply@domain.com>` extracts `noreply@domain.com`

Apply this sanitization in two places:
1. In `fromEnv()` — sanitize the `SMTP_FROM_EMAIL` value when reading it from environment
2. In the `sendViaSMTP()` method — sanitize `config.fromEmail` before using it in `MAIL FROM` command (line 255)

This ensures that no matter how the user sets `SMTP_FROM_EMAIL`, the SMTP conversation always uses a clean email address while the display name is preserved separately for email headers.

### Technical Details

Changes to `smtp-client.ts`:

```text
1. Add static helper: sanitizeEmail(value: string): string
   - Regex extracts email from "Name <email>" or "<email>" format
   - Falls back to trimmed input if no angle brackets found
   - Validates result contains @ symbol, throws descriptive error if not

2. In fromEnv() (around line 53):
   - After reading SMTP_FROM_EMAIL, run it through sanitizeEmail()
   - Log the sanitized value for debugging

3. In sendViaSMTP() (line 255):
   - Use sanitized fromEmail in MAIL FROM command (defensive)
```

No changes needed to any other files. The `sendViaResend()` path already formats the from field correctly.
