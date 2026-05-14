
-- At-risk detection rules (single config row)
CREATE TABLE IF NOT EXISTS public.at_risk_rules (
  id INT PRIMARY KEY DEFAULT 1,
  no_login_days INT NOT NULL DEFAULT 0,
  stuck_recording_days INT NOT NULL DEFAULT 0,
  stuck_assignment_days INT NOT NULL DEFAULT 0,
  missed_sessions_count INT NOT NULL DEFAULT 0,
  configured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT at_risk_rules_singleton CHECK (id = 1)
);

INSERT INTO public.at_risk_rules (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.at_risk_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read at_risk_rules" ON public.at_risk_rules
  FOR SELECT TO authenticated
  USING (public.get_my_role() IN ('admin','superadmin','mentor','support_member'));

CREATE POLICY "Admins write at_risk_rules" ON public.at_risk_rules
  FOR ALL TO authenticated
  USING (public.get_my_role() IN ('admin','superadmin'))
  WITH CHECK (public.get_my_role() IN ('admin','superadmin'));

-- Per-student mentor assignment for at-risk follow-ups
CREATE TABLE IF NOT EXISTS public.student_mentor_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mentor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id)
);

ALTER TABLE public.student_mentor_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read student_mentor_assignments" ON public.student_mentor_assignments
  FOR SELECT TO authenticated
  USING (public.get_my_role() IN ('admin','superadmin','mentor','support_member'));

CREATE POLICY "Admins write student_mentor_assignments" ON public.student_mentor_assignments
  FOR ALL TO authenticated
  USING (public.get_my_role() IN ('admin','superadmin'))
  WITH CHECK (public.get_my_role() IN ('admin','superadmin'));
