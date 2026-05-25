-- 1. Add 'viewer' value to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'viewer';

-- Note: The `users.role` column is a TEXT field (not the enum), so 'viewer' is
-- automatically accepted there. We grant viewer read-only access on the tables
-- powering the allowed pages: dashboard, recordings, resources, submissions,
-- success sessions, students management, and batches.

-- 2. Read-only SELECT policies for viewer role.
-- We use get_my_role() / has_role to avoid RLS recursion.

-- Users (students management lists)
CREATE POLICY "Viewers can read users"
ON public.users FOR SELECT TO authenticated
USING (public.get_my_role() = 'viewer');

-- Students
CREATE POLICY "Viewers can read students"
ON public.students FOR SELECT TO authenticated
USING (public.get_my_role() = 'viewer');

-- Batches & batch junctions & timeline
CREATE POLICY "Viewers can read batches"
ON public.batches FOR SELECT TO authenticated
USING (public.get_my_role() = 'viewer');

CREATE POLICY "Viewers can read batch_courses"
ON public.batch_courses FOR SELECT TO authenticated
USING (public.get_my_role() = 'viewer');

CREATE POLICY "Viewers can read batch_pathways"
ON public.batch_pathways FOR SELECT TO authenticated
USING (public.get_my_role() = 'viewer');

CREATE POLICY "Viewers can read batch_timeline_items"
ON public.batch_timeline_items FOR SELECT TO authenticated
USING (public.get_my_role() = 'viewer');

-- Recordings / available_lessons + modules + courses + pathways
CREATE POLICY "Viewers can read available_lessons"
ON public.available_lessons FOR SELECT TO authenticated
USING (public.get_my_role() = 'viewer');

CREATE POLICY "Viewers can read modules"
ON public.modules FOR SELECT TO authenticated
USING (public.get_my_role() = 'viewer');

CREATE POLICY "Viewers can read courses"
ON public.courses FOR SELECT TO authenticated
USING (public.get_my_role() = 'viewer');

CREATE POLICY "Viewers can read learning_pathways"
ON public.learning_pathways FOR SELECT TO authenticated
USING (public.get_my_role() = 'viewer');

CREATE POLICY "Viewers can read course_enrollments"
ON public.course_enrollments FOR SELECT TO authenticated
USING (public.get_my_role() = 'viewer');

-- Assignments + submissions (Submissions page)
CREATE POLICY "Viewers can read assignments"
ON public.assignments FOR SELECT TO authenticated
USING (public.get_my_role() = 'viewer');

-- assignment submissions table may have varying name; common is submissions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='submissions') THEN
    EXECUTE 'CREATE POLICY "Viewers can read submissions" ON public.submissions FOR SELECT TO authenticated USING (public.get_my_role() = ''viewer'')';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='assignment_submissions') THEN
    EXECUTE 'CREATE POLICY "Viewers can read assignment_submissions" ON public.assignment_submissions FOR SELECT TO authenticated USING (public.get_my_role() = ''viewer'')';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='success_sessions') THEN
    EXECUTE 'CREATE POLICY "Viewers can read success_sessions" ON public.success_sessions FOR SELECT TO authenticated USING (public.get_my_role() = ''viewer'')';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='resources') THEN
    EXECUTE 'CREATE POLICY "Viewers can read resources" ON public.resources FOR SELECT TO authenticated USING (public.get_my_role() = ''viewer'')';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='company_settings') THEN
    EXECUTE 'CREATE POLICY "Viewers can read company_settings" ON public.company_settings FOR SELECT TO authenticated USING (public.get_my_role() = ''viewer'')';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='user_unlocks') THEN
    EXECUTE 'CREATE POLICY "Viewers can read user_unlocks" ON public.user_unlocks FOR SELECT TO authenticated USING (public.get_my_role() = ''viewer'')';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='invoices') THEN
    EXECUTE 'CREATE POLICY "Viewers can read invoices" ON public.invoices FOR SELECT TO authenticated USING (public.get_my_role() = ''viewer'')';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='admin_logs') THEN
    EXECUTE 'CREATE POLICY "Viewers can read admin_logs" ON public.admin_logs FOR SELECT TO authenticated USING (public.get_my_role() = ''viewer'')';
  END IF;
END $$;