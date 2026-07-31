CREATE TABLE public.security_incidents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  signal TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  action_taken TEXT NOT NULL DEFAULT 'warned',
  user_agent TEXT,
  device_label TEXT,
  ip_address TEXT,
  page_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.security_incidents TO authenticated;
GRANT ALL ON public.security_incidents TO service_role;

ALTER TABLE public.security_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view security incidents"
ON public.security_incidents
FOR SELECT
TO authenticated
USING (public.get_my_role() IN ('admin','superadmin'));

CREATE INDEX idx_security_incidents_user_created ON public.security_incidents (user_id, created_at DESC);

CREATE TRIGGER update_security_incidents_updated_at
BEFORE UPDATE ON public.security_incidents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();