# Growth OS Documentation

## Executive Overview

Growth OS is a comprehensive Learning Management System (LMS) designed for e-commerce education and mentorship programs. Built with React, TypeScript, and Supabase, it provides a complete platform for student onboarding, course delivery, assignment management, and financial tracking.

### Key Capabilities

- **Multi-Role Authentication System** - 5 distinct user roles with granular permissions
- **Sequential Learning Management** - Unlock-based content progression with assignments
- **Mentorship Program** - Dedicated mentor-student relationships with progress tracking  
- **Financial Management** - Installment payment tracking with automated invoicing
- **Live Session Scheduling** - Success sessions with mentor assignment
- **Comprehensive Notifications** - Real-time updates via email and in-app messaging
- **Support Ticket System** - Multi-tier customer support with role-based access
- **Company Branding** - Customizable logos, colors, and email templates
- **Analytics & Reporting** - Student performance tracking and leaderboards

### Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Email**: Resend API with custom SMTP configuration
- **Integrations**: Shopify, Zapier webhooks
- **File Storage**: Supabase Storage (assignments, branding assets)

---

## Documentation Navigation

### 📋 Getting Started
- [Architecture Overview](./architecture.md) - System design and component relationships
- [Environment Reference](./env-reference.md) - Complete environment variable guide
- [Deployment Guide](./deployment.md) - Local to production deployment steps

### 🚀 Core Features
- [Authentication System](./features/authentication-system.md) - User roles, sessions, security
- [Student Management](./features/student-management.md) - Onboarding, LMS access, profiles
- [Learning Management](./features/learning-management.md) - Modules, videos, content unlocking
- [Assignment System](./features/assignment-system.md) - Submissions, grading, mentorship
- [Financial Management](./features/financial-management.md) - Payments, invoices, installments
- [Live Sessions](./features/live-sessions.md) - Success sessions and scheduling
- [Notifications System](./features/notifications-system.md) - Email, in-app, real-time updates
- [Support Tickets](./features/support-tickets.md) - Help desk and customer support
- [Reporting & Analytics](./features/reporting-analytics.md) - Performance tracking, leaderboards

### 🎨 Customization Features
- [Company Branding](./features/company-branding.md) - Logo uploads, theme customization
- [User Activity Logging](./features/user-activity-logging.md) - Audit trails, admin logs
- [Quiz & Assessment](./features/quiz-assessment.md) - Module quizzes, progress tracking

### 🔗 Integrations
- [Supabase](./integrations/supabase.md) - Database, authentication, storage
- [Resend](./integrations/resend.md) - Email delivery service
- [Shopify](./integrations/shopify.md) - E-commerce integration
- [File Storage](./integrations/file-storage.md) - Asset management

### 👥 User Roles
- [Student Role](./roles/student-role.md) - Learning experience and capabilities
- [Mentor Role](./roles/mentor-role.md) - Teaching tools and student management
- [Admin Role](./roles/admin-role.md) - System administration features
- [Superadmin Role](./roles/superadmin-role.md) - Complete system control
- [Enrollment Manager Role](./roles/enrollment-manager-role.md) - Student enrollment tools

### 📚 Reference Materials
- [FAQ](./faq.md) - Frequently asked questions
- [Glossary](./glossary.md) - Technical terms and definitions
- [Changelog Template](./changelog-template.md) - Release documentation format

---

## Quick Start

1. **Local Development**
   ```bash
   git clone <repository-url>
   cd growth-os
   npm install
   npm run dev
   ```

2. **Environment Setup**
   - Configure Supabase project (see [Environment Reference](./env-reference.md))
   - Set up email delivery (see [Resend Integration](./integrations/resend.md))
   - Configure company branding (see [Company Branding](./features/company-branding.md))

3. **First Admin User**
   - Create superadmin account via Supabase Auth
   - Configure company settings in admin panel
   - Set up first mentor and student accounts

---

## Support & Maintenance

- **Issue Tracking**: Use GitHub Issues for bug reports and feature requests
- **Documentation Updates**: Follow [Changelog Template](./changelog-template.md)
- **Security**: Review [User Activity Logging](./features/user-activity-logging.md) for audit requirements

## Next Steps

Start with the [Architecture Overview](./architecture.md) to understand the system design, then proceed to [Environment Reference](./env-reference.md) for configuration details.