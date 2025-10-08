# Security Issues and Mitigation Plan

**Status**: 🔴 **CRITICAL** - Multiple high-severity security issues present

**Last Updated**: October 2025

**Risk Level**: HIGH - Do not launch publicly until resolved

---

## Executive Summary

This document details all known security vulnerabilities in the Growth OS system, their potential impact, and remediation steps required before public launch.

**Critical Finding**: The system has 3 critical security vulnerabilities that could lead to credential theft, data breaches, and unauthorized access. These MUST be resolved before public launch.

---

## 🔴 Critical Vulnerabilities (Fix Immediately)

### 1. Password Hash Exposure via RLS Policy

**Severity**: 🔴 **CRITICAL**

**Issue**: Enrollment managers can view `password_hash` and `password_display` fields from the `users` table due to overly permissive RLS policies.

**Location**: `users` table RLS policies

**Current Policy**:
```sql
-- This policy allows enrollment_manager to SELECT all columns including passwords
CREATE POLICY "Enrollment managers can view users"
ON public.users FOR SELECT
USING (get_current_user_role() = 'enrollment_manager');
```

**Impact**:
- Credential theft and account takeover
- Compliance violations (GDPR, HIPAA, SOC 2)
- Reputational damage and loss of user trust
- Potential for mass data breach

**Attack Scenario**:
1. Attacker gains enrollment_manager credentials (phishing, insider threat)
2. Queries `users` table to extract password hashes
3. Runs offline brute-force/rainbow table attacks
4. Gains access to multiple user accounts including admin accounts
5. Complete system compromise

**Remediation**:

```sql
-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Enrollment managers can view users" ON public.users;

-- Create a restricted policy that excludes password fields
CREATE POLICY "Enrollment managers can view users (restricted)"
ON public.users FOR SELECT
USING (
  get_current_user_role() = 'enrollment_manager' 
  AND auth.uid() IS NOT NULL
)
WITH CHECK (false); -- No INSERT/UPDATE via this policy

-- Create a secure view for enrollment managers
CREATE OR REPLACE VIEW public.users_safe_view 
WITH (security_barrier = true) AS
SELECT 
  id,
  email,
  full_name,
  phone,
  role,
  status,
  lms_status,
  created_at,
  updated_at,
  last_active_at
  -- EXCLUDED: password_hash, password_display, is_temp_password
FROM public.users
WHERE get_current_user_role() IN ('enrollment_manager', 'admin', 'superadmin');

-- Grant access to the safe view
GRANT SELECT ON public.users_safe_view TO authenticated;
```

**Verification Steps**:
1. Log in as enrollment_manager
2. Attempt to query `password_hash` field (should be denied)
3. Query `users_safe_view` (should work without password fields)
4. Verify admin/superadmin still have full access

**Priority**: 🔴 **IMMEDIATE** - Fix before any production deployment

---

### 2. Missing RLS Policies on user_security_summary

**Severity**: 🔴 **CRITICAL**

**Issue**: The `user_security_summary` table has RLS enabled but NO policies defined, making it completely inaccessible to all users (or accessible to all with default deny).

**Location**: `user_security_summary` table

**Current State**:
```sql
-- RLS is enabled but no policies exist
ALTER TABLE public.user_security_summary ENABLE ROW LEVEL SECURITY;
-- No CREATE POLICY statements found
```

**Impact**:
- Security metadata completely unprotected
- Any authenticated user may access all security data
- Violation of least privilege principle
- Audit trail compromise

**What data is exposed**:
- User authentication history
- Failed login attempts
- Password change history
- Session information
- Security event logs

**Remediation**:

```sql
-- Add appropriate RLS policies
CREATE POLICY "Superadmins can view all security summaries"
ON public.user_security_summary FOR SELECT
USING (get_current_user_role() = 'superadmin');

CREATE POLICY "Admins can view security summaries"
ON public.user_security_summary FOR SELECT
USING (get_current_user_role() = 'admin');

CREATE POLICY "Users can view own security summary"
ON public.user_security_summary FOR SELECT
USING (auth.uid() = user_id);

-- Restrict INSERT/UPDATE/DELETE to superadmin only
CREATE POLICY "Superadmins can manage security summaries"
ON public.user_security_summary FOR ALL
USING (get_current_user_role() = 'superadmin')
WITH CHECK (get_current_user_role() = 'superadmin');
```

**Verification Steps**:
1. Query as student → should see only own record
2. Query as admin → should see all records
3. Attempt UPDATE as mentor → should be denied
4. Verify logging of all access attempts

**Priority**: 🔴 **IMMEDIATE**

---

### 3. Hardcoded Credentials in Source Code

**Severity**: 🔴 **CRITICAL**

**Issue**: Supabase project URL and anon key are hardcoded in `src/lib/env-config.ts` instead of using environment variables exclusively.

**Location**: `src/lib/env-config.ts` lines 4-6

**Current Code**:
```typescript
export const supabaseUrl = 'https://majqoqagohicjigmsilu.supabase.co';
export const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

**Impact**:
- Credentials visible in Git history (even if later changed)
- Exposed in client-side JavaScript bundles
- Cannot rotate credentials without code deployment
- Violates security best practices
- Makes multi-tenant deployment impossible

**Attack Vectors**:
- Git history mining for old credentials
- Source code inspection via browser DevTools
- Automated credential scanning bots
- Insider threats with code access

**Remediation**:

```typescript
// src/lib/env-config.ts
// BEFORE (INSECURE):
export const supabaseUrl = 'https://majqoqagohicjigmsilu.supabase.co';
export const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

// AFTER (SECURE):
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validation
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing required Supabase configuration. Check your .env file.');
}
```

**Additional Steps**:
1. Remove hardcoded values from all files
2. Update `.env.example` with placeholder values
3. Rotate Supabase anon key (old key is now compromised by Git history)
4. Search entire codebase for other hardcoded secrets: `grep -r "eyJhbGci" .`
5. Add pre-commit hook to prevent future hardcoded secrets

**Verification Steps**:
1. Search codebase for hardcoded URLs/keys: `git grep "supabase.co"`
2. Verify all credentials come from environment variables
3. Test build with missing env vars (should fail with helpful error)
4. Rotate Supabase keys after fixing

**Priority**: 🔴 **IMMEDIATE** - Fix before any Git push

---

## 🟠 High Severity Issues (Fix Before Launch)

### 4. Overly Permissive company_settings Access

**Severity**: 🟠 **HIGH**

**Issue**: `company_settings` table is readable by all authenticated users (should be admin+ only).

**Current Policy**:
```sql
CREATE POLICY "Anyone can view company settings"
ON public.company_settings FOR SELECT
USING (true); -- This allows all authenticated users
```

**Impact**:
- Configuration data exposed to students and mentors
- Branding secrets potentially visible
- Internal settings leaked to non-admin users

**Remediation**:
```sql
DROP POLICY IF EXISTS "Anyone can view company settings" ON public.company_settings;

CREATE POLICY "Admins can view company settings"
ON public.company_settings FOR SELECT
USING (get_current_user_role() IN ('admin', 'superadmin'));
```

**Priority**: 🟠 **Before Launch**

---

### 5. Console Logging in Production

**Severity**: 🟠 **HIGH**

**Issue**: 253 console.log/error/warn statements across 81 files expose sensitive data in browser console.

**Affected Files** (Top offenders):
- `src/components/ConnectAccountsDialog.tsx` - 20 statements
- `src/components/StudentDashboard.tsx` - 15 statements  
- `src/components/Layout.tsx` - 12 statements
- `src/pages/ShopifyDashboard.tsx` - 10 statements
- `src/components/ErrorBoundary.tsx` - 8 statements

**Impact**:
- Sensitive data visible in browser console (emails, IDs, tokens)
- Error details exposed to users
- Performance overhead in production
- Harder to debug actual issues due to noise

**Examples of Sensitive Logging**:
```typescript
// INSECURE - Logs user data
console.log("User data:", user); // May contain email, phone, etc.

// INSECURE - Logs error with sensitive context
console.error("API error:", error, { userId, apiKey });

// INSECURE - Logs database query results
console.log("Query results:", students); // Contains PII
```

**Remediation**:

1. **Remove all console statements** from production code
2. **Implement proper logging service** (Sentry, LogRocket, Datadog)
3. **Use build-time stripping** to remove console calls

```typescript
// Install build-time console removal
npm install --save-dev babel-plugin-transform-remove-console

// vite.config.ts
export default defineConfig({
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove all console calls in production
        drop_debugger: true
      }
    }
  }
});
```

4. **Replace with secure logging**:
```typescript
// Use environment-aware logging
import { logger } from '@/lib/logger';

// Only logs in development
logger.debug("User data", { userId: user.id }); // Doesn't log PII

// Always logs errors to service
logger.error("API error", { error, context: sanitized });
```

**Priority**: 🟠 **Before Launch**

---

### 6. Insecure LocalStorage Usage

**Severity**: 🟠 **HIGH**

**Issue**: Sensitive data stored in localStorage without encryption, vulnerable to XSS attacks.

**Affected Data**:
```typescript
// INSECURE
localStorage.setItem('shopifyDomain', domain); // XSS target
localStorage.setItem('errorData', JSON.stringify(error)); // May contain sensitive info
localStorage.setItem('questionnaireData', JSON.stringify(responses)); // Privacy concern
```

**Impact**:
- XSS attacks can steal data from localStorage
- Data persists indefinitely (privacy concern)
- No encryption at rest
- GDPR compliance issues

**Attack Scenario**:
1. Attacker injects XSS payload via user input
2. Payload reads localStorage data
3. Data exfiltrated to attacker's server
4. Attacker gains access to Shopify domain, user preferences, etc.

**Remediation**:

1. **Move sensitive data to httpOnly cookies** (not accessible via JavaScript)
2. **Use sessionStorage** for temporary data (cleared on tab close)
3. **Encrypt data** if localStorage must be used
4. **Implement CSP headers** to mitigate XSS

```typescript
// BEFORE (INSECURE)
localStorage.setItem('shopifyDomain', domain);

// AFTER (SECURE) - Use httpOnly cookie (backend-set)
// Set via API response with Set-Cookie header
// OR use encrypted storage wrapper
import { SecureStorage } from '@/lib/secure-storage';

SecureStorage.setItem('shopifyDomain', domain); // Automatically encrypted
```

**Priority**: 🟠 **Before Launch**

---

## 🟡 Medium Severity Issues (Recommended Before Launch)

### 7. Supabase Linter Warnings

**Severity**: 🟡 **MEDIUM**

**Issues**:
1. Security Definer view without proper constraints
2. Extension in public schema (security risk)
3. PostgreSQL version needs security patches

**Remediation**:
Run `supabase db lint` and address each warning individually.

**Priority**: 🟡 **Recommended**

---

### 8. Missing Input Validation on Edge Functions

**Severity**: 🟡 **MEDIUM**

**Issue**: Some edge functions lack proper input validation, potentially vulnerable to injection attacks.

**Remediation**: Add Zod schema validation to all edge functions.

**Priority**: 🟡 **Recommended**

---

## 📊 Security Audit Summary

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| **Authentication & Access Control** | 2 | 1 | 0 | 0 | 3 |
| **Data Protection** | 1 | 2 | 1 | 0 | 4 |
| **Code Security** | 0 | 1 | 1 | 0 | 2 |
| **Infrastructure** | 0 | 0 | 1 | 0 | 1 |
| **TOTAL** | **3** | **4** | **3** | **0** | **10** |

---

## 🛡️ Security Hardening Checklist

### Immediate Actions (Before Any Deployment)
- [ ] Fix password hash exposure in RLS policies
- [ ] Add RLS policies to `user_security_summary`
- [ ] Remove all hardcoded credentials
- [ ] Rotate Supabase anon key (compromised by Git history)
- [ ] Fix `company_settings` RLS policy

### Before Public Launch
- [ ] Remove all console.log statements
- [ ] Implement production logging service (Sentry/LogRocket)
- [ ] Secure localStorage usage (encrypt or move to httpOnly cookies)
- [ ] Resolve all Supabase linter warnings
- [ ] Add input validation to all edge functions
- [ ] Enable CSP headers to prevent XSS
- [ ] Implement rate limiting on API endpoints
- [ ] Set up WAF (Web Application Firewall) if available

### Post-Launch Monitoring
- [ ] Set up security monitoring and alerts
- [ ] Schedule regular security audits (quarterly)
- [ ] Implement bug bounty program
- [ ] Create incident response plan
- [ ] Schedule penetration testing (annual)

---

## 🔐 Security Best Practices Going Forward

### For Developers

1. **Never commit credentials** to Git (use `.env` files)
2. **Use environment variables** for all secrets
3. **Enable RLS on all tables** with user data
4. **Test RLS policies** with different user roles
5. **Use SECURITY DEFINER carefully** (requires security audit)
6. **Validate all inputs** (Zod schemas, SQL parameterization)
7. **Never log sensitive data** (PII, credentials, tokens)
8. **Use CSP headers** to prevent XSS
9. **Implement rate limiting** on all public endpoints
10. **Keep dependencies updated** (automated security patches)

### For Administrators

1. **Rotate credentials regularly** (quarterly)
2. **Monitor audit logs** for suspicious activity
3. **Implement IP whitelisting** for admin functions
4. **Use MFA** for all admin accounts
5. **Review RLS policies** after any database changes
6. **Run security scans** before each deployment
7. **Maintain incident response plan**
8. **Conduct security training** for all team members

---

## 📞 Incident Response

**Security Incident Contact**: security@core47.ai

**Severity Levels**:
- **P0 (Critical)**: Active breach, data exposed - Response time: Immediate
- **P1 (High)**: Vulnerability discovered, no active exploitation - Response time: 4 hours
- **P2 (Medium)**: Security concern identified - Response time: 24 hours
- **P3 (Low)**: Security best practice recommendation - Response time: 1 week

**Incident Response Plan**:
1. **Detect** - Security monitoring alerts
2. **Contain** - Isolate affected systems, revoke credentials
3. **Investigate** - Determine scope and root cause
4. **Remediate** - Apply fixes, rotate credentials
5. **Document** - Post-mortem and lessons learned
6. **Notify** - Inform affected users (if required by law)

---

## 📚 Additional Resources

**Internal Documentation**:
- [Database Security](../documentation/database/security.md)
- [Pre-Launch Checklist](./PRE_LAUNCH_CHECKLIST.md)
- [Feature Status](./feature-status.md)

**External Resources**:
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/security.html)

---

**Last Security Audit**: October 2025  
**Next Scheduled Audit**: January 2026  
**Security Team**: Core47.ai Security  

**Developed by Core47.ai** - © 2025 Core47.ai. All rights reserved.
