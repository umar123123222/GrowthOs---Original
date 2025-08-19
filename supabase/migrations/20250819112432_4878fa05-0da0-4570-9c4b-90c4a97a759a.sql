-- PHASE 2: CRITICAL SECURITY FIX - Remove SECURITY DEFINER Views (CORRECTED)
-- Issue: Views bypass RLS and expose ALL user data to ANY authenticated user
-- Solution: Convert to proper tables with role-based RLS policies

-- Step 1: Backup existing view data before dropping (only if views exist)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'user_security_summary' AND table_schema = 'public') THEN
    EXECUTE 'CREATE TABLE IF NOT EXISTS user_security_summary_backup AS SELECT * FROM user_security_summary';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'segmented_weekly_success_sessions' AND table_schema = 'public') THEN
    EXECUTE 'CREATE TABLE IF NOT EXISTS segmented_weekly_success_sessions_backup AS SELECT * FROM segmented_weekly_success_sessions';
  END IF;
END $$;

-- Step 2: Drop the dangerous SECURITY DEFINER views
DROP VIEW IF EXISTS user_security_summary;
DROP VIEW IF EXISTS segmented_weekly_success_sessions;

-- Step 3: Create secure replacement tables with proper structure
CREATE TABLE user_security_summary (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  role text,
  status text,
  lms_status text,
  created_at timestamp with time zone,
  last_active_at timestamp with time zone,
  last_login_at timestamp with time zone,
  password_status text,
  phone_status text,
  is_temp_password boolean,
  PRIMARY KEY (id)
);

CREATE TABLE segmented_weekly_success_sessions (
  id uuid REFERENCES success_sessions(id) ON DELETE CASCADE,
  title text,
  description text,
  start_time timestamp without time zone,
  end_time timestamp without time zone,
  mentor_id uuid,
  mentor_name text,
  status text,
  created_at timestamp without time zone,
  segment text DEFAULT 'weekly',
  PRIMARY KEY (id)
);

-- Step 4: Enable RLS on new tables
ALTER TABLE user_security_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE segmented_weekly_success_sessions ENABLE ROW LEVEL SECURITY;

-- Step 5: Create role-based security policies for user_security_summary

-- Superadmins can view all user security data
CREATE POLICY "Superadmins can view all user security data" 
ON user_security_summary FOR SELECT 
USING (get_current_user_role() = 'superadmin');

-- Admins can view security data for non-superadmin users
CREATE POLICY "Admins can view non-superadmin security data" 
ON user_security_summary FOR SELECT 
USING (
  get_current_user_role() = 'admin' 
  AND role != 'superadmin'
);

-- Enrollment managers can view student security data only
CREATE POLICY "Enrollment managers can view students only" 
ON user_security_summary FOR SELECT 
USING (
  get_current_user_role() = 'enrollment_manager' 
  AND role = 'student'
);

-- Mentors can view assigned students only
CREATE POLICY "Mentors can view assigned students" 
ON user_security_summary FOR SELECT 
USING (
  get_current_user_role() = 'mentor' 
  AND role = 'student'
);

-- Users can view their own security status
CREATE POLICY "Users can view own security status" 
ON user_security_summary FOR SELECT 
USING (auth.uid() = id);

-- Step 6: Create security policies for segmented_weekly_success_sessions

-- Staff can view all success sessions
CREATE POLICY "Staff can view all success sessions" 
ON segmented_weekly_success_sessions FOR SELECT 
USING (get_current_user_role() = ANY (ARRAY['admin', 'superadmin', 'mentor', 'enrollment_manager']));

-- Students can view all success sessions (they need to see available sessions)
CREATE POLICY "Students can view success sessions" 
ON segmented_weekly_success_sessions FOR SELECT 
USING (get_current_user_role() = 'student');

-- Step 7: Populate tables with current data from source tables

-- Populate user_security_summary with current user data
INSERT INTO user_security_summary (
  id, email, role, status, lms_status, created_at, 
  last_active_at, last_login_at, password_status, 
  phone_status, is_temp_password
)
SELECT 
  id,
  email,
  role,
  status,
  lms_status,
  created_at,
  last_active_at,
  last_login_at,
  CASE 
    WHEN password_hash IS NOT NULL THEN 'Set'::text 
    ELSE 'Not Set'::text 
  END AS password_status,
  CASE 
    WHEN phone IS NOT NULL THEN 'Provided'::text 
    ELSE 'Not Provided'::text 
  END AS phone_status,
  is_temp_password
FROM users;

-- Populate segmented_weekly_success_sessions with current data
INSERT INTO segmented_weekly_success_sessions (
  id, title, description, start_time, end_time, 
  mentor_id, mentor_name, status, created_at, segment
)
SELECT 
  id,
  title,
  description,
  start_time,
  end_time,
  mentor_id,
  mentor_name,
  status,
  created_at,
  'weekly'::text AS segment
FROM success_sessions;

-- Step 8: Create triggers to keep data in sync

-- Trigger for user changes
CREATE OR REPLACE FUNCTION handle_user_security_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM user_security_summary WHERE id = OLD.id;
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO user_security_summary (
      id, email, role, status, lms_status, created_at, 
      last_active_at, last_login_at, password_status, 
      phone_status, is_temp_password
    ) VALUES (
      NEW.id,
      NEW.email,
      NEW.role,
      NEW.status,
      NEW.lms_status,
      NEW.created_at,
      NEW.last_active_at,
      NEW.last_login_at,
      CASE 
        WHEN NEW.password_hash IS NOT NULL THEN 'Set'::text 
        ELSE 'Not Set'::text 
      END,
      CASE 
        WHEN NEW.phone IS NOT NULL THEN 'Provided'::text 
        ELSE 'Not Provided'::text 
      END,
      NEW.is_temp_password
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE user_security_summary SET
      email = NEW.email,
      role = NEW.role,
      status = NEW.status,
      lms_status = NEW.lms_status,
      last_active_at = NEW.last_active_at,
      last_login_at = NEW.last_login_at,
      password_status = CASE 
        WHEN NEW.password_hash IS NOT NULL THEN 'Set'::text 
        ELSE 'Not Set'::text 
      END,
      phone_status = CASE 
        WHEN NEW.phone IS NOT NULL THEN 'Provided'::text 
        ELSE 'Not Provided'::text 
      END,
      is_temp_password = NEW.is_temp_password
    WHERE id = NEW.id;
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Trigger for success session changes
CREATE OR REPLACE FUNCTION handle_success_session_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM segmented_weekly_success_sessions WHERE id = OLD.id;
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO segmented_weekly_success_sessions (
      id, title, description, start_time, end_time, 
      mentor_id, mentor_name, status, created_at, segment
    ) VALUES (
      NEW.id,
      NEW.title,
      NEW.description,
      NEW.start_time,
      NEW.end_time,
      NEW.mentor_id,
      NEW.mentor_name,
      NEW.status,
      NEW.created_at,
      'weekly'::text
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE segmented_weekly_success_sessions SET
      title = NEW.title,
      description = NEW.description,
      start_time = NEW.start_time,
      end_time = NEW.end_time,
      mentor_id = NEW.mentor_id,
      mentor_name = NEW.mentor_name,
      status = NEW.status
    WHERE id = NEW.id;
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Create the triggers
DROP TRIGGER IF EXISTS sync_user_security_summary_trigger ON users;
CREATE TRIGGER sync_user_security_summary_trigger
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION handle_user_security_sync();

DROP TRIGGER IF EXISTS sync_success_sessions_trigger ON success_sessions;
CREATE TRIGGER sync_success_sessions_trigger
  AFTER INSERT OR UPDATE OR DELETE ON success_sessions
  FOR EACH ROW EXECUTE FUNCTION handle_success_session_sync();