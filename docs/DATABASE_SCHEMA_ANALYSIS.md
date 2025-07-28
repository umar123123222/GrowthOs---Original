# Database Schema Analysis and Normalization Report

## Executive Summary

This document provides a comprehensive analysis of the Growth OS database schema, identifies normalization issues, and provides recommendations for achieving Third Normal Form (3NF) compliance.

## Current Database Status

### Analysis Date: 2025-07-28
### Schema Review: Supabase PostgreSQL Database

## Critical Findings

### 🔴 Major Normalization Violations (Non-3NF)

#### 1. **users** Table - Multiple Normalization Issues

**Current Issues:**
- **1NF Violation**: Mixed atomic and non-atomic data
- **2NF Violation**: Partial dependencies on composite keys
- **3NF Violation**: Transitive dependencies and redundant data

**Specific Problems:**
```sql
-- Current users table has 41+ columns mixing different concerns
users {
  id: string (PK)
  email: string  -- Authentication data
  full_name: string  -- Profile data
  role: string  -- Authorization data
  
  -- LMS-specific fields (should be separate table)
  lms_password: string | null
  lms_status: string | null  
  lms_user_id: string | null
  
  -- Credentials (should be separate secure table)
  shopify_credentials: string | null
  meta_ads_credentials: string | null
  temp_password: string | null
  
  -- Onboarding data (should be separate table)
  onboarding_data: Json | null
  onboarding_done: boolean | null
  biggest_blocker: string | null
  final_goal: string | null
  income_goal_3_months: string | null
  income_reason: string | null
  knows_facebook_ads: string | null
  shopify_experience: string | null
  short_term_goal: string | null
  status_after_3_months: string | null
  success_meaning: string | null
  tried_ecommerce_before: string | null
  weekly_time_commitment: string | null
  
  -- Financial data (should be separate table)
  fees_due_date: string | null
  fees_overdue: boolean | null
  fees_structure: string | null
  last_invoice_date: string | null
  last_invoice_sent: boolean | null
  last_suspended_date: string | null
  
  -- References that create circular dependencies
  mentor_id: string | null  -- OK, but could be better normalized
  batch_id: string | null
  pod_id: string | null
  tenant_id: string | null
  course_track_id: string | null
}
```

#### 2. **available_lessons** Table Issues

**Problems:**
- Mixed concerns: lesson metadata + assignment references
- Redundant assignment tracking
- Poor naming convention (should be `lessons` or `recordings`)

#### 3. **Missing Normalization Tables**

**Required Tables for 3NF:**
1. `user_profiles` - Basic profile information
2. `user_credentials` - Secure credential storage
3. `user_onboarding_responses` - Structured onboarding data
4. `user_financial_status` - Fee and payment tracking
5. `user_lms_accounts` - LMS-specific data

## 🟡 Moderate Issues

### Foreign Key Relationships
- Some foreign keys lack proper constraints
- Missing indexes on frequently queried foreign keys
- Inconsistent naming conventions

### Data Types and Constraints
- Missing NOT NULL constraints on required fields
- Inconsistent use of `string | null` vs proper defaults
- JSON fields used where structured tables would be better

## 🟢 Well-Designed Tables

### Properly Normalized Tables:
1. **assignment_submissions** - Good 3NF compliance
2. **quiz_attempts** - Proper atomic data
3. **recording_views** - Simple, focused purpose
4. **user_activity_logs** - Good event tracking structure
5. **notifications** - Well-structured messaging system

## Recommended 3NF Schema Redesign

### Core User Tables (3NF Compliant)

```sql
-- 1. Core authentication and basic profile
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'mentor', 'admin', 'superadmin', 'enrollment_manager')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_at TIMESTAMPTZ
);

-- 2. User profiles (extended information)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  avatar_url TEXT,
  phone TEXT,
  path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- 3. Secure credentials storage
CREATE TABLE user_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_type TEXT NOT NULL CHECK (credential_type IN ('shopify', 'meta_ads', 'lms', 'temp_password')),
  encrypted_value TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, credential_type)
);

-- 4. LMS account information
CREATE TABLE user_lms_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lms_user_id TEXT NOT NULL,
  lms_status TEXT NOT NULL DEFAULT 'inactive' CHECK (lms_status IN ('active', 'inactive', 'suspended')),
  student_id TEXT UNIQUE, -- Auto-generated STU000001, STU000002, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- 5. Financial status tracking
CREATE TABLE user_financial_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fees_structure TEXT,
  fees_due_date DATE,
  fees_overdue BOOLEAN NOT NULL DEFAULT false,
  last_invoice_date DATE,
  last_invoice_sent BOOLEAN NOT NULL DEFAULT false,
  last_suspended_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- 6. Structured onboarding responses
CREATE TABLE user_onboarding_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  biggest_blocker TEXT,
  final_goal TEXT,
  income_goal_3_months TEXT,
  income_reason TEXT,
  knows_facebook_ads TEXT,
  shopify_experience TEXT,
  short_term_goal TEXT,
  status_after_3_months TEXT,
  success_meaning TEXT,
  tried_ecommerce_before TEXT,
  weekly_time_commitment TEXT,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- 7. User assignments and relationships
CREATE TABLE user_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mentor_id UUID REFERENCES users(id),
  batch_id UUID REFERENCES batches(id),
  pod_id UUID REFERENCES pods(id),
  tenant_id UUID REFERENCES tenants(id),
  course_track_id UUID REFERENCES course_tracks(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
```

### Improved Supporting Tables

```sql
-- Rename and improve lessons table
CREATE TABLE lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  recording_url TEXT,
  duration_minutes INTEGER,
  sequence_order INTEGER NOT NULL,
  module_id UUID REFERENCES modules(id),
  batch_id UUID REFERENCES batches(id),
  assignment_id UUID REFERENCES assignment(assignment_id),
  notes TEXT,
  uploaded_by UUID REFERENCES users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Improve invoices table (currently missing key fields)
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  invoice_data JSONB, -- Structured invoice details
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Migration Strategy

### Phase 1: Create New Normalized Tables
1. Create all new 3NF-compliant tables
2. Add proper indexes and constraints
3. Migrate data from existing `users` table

### Phase 2: Update Application Code
1. Update all queries to use new table structure
2. Update Edge Functions for student creation
3. Update authentication flows

### Phase 3: Clean Up
1. Drop redundant columns from `users` table
2. Remove unused tables
3. Optimize indexes

## Data Integrity Issues Found

### Missing Constraints
```sql
-- Add missing constraints
ALTER TABLE users ADD CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
ALTER TABLE users ADD CONSTRAINT valid_role CHECK (role IN ('student', 'mentor', 'admin', 'superadmin', 'enrollment_manager'));

-- Add missing NOT NULL constraints
ALTER TABLE assignment_submissions ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE quiz_attempts ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE quiz_attempts ALTER COLUMN module_id SET NOT NULL;
```

### Recommended Indexes
```sql
-- Performance indexes
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_assignment_submissions_user_id ON assignment_submissions(user_id);
CREATE INDEX idx_assignment_submissions_assignment_id ON assignment_submissions(assignment_id);
CREATE INDEX idx_quiz_attempts_user_id ON quiz_attempts(user_id);
CREATE INDEX idx_quiz_attempts_module_id ON quiz_attempts(module_id);
CREATE INDEX idx_user_activity_logs_user_id ON user_activity_logs(user_id);
CREATE INDEX idx_recording_views_user_id ON recording_views(user_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
```

## Student Creation Process Fixes

### Current Issues in Student Creation
1. **Missing student_id auto-generation**
2. **No proper transaction handling**
3. **Credential security issues**
4. **Email service integration problems**

### Recommended Student Creation Flow
```sql
-- Auto-generate student_id function
CREATE OR REPLACE FUNCTION generate_student_id()
RETURNS TEXT AS $$
DECLARE
  next_id INTEGER;
  student_id TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(student_id FROM 4) AS INTEGER)), 0) + 1
  INTO next_id
  FROM user_lms_accounts
  WHERE student_id ~ '^STU[0-9]+$';
  
  student_id := 'STU' || LPAD(next_id::TEXT, 6, '0');
  RETURN student_id;
END;
$$ LANGUAGE plpgsql;

-- Student creation procedure
CREATE OR REPLACE FUNCTION create_student_complete(
  p_email TEXT,
  p_full_name TEXT,
  p_phone TEXT,
  p_fees_structure TEXT,
  p_created_by UUID
) RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_student_id TEXT;
  v_temp_password TEXT;
  v_invoice_id UUID;
  result JSON;
BEGIN
  -- Start transaction
  BEGIN
    -- Generate student ID
    v_student_id := generate_student_id();
    
    -- Generate temporary password
    v_temp_password := generate_random_password(12);
    
    -- Create user
    INSERT INTO users (email, full_name, role, status)
    VALUES (p_email, p_full_name, 'student', 'inactive')
    RETURNING id INTO v_user_id;
    
    -- Create user profile
    INSERT INTO user_profiles (user_id, phone)
    VALUES (v_user_id, p_phone);
    
    -- Create LMS account
    INSERT INTO user_lms_accounts (user_id, lms_user_id, student_id, lms_status)
    VALUES (v_user_id, p_email, v_student_id, 'inactive');
    
    -- Store temporary password securely
    INSERT INTO user_credentials (user_id, credential_type, encrypted_value)
    VALUES (v_user_id, 'temp_password', crypt(v_temp_password, gen_salt('bf')));
    
    -- Create financial status
    INSERT INTO user_financial_status (user_id, fees_structure)
    VALUES (v_user_id, p_fees_structure);
    
    -- Create invoice
    INSERT INTO invoices (user_id, invoice_number, amount, status, due_date)
    VALUES (
      v_user_id, 
      'INV-' || v_student_id || '-001',
      (SELECT original_fee_amount FROM company_settings LIMIT 1),
      'pending',
      CURRENT_DATE + INTERVAL '30 days'
    ) RETURNING id INTO v_invoice_id;
    
    -- Log activity
    INSERT INTO user_activity_logs (user_id, activity_type, metadata, reference_id)
    VALUES (
      v_user_id,
      'student_created',
      json_build_object('created_by', p_created_by, 'student_id', v_student_id),
      v_invoice_id::TEXT
    );
    
    result := json_build_object(
      'success', true,
      'user_id', v_user_id,
      'student_id', v_student_id,
      'invoice_id', v_invoice_id,
      'temp_password', v_temp_password
    );
    
    RETURN result;
    
  EXCEPTION WHEN OTHERS THEN
    -- Rollback handled automatically
    result := json_build_object(
      'success', false,
      'error', SQLERRM
    );
    RETURN result;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Current vs Recommended Status

| Aspect | Current Status | Recommended Status | Priority |
|--------|---------------|-------------------|----------|
| 1NF Compliance | ❌ Violated | ✅ Compliant | High |
| 2NF Compliance | ❌ Violated | ✅ Compliant | High |
| 3NF Compliance | ❌ Violated | ✅ Compliant | High |
| Data Integrity | ⚠️ Partial | ✅ Complete | High |
| Performance | ⚠️ Suboptimal | ✅ Optimized | Medium |
| Security | ⚠️ Partial | ✅ Secure | High |
| Maintainability | ❌ Poor | ✅ Excellent | High |

## Implementation Timeline

### Week 1: Analysis and Planning
- ✅ Complete schema analysis
- ✅ Identify normalization violations  
- ✅ Design 3NF schema
- 🔄 Create migration scripts

### Week 2: Database Migration
- 🔄 Create new normalized tables
- 🔄 Migrate existing data
- 🔄 Add constraints and indexes
- 🔄 Test data integrity

### Week 3: Application Updates
- 🔄 Update Edge Functions
- 🔄 Update frontend queries
- 🔄 Update authentication flows
- 🔄 Test student creation process

### Week 4: Cleanup and Optimization
- 🔄 Remove redundant columns
- 🔄 Drop unused tables
- 🔄 Performance optimization
- 🔄 Documentation updates

## Conclusion

The current database schema has significant normalization violations that impact data integrity, performance, and maintainability. The recommended 3NF-compliant schema will:

1. **Eliminate data redundancy** by properly separating concerns
2. **Improve data integrity** through proper constraints and relationships
3. **Enhance security** by isolating sensitive credential data
4. **Boost performance** through proper indexing and normalized queries
5. **Increase maintainability** through clear, focused table purposes

**Critical Action Required**: Immediate implementation of the normalized schema is recommended to prevent further data integrity issues and to ensure scalable growth of the system.