

# Fix: Forgot Password Link Not Working

## Problem

The reset password email is being sent successfully (as shown in the screenshot), but when the user clicks the "Reset Password" link in the email, the flow breaks. This is caused by two issues:

1. **Supabase Redirect URL not whitelisted**: Supabase requires the app's URL to be listed in its "Redirect URLs" configuration. Without this, the password reset link silently fails to redirect back to the app.

2. **Inconsistent redirect URL**: The code uses `window.location.origin` which changes depending on whether the user is on the preview URL vs the published URL, potentially causing mismatches.

## Solution

### Step 1: Supabase Dashboard Configuration (Manual - Required)

You need to add your published URL to the Supabase project's allowed redirect URLs:

1. Go to **Supabase Dashboard** > your project (`majqoqagohicjigmsilu`)
2. Navigate to **Authentication** > **URL Configuration**
3. Set **Site URL** to: `https://growthos-final.lovable.app`
4. Under **Redirect URLs**, add:
   - `https://growthos-final.lovable.app/reset-password`
   - `https://growthos-final.lovable.app/**`
   - Any other domains where the app is hosted

Without this step, Supabase will refuse to redirect users back to your app after they click the email link.

### Step 2: Code Fix - Use Published URL for Redirect

Update the `redirectTo` in `ResetPassword.tsx` to prefer the published/configured site URL over `window.location.origin`, and add a `VITE_SITE_URL` environment variable pointing to the published domain.

**File: `.env`**
- Add `VITE_SITE_URL=https://growthos-final.lovable.app`

**File: `src/pages/ResetPassword.tsx`**
- Import `ENV_CONFIG` from env-config
- Change `redirectTo` from `window.location.origin` to use `ENV_CONFIG.SITE_URL` with a fallback to `window.location.origin`
- Add console logging when code exchange fails so issues are visible in the browser console

### Technical Details

```text
Current code (line 127):
  redirectTo: `${window.location.origin}/reset-password`

Updated code:
  const siteUrl = ENV_CONFIG.SITE_URL || window.location.origin;
  redirectTo: `${siteUrl}/reset-password`
```

This ensures the redirect URL always matches what's configured in Supabase, regardless of whether the user initiated the reset from the preview or published domain.

## Files to Change

1. **`.env`** -- Add `VITE_SITE_URL=https://growthos-final.lovable.app`
2. **`src/pages/ResetPassword.tsx`** -- Import `ENV_CONFIG`, use `ENV_CONFIG.SITE_URL` for `redirectTo`, add debug logging

## Important Note

The **Supabase Dashboard configuration (Step 1) is critical** and must be done manually by you. The code changes alone will not fix the issue if the URL is not whitelisted in Supabase.

