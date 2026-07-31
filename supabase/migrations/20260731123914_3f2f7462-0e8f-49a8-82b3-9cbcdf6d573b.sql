CREATE TABLE public.security_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  signal_type text NOT NULL,
  video_id text,
  session_id text NOT NULL,
  page_url text,
  device_label text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  dismissed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.security_signals TO authenticated;
GRANT ALL ON public.security_signals TO service_role;

ALTER TABLE public.security_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can log their own security signals"
ON public.security_signals FOR INSERT TO authenticated
WITH CHECK (student_id = auth.uid());

CREATE POLICY "Admins can view security signals"
ON public.security_signals FOR SELECT TO authenticated
USING (public.get_my_role() IN ('admin','superadmin'));

CREATE POLICY "Admins can update security signals"
ON public.security_signals FOR UPDATE TO authenticated
USING (public.get_my_role() IN ('admin','superadmin'))
WITH CHECK (public.get_my_role() IN ('admin','superadmin'));

CREATE INDEX idx_security_signals_student_created ON public.security_signals (student_id, created_at DESC);
CREATE INDEX idx_security_signals_session ON public.security_signals (session_id);