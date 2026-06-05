
-- 1) Table
CREATE TABLE IF NOT EXISTS public.student_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_token text NOT NULL,
  device_fingerprint text,
  user_agent text,
  device_label text,
  ip_address text,
  country text,
  city text,
  region text,
  current_activity jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, session_token)
);

CREATE INDEX IF NOT EXISTS student_sessions_user_idx ON public.student_sessions(user_id);
CREATE INDEX IF NOT EXISTS student_sessions_heartbeat_idx ON public.student_sessions(last_heartbeat_at DESC);
CREATE INDEX IF NOT EXISTS student_sessions_active_idx ON public.student_sessions(user_id, last_heartbeat_at DESC) WHERE ended_at IS NULL;

-- 2) GRANTs
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_sessions TO authenticated;
GRANT ALL ON public.student_sessions TO service_role;

-- 3) RLS
ALTER TABLE public.student_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own sessions"
ON public.student_sessions FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins view all sessions"
ON public.student_sessions FOR SELECT
TO authenticated
USING (
  public.get_my_role() IN ('admin','superadmin','support_member','mentor')
);

CREATE POLICY "Admins manage sessions"
ON public.student_sessions FOR DELETE
TO authenticated
USING (
  public.get_my_role() IN ('admin','superadmin')
);

CREATE POLICY "Admins update sessions"
ON public.student_sessions FOR UPDATE
TO authenticated
USING (
  public.get_my_role() IN ('admin','superadmin')
);

-- 4) updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_student_sessions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_student_sessions_updated_at ON public.student_sessions;
CREATE TRIGGER trg_student_sessions_updated_at
BEFORE UPDATE ON public.student_sessions
FOR EACH ROW EXECUTE FUNCTION public.touch_student_sessions_updated_at();

-- 5) sessions_revoked_at column on users
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS sessions_revoked_at timestamptz;

-- 6) View of concurrent active sessions (active = heartbeat within 90s, not ended)
CREATE OR REPLACE VIEW public.student_concurrent_sessions_v AS
SELECT
  s.user_id,
  count(*) AS active_device_count,
  count(DISTINCT COALESCE(s.country,'unknown') || '|' || COALESCE(s.city,'unknown')) AS distinct_locations,
  count(DISTINCT s.current_activity->>'recording_id') FILTER (WHERE s.current_activity->>'recording_id' IS NOT NULL) AS distinct_videos_now,
  max(s.last_heartbeat_at) AS last_heartbeat_at,
  jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'session_token', s.session_token,
      'device_label', s.device_label,
      'user_agent', s.user_agent,
      'ip_address', s.ip_address,
      'country', s.country,
      'city', s.city,
      'region', s.region,
      'current_activity', s.current_activity,
      'first_seen_at', s.first_seen_at,
      'last_heartbeat_at', s.last_heartbeat_at
    ) ORDER BY s.last_heartbeat_at DESC
  ) AS sessions
FROM public.student_sessions s
WHERE s.ended_at IS NULL
  AND s.last_heartbeat_at > now() - interval '90 seconds'
GROUP BY s.user_id
HAVING count(*) > 1;

GRANT SELECT ON public.student_concurrent_sessions_v TO authenticated;
GRANT SELECT ON public.student_concurrent_sessions_v TO service_role;
