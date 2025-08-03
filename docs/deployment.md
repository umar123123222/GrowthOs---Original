# Deployment Guide

## Overview

Growth OS supports multiple deployment strategies, from local development to production environments. This guide covers the complete deployment pipeline using Lovable, Supabase, and GitHub integration.

## Prerequisites

- Node.js 18+ and npm
- Git for version control
- Supabase account and project
- Resend account for email delivery
- GitHub repository (for production deployment)

## Local Development Setup

### 1. Repository Setup

```bash
# Clone the repository
git clone <repository-url>
cd growth-os

# Install dependencies
npm install

# Start development server
npm run dev
```

### 2. Supabase Local Development

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref majqoqagohicjigmsilu

# Pull latest schema
supabase db pull

# Start local development
npm run dev
```

### 3. Environment Configuration

Local development uses the production Supabase instance by default. No additional environment variables are needed for basic functionality.

**Optional: Local Supabase Instance**
```bash
# Start local Supabase (optional)
supabase start

# Update src/integrations/supabase/client.ts with local URLs
# SUPABASE_URL = "http://localhost:54321"
# SUPABASE_ANON_KEY = "local_anon_key"
```

## Staging Environment

### 1. Supabase Staging Project

```bash
# Create new Supabase project for staging
supabase projects create growth-os-staging

# Update configuration for staging
# supabase/config.toml
project_id = "staging-project-id"
site_url = "https://staging.yourapp.com"
```

### 2. Database Migration

```bash
# Apply migrations to staging
supabase db push --project-ref staging-project-id

# Verify migration success
supabase db diff --project-ref staging-project-id
```

### 3. Staging Secrets Configuration

Configure all environment variables in Supabase Dashboard:
- **Resend API Key**: Use staging/test Resend key
- **SMTP Configuration**: Point to staging email service
- **Other secrets**: Use non-production values

## Production Deployment

### 1. Lovable Platform Deployment

Growth OS uses Lovable's built-in deployment system:

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Deploy to production"
   git push origin main
   ```

2. **Automatic Deployment**:
   - Lovable automatically detects changes
   - Builds and deploys the application
   - Updates live site immediately

3. **Custom Domain** (Optional):
   - Navigate to Project Settings → Domains
   - Add your custom domain
   - Configure DNS settings as instructed

### 2. Database Production Setup

```bash
# Ensure production migrations are applied
supabase db push --project-ref majqoqagohicjigmsilu

# Verify database schema
supabase db diff --project-ref majqoqagohicjigmsilu
```

### 3. Production Secrets

Configure in Supabase Dashboard → Edge Functions → Secrets:

**Required Secrets:**
```
RESEND_API_KEY=re_production_key
SMTP_HOST=smtp.production.com
SMTP_PORT=587
SMTP_USER=production@yourcompany.com
SMTP_PASSWORD=production_password
SMTP_FROM_EMAIL=noreply@yourcompany.com
SMTP_FROM_NAME=Your Company
SMTP_LMS_FROM_EMAIL=lms@yourcompany.com
SMTP_LMS_FROM_NAME=LMS Team
```

### 4. Edge Functions Deployment

Edge Functions are automatically deployed with the application:

```bash
# Manual deployment (if needed)
supabase functions deploy --project-ref majqoqagohicjigmsilu

# Deploy specific function
supabase functions deploy create-student --project-ref majqoqagohicjigmsilu
```

## Deployment Verification

### 1. Health Check Script

Create `scripts/health-check.ts`:

```typescript
import { supabase } from '../src/integrations/supabase/client';

async function healthCheck() {
  console.log('🔍 Starting health check...');
  
  try {
    // Test database connection
    const { data: users, error: dbError } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (dbError) throw dbError;
    console.log('✅ Database connection: OK');
    
    // Test Edge Functions
    const { data: whoami, error: funcError } = await supabase.functions.invoke('whoami');
    if (funcError) throw funcError;
    console.log('✅ Edge Functions: OK');
    
    // Test authentication
    const { data: session, error: authError } = await supabase.auth.getSession();
    console.log('✅ Authentication service: OK');
    
    console.log('🎉 All systems operational!');
    
  } catch (error) {
    console.error('❌ Health check failed:', error);
    process.exit(1);
  }
}

healthCheck();
```

### 2. Manual Testing Checklist

**Authentication & User Management:**
- [ ] User registration works
- [ ] Login/logout functionality
- [ ] Role-based access control
- [ ] Password reset emails

**Core Features:**
- [ ] Student can access modules
- [ ] Assignment submission works
- [ ] Mentor can review submissions
- [ ] Payment tracking functions
- [ ] Email notifications sent

**Admin Functions:**
- [ ] User management panel
- [ ] Company settings update
- [ ] File upload functionality
- [ ] Reporting features work

### 3. Performance Verification

```bash
# Test application load time
curl -w "@curl-format.txt" -o /dev/null -s "https://yourapp.lovable.app"

# Check Edge Function response time
curl -w "@curl-format.txt" -o /dev/null -s -X POST "https://majqoqagohicjigmsilu.supabase.co/functions/v1/whoami"
```

## Monitoring & Maintenance

### 1. Application Monitoring

**Supabase Monitoring:**
- Database performance via Supabase Dashboard
- Edge Function logs and error rates
- Authentication metrics and usage

**Lovable Monitoring:**
- Application uptime and response times
- Build success/failure notifications
- Traffic and usage analytics

### 2. Regular Maintenance Tasks

**Weekly:**
- Review Edge Function error logs
- Check email delivery rates
- Monitor database performance

**Monthly:**
- Update dependencies (`npm audit` and `npm update`)
- Review and rotate API keys
- Backup critical configuration

**Quarterly:**
- Security audit of user permissions
- Performance optimization review
- Disaster recovery testing

### 3. Log Management

**Application Logs:**
```bash
# View real-time Edge Function logs
supabase functions logs --project-ref majqoqagohicjigmsilu

# Filter logs by function
supabase functions logs create-student --project-ref majqoqagohicjigmsilu
```

**Database Logs:**
```sql
-- View recent admin activity
SELECT * FROM admin_logs 
ORDER BY created_at DESC 
LIMIT 100;

-- Check user activity patterns
SELECT activity_type, COUNT(*) 
FROM user_activity_logs 
WHERE occurred_at > NOW() - INTERVAL '24 hours'
GROUP BY activity_type;
```

## Rollback Procedures

### 1. Application Rollback

**Lovable Platform:**
1. Navigate to project history in Lovable
2. Select previous working version
3. Click "Restore" to rollback code
4. Verify application functionality

**GitHub Integration:**
```bash
# Rollback to previous commit
git revert HEAD
git push origin main

# Rollback multiple commits
git reset --hard <previous-commit-hash>
git push --force origin main
```

### 2. Database Rollback

```bash
# Create backup before rollback
pg_dump $(supabase status | grep 'DB URL' | cut -d: -f2-) > backup.sql

# Apply down migrations
supabase migration down <migration-timestamp>

# Verify rollback success
supabase db diff
```

### 3. Emergency Rollback Checklist

1. **Identify Issue**: Determine scope and impact
2. **Stop New Deployments**: Prevent additional changes
3. **Rollback Application**: Use platform rollback or git revert
4. **Rollback Database** (if needed): Apply down migrations
5. **Verify Functionality**: Run health checks
6. **Notify Stakeholders**: Communicate status and timeline
7. **Post-Incident Review**: Document lessons learned

## Disaster Recovery

### 1. Data Backup Strategy

**Automated Backups:**
- Supabase provides automatic daily backups
- Configure backup retention policy (7-30 days recommended)
- Test backup restoration quarterly

**Manual Backup:**
```bash
# Export database schema and data
supabase db dump --project-ref majqoqagohicjigmsilu > growth-os-backup.sql

# Export user files from storage
# Use Supabase Dashboard or API to download storage contents
```

### 2. Recovery Procedures

**Database Recovery:**
```bash
# Restore from Supabase backup
# Use Supabase Dashboard → Database → Backups

# Or restore from manual backup
psql $(supabase status | grep 'DB URL' | cut -d: -f2-) < growth-os-backup.sql
```

**Application Recovery:**
1. Recreate Lovable project if needed
2. Restore code from GitHub repository
3. Reconfigure environment variables
4. Test all functionality

### 3. Business Continuity

**Communication Plan:**
- Status page for system outages
- Email notifications to administrators
- Escalation procedures for critical issues

**Recovery Time Objectives:**
- Application: 30 minutes maximum downtime
- Database: 1 hour maximum data loss
- User files: 24 hours maximum recovery time

## Next Steps

Once deployment is complete, configure your system using the [Company Branding](./features/company-branding.md) and [Authentication System](./features/authentication-system.md) documentation.