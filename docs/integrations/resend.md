# Resend Email Integration

## Overview

Resend provides email delivery services for Growth OS, handling transactional emails, notifications, and automated communications.

## Purpose in Project

- **Transactional Emails**: Account creation, password resets, notifications
- **Automated Communications**: Payment reminders, assignment updates
- **System Notifications**: Session reminders, support ticket updates
- **Marketing Communications**: Announcements and system updates

## Setup and Configuration

### API Key Configuration
1. Create account at [resend.com](https://resend.com)
2. Generate API key at [resend.com/api-keys](https://resend.com/api-keys)
3. Validate sender domain at [resend.com/domains](https://resend.com/domains)
4. Add `RESEND_API_KEY` to Supabase Edge Function secrets

### Environment Variables
- `RESEND_API_KEY`: Required for email delivery
- `SMTP_FROM_EMAIL`: Default sender email address
- `SMTP_FROM_NAME`: Default sender name (fallback: "Growth OS")

## Integration Points

### Edge Functions
Email sending handled through Edge Functions:
```typescript
import { Resend } from "npm:resend@2.0.0";
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
```

### Email Templates
- Student onboarding emails
- Payment confirmation notifications  
- Assignment submission alerts
- Support ticket responses

## Troubleshooting

### Common Issues
- **Domain Validation**: Ensure sender domain is verified
- **API Limits**: Monitor usage against plan limits
- **Delivery Failures**: Check spam folders and email filters

### Alternative Configuration
SMTP fallback available if Resend is not preferred:
- Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`

## Next Steps
Review [Notifications System](../features/notifications-system.md) for email integration details.