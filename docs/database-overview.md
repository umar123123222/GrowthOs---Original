# Database Overview

A high-level overview of the Growth OS database architecture and organization.

## Architecture Summary

Growth OS uses Supabase PostgreSQL with a comprehensive schema designed for scalability and security.

### Key Statistics
- **39 Production Tables** across 8 functional areas
- **50+ Database Functions** for business logic
- **25+ RLS Policies** for security
- **15+ Triggers** for automation
- **Multiple Indexes** for performance

## Functional Areas

### 1. User Management
Core user authentication and profile management.

**Key Tables:**
- `users` - Core user authentication
- `students` - Student profiles and metadata
- `student_details` - Extended student information
- `user_roles` - Role-based access control

### 2. Learning Management System
Content delivery and progress tracking.

**Key Tables:**
- `available_lessons` - Course content structure
- `lesson_recordings` - Video content and metadata
- `student_recordings` - Progress tracking
- `sequential_unlocks` - Content progression rules

### 3. Financial Management
Payment processing and invoice management.

**Key Tables:**
- `invoices` - Financial transactions
- `installment_plans` - Payment schedules
- `shopify_metrics` - E-commerce integration

### 4. Communication & Engagement
Notifications and user interaction.

**Key Tables:**
- `notifications` - System notifications
- `support_tickets` - Customer support
- `milestone_celebration` - Achievement tracking

### 5. Analytics & Tracking
Performance monitoring and business intelligence.

**Key Tables:**
- `admin_logs` - System activity logging
- `student_performance` - Academic analytics
- `meta_ads_metrics` - Marketing analytics

## Security Architecture

- **Row-Level Security (RLS)** enabled on all user-facing tables
- **Role-based permissions** with 5 distinct user roles
- **Audit logging** for all critical operations
- **Data isolation** between organizations

## Performance Characteristics

- **Sub-100ms** query performance for most operations
- **Optimized indexes** for common query patterns
- **Scalable design** supporting 10,000+ concurrent users
- **Efficient pagination** for large datasets

## Related Documentation

- [Database Security](./database-security.md)
- [Database Tables Reference](./database-tables.md)
- [Technical Capabilities](./technical-capabilities.md)
- [Features Overview](./features-overview.md)