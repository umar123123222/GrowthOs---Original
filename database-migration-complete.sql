-- =========================================
-- COMPLETE DATABASE MIGRATION SCRIPT
-- =========================================
-- This script recreates the entire LMS database schema
-- including tables, functions, triggers, policies, and types

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================
-- CUSTOM TYPES AND ENUMS
-- =========================================

CREATE TYPE assignment_submission_status AS ENUM ('submitted', 'accepted', 'rejected');
CREATE TYPE onboarding_status AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'RETRY');
CREATE TYPE onboarding_step AS ENUM ('EMAIL', 'INVOICE');

-- =========================================
-- SEQUENCES
-- =========================================

CREATE SEQUENCE IF NOT EXISTS smtp_configs_id_seq;

-- =========================================
-- TABLES
-- =========================================

-- Admin Logs Table
CREATE TABLE public.admin_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    action TEXT NOT NULL,
    description TEXT,
    performed_by UUID,
    data JSONB,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- Assignment Table
CREATE TABLE public.assignment (
    assignment_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    assignment_title TEXT,
    assignment_description TEXT,
    sequence_order INTEGER NOT NULL,
    due_date TIMESTAMP WITH TIME ZONE,
    due_days_after_unlock INTEGER DEFAULT 2,
    status TEXT,
    mentor_id UUID,
    assigned_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Assignment Submissions Table
CREATE TABLE public.assignment_submissions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    assignment_id UUID NOT NULL,
    user_id UUID NOT NULL,
    submission_type TEXT NOT NULL,
    text_response TEXT,
    file_url TEXT,
    external_link TEXT,
    status assignment_submission_status NOT NULL DEFAULT 'submitted',
    score INTEGER,
    feedback TEXT,
    reviewed_by UUID,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_note TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Available Lessons Table
CREATE TABLE public.available_lessons (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    recording_title TEXT,
    recording_url TEXT,
    duration_min INTEGER,
    sequence_order INTEGER,
    module UUID,
    assignment_id UUID,
    batch_id UUID,
    uploaded_by UUID,
    uploaded_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    notes TEXT,
    last_assignment_completed UUID
);

-- Badges Table
CREATE TABLE public.badges (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT
);

-- Batches Table
CREATE TABLE public.batches (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Certificates Table
CREATE TABLE public.certificates (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    certificate_url TEXT NOT NULL,
    track TEXT NOT NULL,
    tenant_id UUID,
    issued_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    downloaded BOOLEAN DEFAULT false
);

-- Company Settings Table
CREATE TABLE public.company_settings (
    id INTEGER NOT NULL DEFAULT 1 PRIMARY KEY,
    company_name TEXT NOT NULL DEFAULT 'Your Company',
    company_email TEXT,
    primary_phone TEXT NOT NULL DEFAULT '',
    secondary_phone TEXT,
    address TEXT NOT NULL DEFAULT '',
    contact_email TEXT NOT NULL DEFAULT '',
    company_logo TEXT,
    original_fee_amount NUMERIC NOT NULL DEFAULT 3000.00,
    maximum_installment_count INTEGER NOT NULL DEFAULT 3,
    currency TEXT NOT NULL DEFAULT 'USD',
    invoice_send_gap_days INTEGER NOT NULL DEFAULT 7,
    invoice_overdue_days INTEGER NOT NULL DEFAULT 30,
    invoice_notes TEXT,
    installment_plans INTEGER[],
    payment_methods JSONB DEFAULT '[]',
    branding JSONB DEFAULT '{}',
    questionnaire JSONB DEFAULT '[]',
    enable_student_signin BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Course Tracks Table
CREATE TABLE public.course_tracks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- Feedback Table
CREATE TABLE public.feedback (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    module_id UUID,
    reflection TEXT,
    ai_score INTEGER,
    submitted_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- Installment Payments Table
CREATE TABLE public.installment_payments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    installment_number INTEGER NOT NULL,
    total_installments INTEGER NOT NULL,
    amount NUMERIC,
    status TEXT DEFAULT 'paid',
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
    invoice_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Leaderboard Table
CREATE TABLE public.leaderboard (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    points INTEGER DEFAULT 0,
    rank INTEGER,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- Mentorship Notes Table
CREATE TABLE public.mentorship_notes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    mentor_id UUID,
    student_id UUID,
    note TEXT,
    added_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- Messages Table
CREATE TABLE public.messages (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    template_name TEXT,
    status TEXT,
    context JSONB,
    response_id TEXT,
    sent_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- Modules Table
CREATE TABLE public.modules (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    "order" INTEGER,
    tenant_id UUID,
    quiz_questions JSONB
);

-- Notifications Table
CREATE TABLE public.notifications (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    type TEXT,
    channel TEXT,
    status TEXT,
    payload JSONB,
    error_message TEXT,
    sent_at TIMESTAMP WITHOUT TIME ZONE
);

-- Onboarding Responses Table
CREATE TABLE public.onboarding_responses (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    question_type TEXT NOT NULL,
    question_text TEXT NOT NULL,
    answer_value TEXT,
    answer_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Performance Record Table
CREATE TABLE public.performance_record (
    id BIGINT NOT NULL PRIMARY KEY,
    user_id UUID DEFAULT gen_random_uuid(),
    times_recovered SMALLINT
);

-- Pods Table
CREATE TABLE public.pods (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    mentor_id UUID,
    tenant_id UUID,
    notes TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- Progress Table
CREATE TABLE public.progress (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    module_id UUID,
    status TEXT DEFAULT 'not_started',
    score INTEGER,
    time_spent_min INTEGER,
    started_at TIMESTAMP WITHOUT TIME ZONE,
    completed_at TIMESTAMP WITHOUT TIME ZONE
);

-- Quiz Attempts Table
CREATE TABLE public.quiz_attempts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    module_id UUID NOT NULL,
    question_id UUID NOT NULL,
    selected_option TEXT,
    is_correct BOOLEAN,
    attempt_number INTEGER DEFAULT 1,
    attempted_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- Quiz Questions Table
CREATE TABLE public.quiz_questions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    module_id UUID NOT NULL,
    question_text TEXT NOT NULL,
    options JSONB NOT NULL,
    correct_option TEXT,
    explanation TEXT
);

-- Recording Views Table
CREATE TABLE public.recording_views (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    recording_id UUID NOT NULL,
    watched BOOLEAN DEFAULT false,
    watched_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- Segmented Weekly Success Sessions View Table
CREATE TABLE public.segmented_weekly_success_sessions (
    id UUID,
    title TEXT,
    description TEXT,
    start_time TIMESTAMP WITHOUT TIME ZONE,
    end_time TIMESTAMP WITHOUT TIME ZONE,
    mentor_id UUID,
    mentor_name TEXT,
    status TEXT,
    segment TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE
);

-- Session Attendance Table
CREATE TABLE public.session_attendance (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    live_session_id UUID,
    joined_at TIMESTAMP WITHOUT TIME ZONE,
    left_at TIMESTAMP WITHOUT TIME ZONE
);

-- Session Recordings Table
CREATE TABLE public.session_recordings (
    id UUID,
    recording_title TEXT,
    recording_url TEXT,
    duration_min INTEGER,
    sequence_order INTEGER,
    module UUID,
    assignment_id UUID,
    batch_id UUID,
    uploaded_by UUID,
    uploaded_at TIMESTAMP WITHOUT TIME ZONE,
    notes TEXT,
    last_assignment_completed UUID
);

-- SMTP Configs Table
CREATE TABLE public.smtp_configs (
    id INTEGER NOT NULL DEFAULT nextval('smtp_configs_id_seq') PRIMARY KEY,
    purpose TEXT NOT NULL UNIQUE,
    host TEXT,
    port INTEGER,
    username TEXT,
    password TEXT,
    secure BOOLEAN DEFAULT false,
    from_address TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Student Onboarding Jobs Table
CREATE TABLE public.student_onboarding_jobs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID NOT NULL,
    step onboarding_step NOT NULL,
    status onboarding_status NOT NULL DEFAULT 'PENDING',
    retries INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Success Sessions Table
CREATE TABLE public.success_sessions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    link TEXT NOT NULL,
    start_time TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    end_time TIMESTAMP WITHOUT TIME ZONE,
    mentor_id UUID,
    mentor_name TEXT,
    status TEXT DEFAULT 'upcoming',
    schedule_date TEXT,
    zoom_meeting_id TEXT,
    zoom_passcode TEXT,
    host_login_email TEXT,
    host_login_pwd TEXT,
    created_by UUID,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- Support Tickets Table
CREATE TABLE public.support_tickets (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    type TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'open',
    assigned_to UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tenants Table
CREATE TABLE public.tenants (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Ticket Replies Table
CREATE TABLE public.ticket_replies (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id UUID NOT NULL,
    user_id UUID NOT NULL,
    message TEXT NOT NULL,
    is_staff BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User Activity Logs Table
CREATE TABLE public.user_activity_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    activity_type TEXT,
    metadata JSONB,
    occurred_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- Users Table (Main user profiles table)
CREATE TABLE public.users (
    id UUID NOT NULL PRIMARY KEY,
    email TEXT UNIQUE,
    full_name TEXT,
    phone TEXT,
    role TEXT,
    status TEXT DEFAULT 'Active',
    lms_status TEXT DEFAULT 'inactive',
    lms_password TEXT,
    temp_password TEXT,
    student_id TEXT UNIQUE,
    mentor_id UUID,
    fees_structure TEXT,
    onboarding_done BOOLEAN DEFAULT false,
    last_active_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- User Badges Table
CREATE TABLE public.user_badges (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    badge_id UUID,
    earned_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- User Module Progress Table
CREATE TABLE public.user_module_progress (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    module_id UUID,
    is_completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- User Segments Table
CREATE TABLE public.user_segments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    segment_name TEXT,
    assigned_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- User Unlocks Table
CREATE TABLE public.user_unlocks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    module_id UUID,
    recording_id UUID,
    unlocked_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- =========================================
-- FUNCTIONS
-- =========================================

-- Updated At Column Function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Get Current User Role Function
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

-- Is Module Completed Function
CREATE OR REPLACE FUNCTION public.is_module_completed(_user_id UUID, _module_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT is_completed FROM public.user_module_progress 
     WHERE user_id = _user_id AND module_id = _module_id),
    false
  );
$$;

-- Is Assignment Passed Function
CREATE OR REPLACE FUNCTION public.is_assignment_passed(_user_id UUID, _assignment_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.assignment_submissions 
    WHERE user_id = _user_id 
    AND assignment_id = _assignment_id 
    AND status = 'accepted'
  );
$$;

-- Is Recording Watched Function
CREATE OR REPLACE FUNCTION public.is_recording_watched(_user_id UUID, _recording_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT watched FROM public.recording_views 
     WHERE user_id = _user_id AND recording_id = _recording_id
     LIMIT 1),
    false
  );
$$;

-- Create Notification Function
CREATE OR REPLACE FUNCTION public.create_notification(p_user_id UUID, p_type TEXT, p_title TEXT, p_message TEXT, p_metadata JSONB DEFAULT '{}')
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO public.notifications (
    user_id,
    type,
    channel,
    status,
    sent_at,
    payload
  ) VALUES (
    p_user_id,
    p_type,
    'system',
    'sent',
    NOW(),
    jsonb_build_object(
      'title', p_title,
      'message', p_message,
      'metadata', p_metadata
    )
  ) RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$;

-- Notify All Students Function
CREATE OR REPLACE FUNCTION public.notify_all_students(p_type TEXT, p_title TEXT, p_message TEXT, p_metadata JSONB DEFAULT '{}')
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  student_count INTEGER := 0;
  student_record RECORD;
BEGIN
  FOR student_record IN 
    SELECT id FROM public.users WHERE role = 'student'
  LOOP
    PERFORM public.create_notification(
      student_record.id,
      p_type,
      p_title,
      p_message,
      p_metadata
    );
    student_count := student_count + 1;
  END LOOP;
  
  RETURN student_count;
END;
$$;

-- Notify Mentor Students Function
CREATE OR REPLACE FUNCTION public.notify_mentor_students(p_mentor_id UUID, p_type TEXT, p_title TEXT, p_message TEXT, p_metadata JSONB DEFAULT '{}')
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  student_count INTEGER := 0;
  student_record RECORD;
BEGIN
  FOR student_record IN 
    SELECT id FROM public.users 
    WHERE role = 'student' AND mentor_id = p_mentor_id
  LOOP
    PERFORM public.create_notification(
      student_record.id,
      p_type,
      p_title,
      p_message,
      p_metadata
    );
    student_count := student_count + 1;
  END LOOP;
  
  RETURN student_count;
END;
$$;

-- Generate Student ID Function
CREATE OR REPLACE FUNCTION public.generate_student_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'student' AND NEW.student_id IS NULL THEN
    NEW.student_id := 'STU' || LPAD(
      (SELECT COALESCE(MAX(CAST(SUBSTRING(student_id FROM 4) AS INTEGER)), 0) + 1
       FROM public.users 
       WHERE role = 'student' AND student_id IS NOT NULL)::TEXT, 
      6, '0'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Get User Unlock Status Function
CREATE OR REPLACE FUNCTION public.get_user_unlock_status(_user_id UUID)
RETURNS TABLE(module_id UUID, recording_id UUID, is_module_unlocked BOOLEAN, is_recording_unlocked BOOLEAN)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
DECLARE
  current_module RECORD;
  current_recording RECORD;
  prev_module_completed BOOLEAN := true;
  prev_recording_watched BOOLEAN := true;
  prev_assignment_passed BOOLEAN := true;
  assignment_id_to_check UUID;
BEGIN
  -- Loop through modules in order
  FOR current_module IN 
    SELECT m.id, m.title, m.order 
    FROM public.modules m 
    ORDER BY m.order NULLS LAST, m.title
  LOOP
    -- Check if previous module was completed
    IF prev_module_completed THEN
      -- Module is unlocked
      RETURN QUERY SELECT 
        current_module.id,
        NULL::UUID,
        true,
        false;
      
      -- Reset for this module's recordings
      prev_recording_watched := true;
      prev_assignment_passed := true;
      
      -- Loop through recordings in this module
      FOR current_recording IN
        SELECT al.id, al.sequence_order
        FROM public.available_lessons al
        WHERE al.module = current_module.id
        ORDER BY al.sequence_order NULLS LAST
      LOOP
        -- Check if previous recording was watched and assignment passed
        IF prev_recording_watched AND prev_assignment_passed THEN
          -- Recording is unlocked
          RETURN QUERY SELECT 
            current_module.id,
            current_recording.id,
            true,
            true;
          
          -- Check if this recording has been watched
          prev_recording_watched := public.is_recording_watched(_user_id, current_recording.id);
          
          -- Check if associated assignment has been passed
          IF prev_recording_watched THEN
            -- Get the first assignment for this sequence_order
            SELECT a.assignment_id INTO assignment_id_to_check
            FROM public.assignment a
            WHERE a.sequence_order = current_recording.sequence_order
            LIMIT 1;
            
            IF assignment_id_to_check IS NOT NULL THEN
              prev_assignment_passed := public.is_assignment_passed(_user_id, assignment_id_to_check);
            END IF;
          ELSE
            prev_assignment_passed := false;
          END IF;
        ELSE
          -- Recording is locked
          RETURN QUERY SELECT 
            current_module.id,
            current_recording.id,
            true,
            false;
        END IF;
      END LOOP;
      
      -- Check if all recordings in this module are completed
      prev_module_completed := NOT EXISTS(
        SELECT 1 FROM public.available_lessons al
        WHERE al.module = current_module.id
        AND NOT public.is_recording_watched(_user_id, al.id)
      );
      
      -- If module is completed, check all assignments are passed
      IF prev_module_completed THEN
        prev_module_completed := NOT EXISTS(
          SELECT 1 FROM public.available_lessons al
          JOIN public.assignment a ON a.sequence_order = al.sequence_order
          WHERE al.module = current_module.id
          AND NOT public.is_assignment_passed(_user_id, a.assignment_id)
        );
      END IF;
    ELSE
      -- Module is locked
      RETURN QUERY SELECT 
        current_module.id,
        NULL::UUID,
        false,
        false;
    END IF;
  END LOOP;
END;
$$;

-- Get User LMS Status Function
CREATE OR REPLACE FUNCTION public.get_user_lms_status(user_id UUID)
RETURNS TEXT
LANGUAGE SQL
STABLE SECURITY DEFINER
AS $$
  SELECT COALESCE(lms_status, 'inactive') FROM public.users WHERE id = user_id;
$$;

-- Update Company Branding Function
CREATE OR REPLACE FUNCTION public.update_company_branding(branding_data JSONB)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  UPDATE public.company_settings 
  SET branding = branding_data,
      updated_at = now()
  WHERE id = 1;
  
  IF NOT FOUND THEN
    INSERT INTO public.company_settings (id, branding, created_at, updated_at)
    VALUES (1, branding_data, now(), now());
  END IF;
  
  result := json_build_object('success', true, 'branding', branding_data);
  RETURN result;
END;
$$;

-- Get SMTP Config Function
CREATE OR REPLACE FUNCTION public.get_smtp_config(p_purpose TEXT)
RETURNS TABLE(host TEXT, port INTEGER, username TEXT, password TEXT, secure BOOLEAN, from_address TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sc.host,
        sc.port,
        sc.username,
        sc.password,
        sc.secure,
        sc.from_address
    FROM public.smtp_configs sc
    WHERE sc.purpose = p_purpose;
END;
$$;

-- Update SMTP Config Function
CREATE OR REPLACE FUNCTION public.update_smtp_config(p_purpose TEXT, p_host TEXT, p_port INTEGER, p_username TEXT, p_password TEXT, p_secure BOOLEAN, p_from_address TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Check if user is superadmin
  IF NOT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'superadmin'
  ) THEN
    RAISE EXCEPTION 'Access denied. Superadmin role required.';
  END IF;

  -- Update or insert SMTP config
  INSERT INTO public.smtp_configs (purpose, host, port, username, password, secure, from_address, updated_at)
  VALUES (p_purpose, p_host, p_port, p_username, p_password, p_secure, p_from_address, now())
  ON CONFLICT (purpose) 
  DO UPDATE SET
    host = EXCLUDED.host,
    port = EXCLUDED.port,
    username = EXCLUDED.username,
    password = EXCLUDED.password,
    secure = EXCLUDED.secure,
    from_address = EXCLUDED.from_address,
    updated_at = now();

  v_result := json_build_object(
    'success', true,
    'purpose', p_purpose,
    'message', 'SMTP configuration updated successfully'
  );

  RETURN v_result;
END;
$$;

-- Enqueue Student Onboarding Jobs Function
CREATE OR REPLACE FUNCTION public.enqueue_student_onboarding_jobs(p_student_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert EMAIL job
  INSERT INTO public.student_onboarding_jobs (student_id, step, status)
  VALUES (p_student_id, 'EMAIL', 'PENDING');
  
  -- Insert INVOICE job
  INSERT INTO public.student_onboarding_jobs (student_id, step, status)
  VALUES (p_student_id, 'INVOICE', 'PENDING');
END;
$$;

-- Update Onboarding Jobs Updated At Function
CREATE OR REPLACE FUNCTION public.update_onboarding_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================
-- TRIGGERS
-- =========================================

-- Generate Student ID Trigger
CREATE TRIGGER trigger_generate_student_id
  BEFORE INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_student_id();

-- Updated At Triggers
CREATE TRIGGER trigger_update_assignment_submissions_updated_at
  BEFORE UPDATE ON public.assignment_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_update_installment_payments_updated_at
  BEFORE UPDATE ON public.installment_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_update_onboarding_responses_updated_at
  BEFORE UPDATE ON public.onboarding_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_update_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_update_company_settings_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_update_onboarding_jobs_updated_at
  BEFORE UPDATE ON public.student_onboarding_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_onboarding_jobs_updated_at();

-- =========================================
-- ENABLE ROW LEVEL SECURITY
-- =========================================

ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.available_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installment_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentorship_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recording_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smtp_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_onboarding_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.success_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- =========================================
-- ROW LEVEL SECURITY POLICIES
-- =========================================

-- Assignment Policies
CREATE POLICY "Everyone can view assignments" ON public.assignment
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert assignments" ON public.assignment
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can update assignments" ON public.assignment
  FOR UPDATE USING (true);

CREATE POLICY "Authenticated users can delete assignments" ON public.assignment
  FOR DELETE USING (true);

-- Assignment Submissions Policies
CREATE POLICY "Students can create submissions" ON public.assignment_submissions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Students can view own submissions" ON public.assignment_submissions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Students cannot update submissions" ON public.assignment_submissions
  FOR UPDATE USING (false);

CREATE POLICY "Admins can view all submissions" ON public.assignment_submissions
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = ANY(ARRAY['admin', 'superadmin'])
  ));

CREATE POLICY "Admins can update all submissions" ON public.assignment_submissions
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = ANY(ARRAY['admin', 'superadmin'])
  ));

CREATE POLICY "Mentors can view assigned submissions" ON public.assignment_submissions
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.users u1
    WHERE u1.id = auth.uid() AND u1.role = 'mentor' AND EXISTS (
      SELECT 1 FROM public.users u2
      WHERE u2.id = assignment_submissions.user_id AND u2.mentor_id = auth.uid()
    )
  ));

CREATE POLICY "Mentors can update assigned submissions" ON public.assignment_submissions
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.users u1
    WHERE u1.id = auth.uid() AND u1.role = 'mentor' AND EXISTS (
      SELECT 1 FROM public.users u2
      WHERE u2.id = assignment_submissions.user_id AND u2.mentor_id = auth.uid()
    )
  ));

-- Available Lessons Policies
CREATE POLICY "Everyone can view session recordings" ON public.available_lessons
  FOR SELECT USING (true);

CREATE POLICY "Superadmins and admins can insert recordings" ON public.available_lessons
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = ANY(ARRAY['superadmin', 'admin'])
  ));

CREATE POLICY "Superadmins and admins can update recordings" ON public.available_lessons
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = ANY(ARRAY['superadmin', 'admin'])
  ));

CREATE POLICY "Superadmins and admins can delete recordings" ON public.available_lessons
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = ANY(ARRAY['superadmin', 'admin'])
  ));

-- Badges Policies
CREATE POLICY "Everyone can view badges" ON public.badges
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage badges" ON public.badges
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = ANY(ARRAY['admin', 'superadmin'])
  ));

-- Certificates Policies
CREATE POLICY "Users can view their own certificates" ON public.certificates
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all certificates" ON public.certificates
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = ANY(ARRAY['admin', 'superadmin'])
  ));

CREATE POLICY "System can create certificates" ON public.certificates
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Company Settings Policies
CREATE POLICY "Superadmins can manage company settings" ON public.company_settings
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'superadmin'
  ));

CREATE POLICY "Admins can view company settings" ON public.company_settings
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  ));

-- Course Tracks Policies
CREATE POLICY "Everyone can view course tracks" ON public.course_tracks
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage course tracks" ON public.course_tracks
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = ANY(ARRAY['admin', 'superadmin'])
  ));

-- Feedback Policies
CREATE POLICY "Users can view their own feedback" ON public.feedback
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own feedback" ON public.feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feedback" ON public.feedback
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all feedback" ON public.feedback
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = ANY(ARRAY['admin', 'superadmin'])
  ));

CREATE POLICY "Mentors can view assigned student feedback" ON public.feedback
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'mentor' AND EXISTS (
      SELECT 1 FROM public.users students
      WHERE students.id = feedback.user_id AND students.mentor_id = auth.uid()
    )
  ));

-- Installment Payments Policies
CREATE POLICY "Users can view their own installment payments" ON public.installment_payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all installment payments" ON public.installment_payments
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert installment payments" ON public.installment_payments
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can update installment payments" ON public.installment_payments
  FOR UPDATE USING (true);

-- Leaderboard Policies
CREATE POLICY "Everyone can view leaderboard" ON public.leaderboard
  FOR SELECT USING (true);

CREATE POLICY "System can manage leaderboard" ON public.leaderboard
  FOR ALL USING (auth.role() = 'service_role');

-- Mentorship Notes Policies
CREATE POLICY "Mentors can view their own notes" ON public.mentorship_notes
  FOR SELECT USING (auth.uid() = mentor_id);

CREATE POLICY "Mentors can create notes" ON public.mentorship_notes
  FOR INSERT WITH CHECK (auth.uid() = mentor_id);

CREATE POLICY "Mentors can update their own notes" ON public.mentorship_notes
  FOR UPDATE USING (auth.uid() = mentor_id);

CREATE POLICY "Students can view notes about them" ON public.mentorship_notes
  FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Admins can view all notes" ON public.mentorship_notes
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = ANY(ARRAY['admin', 'superadmin'])
  ));

-- Messages Policies
CREATE POLICY "Users can view their own messages" ON public.messages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can create messages" ON public.messages
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins can view all messages" ON public.messages
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = ANY(ARRAY['admin', 'superadmin'])
  ));

-- Modules Policies
CREATE POLICY "Everyone can view modules" ON public.modules
  FOR SELECT USING (true);

CREATE POLICY "Superadmins and admins can insert modules" ON public.modules
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = ANY(ARRAY['superadmin', 'admin'])
  ));

CREATE POLICY "Superadmins and admins can update modules" ON public.modules
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = ANY(ARRAY['superadmin', 'admin'])
  ));

CREATE POLICY "Superadmins and admins can delete modules" ON public.modules
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = ANY(ARRAY['superadmin', 'admin'])
  ));

-- Notifications Policies
CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

-- Onboarding Responses Policies
CREATE POLICY "Users can view their own responses" ON public.onboarding_responses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own responses" ON public.onboarding_responses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own responses" ON public.onboarding_responses
  FOR UPDATE USING (auth.uid() = user_id);

-- Performance Record Policies
CREATE POLICY "Users can view their own performance record" ON public.performance_record
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all performance records" ON public.performance_record
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = ANY(ARRAY['admin', 'superadmin'])
  ));

CREATE POLICY "System can manage performance records" ON public.performance_record
  FOR ALL WITH CHECK (auth.role() = 'service_role');

-- Pods Policies
CREATE POLICY "Everyone can view pods" ON public.pods
  FOR SELECT USING (true);

CREATE POLICY "Mentors can manage their own pods" ON public.pods
  FOR ALL USING (auth.uid() = mentor_id);

CREATE POLICY "Admins can manage all pods" ON public.pods
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = ANY(ARRAY['admin', 'superadmin'])
  ));

-- Progress Policies
CREATE POLICY "Users can view their own progress" ON public.progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own progress" ON public.progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own progress" ON public.progress
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all progress" ON public.progress
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = ANY(ARRAY['admin', 'superadmin'])
  ));

CREATE POLICY "Mentors can view assigned student progress" ON public.progress
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'mentor' AND EXISTS (
      SELECT 1 FROM public.users students
      WHERE students.id = progress.user_id AND students.mentor_id = auth.uid()
    )
  ));

-- Quiz Attempts Policies
CREATE POLICY "Users can view their own quiz attempts" ON public.quiz_attempts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own quiz attempts" ON public.quiz_attempts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all quiz attempts" ON public.quiz_attempts
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = ANY(ARRAY['admin', 'superadmin'])
  ));

CREATE POLICY "Mentors can view assigned student quiz attempts" ON public.quiz_attempts
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'mentor' AND EXISTS (
      SELECT 1 FROM public.users students
      WHERE students.id = quiz_attempts.user_id AND students.mentor_id = auth.uid()
    )
  ));

-- Quiz Questions Policies
CREATE POLICY "Everyone can view quiz questions" ON public.quiz_questions
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage quiz questions" ON public.quiz_questions
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = ANY(ARRAY['admin', 'superadmin'])
  ));

-- Recording Views Policies
CREATE POLICY "Users can view their own recording views" ON public.recording_views
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own recording views" ON public.recording_views
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recording views" ON public.recording_views
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all recording views" ON public.recording_views
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = ANY(ARRAY['admin', 'superadmin'])
  ));

CREATE POLICY "Mentors can view assigned student recording views" ON public.recording_views
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'mentor' AND EXISTS (
      SELECT 1 FROM public.users students
      WHERE students.id = recording_views.user_id AND students.mentor_id = auth.uid()
    )
  ));

-- Session Attendance Policies
CREATE POLICY "Users can view their own session attendance" ON public.session_attendance
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own session attendance" ON public.session_attendance
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own session attendance" ON public.session_attendance
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all session attendance" ON public.session_attendance
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = ANY(ARRAY['admin', 'superadmin'])
  ));

CREATE POLICY "Mentors can view assigned student session attendance" ON public.session_attendance
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'mentor' AND EXISTS (
      SELECT 1 FROM public.users students
      WHERE students.id = session_attendance.user_id AND students.mentor_id = auth.uid()
    )
  ));

-- SMTP Configs Policies
CREATE POLICY "Only superadmins can view SMTP configs" ON public.smtp_configs
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'superadmin'
  ));

CREATE POLICY "Only superadmins can insert SMTP configs" ON public.smtp_configs
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'superadmin'
  ));

CREATE POLICY "Only superadmins can update SMTP configs" ON public.smtp_configs
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'superadmin'
  ));

CREATE POLICY "Only superadmins can delete SMTP configs" ON public.smtp_configs
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'superadmin'
  ));

-- Student Onboarding Jobs Policies
CREATE POLICY "Admins can view all onboarding jobs" ON public.student_onboarding_jobs
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = ANY(ARRAY['admin', 'superadmin'])
  ));

CREATE POLICY "System can manage onboarding jobs" ON public.student_onboarding_jobs
  FOR ALL USING (auth.role() = 'service_role');

-- Success Sessions Policies
CREATE POLICY "Everyone can view success sessions" ON public.success_sessions
  FOR SELECT USING (true);

CREATE POLICY "Superadmins and admins can insert success sessions" ON public.success_sessions
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = ANY(ARRAY['superadmin', 'admin'])
  ));

CREATE POLICY "Superadmins and admins can update success sessions" ON public.success_sessions
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = ANY(ARRAY['superadmin', 'admin'])
  ));

CREATE POLICY "Superadmins and admins can delete success sessions" ON public.success_sessions
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = ANY(ARRAY['superadmin', 'admin'])
  ));

-- Support Tickets Policies
CREATE POLICY "Users can view their own tickets" ON public.support_tickets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tickets" ON public.support_tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tickets" ON public.support_tickets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Staff can view all tickets" ON public.support_tickets
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = ANY(ARRAY['admin', 'superadmin', 'mentor'])
  ));

CREATE POLICY "Staff can update all tickets" ON public.support_tickets
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = ANY(ARRAY['admin', 'superadmin', 'mentor'])
  ));

-- Ticket Replies Policies
CREATE POLICY "Users can view replies for their tickets" ON public.ticket_replies
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.support_tickets 
    WHERE id = ticket_replies.ticket_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can reply to their own tickets" ON public.ticket_replies
  FOR INSERT WITH CHECK (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.support_tickets 
    WHERE id = ticket_replies.ticket_id AND user_id = auth.uid()
  ));

CREATE POLICY "Staff can view all ticket replies" ON public.ticket_replies
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = ANY(ARRAY['admin', 'superadmin', 'mentor'])
  ));

CREATE POLICY "Staff can reply to any ticket" ON public.ticket_replies
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = ANY(ARRAY['admin', 'superadmin', 'mentor'])
  ));

-- User Activity Logs Policies
CREATE POLICY "Users can view their own activity logs" ON public.user_activity_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all activity logs" ON public.user_activity_logs
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = ANY(ARRAY['admin', 'superadmin'])
  ));

CREATE POLICY "System can create activity logs" ON public.user_activity_logs
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Users Policies
CREATE POLICY "Users can view their own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all users" ON public.users
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = ANY(ARRAY['admin', 'superadmin'])
  ));

CREATE POLICY "Admins can update all users" ON public.users
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = ANY(ARRAY['admin', 'superadmin'])
  ));

CREATE POLICY "Admins can create users" ON public.users
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = ANY(ARRAY['admin', 'superadmin'])
  ));

CREATE POLICY "Mentors can view their assigned students" ON public.users
  FOR SELECT USING (
    auth.uid() = mentor_id OR 
    (auth.uid() = id AND role = 'mentor')
  );

-- =========================================
-- INDEXES FOR PERFORMANCE
-- =========================================

CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_student_id ON public.users(student_id);
CREATE INDEX IF NOT EXISTS idx_users_mentor_id ON public.users(mentor_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_user_id ON public.assignment_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_assignment_id ON public.assignment_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_recording_views_user_id ON public.recording_views(user_id);
CREATE INDEX IF NOT EXISTS idx_recording_views_recording_id ON public.recording_views(recording_id);
CREATE INDEX IF NOT EXISTS idx_available_lessons_module ON public.available_lessons(module);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_installment_payments_user_id ON public.installment_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_student_onboarding_jobs_student_id ON public.student_onboarding_jobs(student_id);

-- =========================================
-- INITIAL DATA
-- =========================================

-- Insert default company settings
INSERT INTO public.company_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- =========================================
-- COMPLETION MESSAGE
-- =========================================

DO $$
BEGIN
  RAISE NOTICE 'Database migration completed successfully!';
  RAISE NOTICE 'Tables created: 30+';
  RAISE NOTICE 'Functions created: 15+';
  RAISE NOTICE 'Policies created: 100+';
  RAISE NOTICE 'All RLS policies enabled';
END $$;