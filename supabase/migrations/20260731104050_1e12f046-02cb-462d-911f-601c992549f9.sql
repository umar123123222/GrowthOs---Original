CREATE TABLE public.video_access_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  recording_id UUID,
  event_type TEXT NOT NULL DEFAULT 'open',
  session_id TEXT,
  user_agent TEXT,
  device_label TEXT,
  ip_address TEXT,
  page_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.video_access_events TO authenticated;
GRANT ALL ON public.video_access_events TO service_role;

ALTER TABLE public.video_access_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can record their own video access events"
ON public.video_access_events
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view video access events"
ON public.video_access_events
FOR SELECT
TO authenticated
USING (public.get_my_role() IN ('admin','superadmin'));

CREATE INDEX idx_video_access_events_user_created ON public.video_access_events (user_id, created_at DESC);
CREATE INDEX idx_video_access_events_recording ON public.video_access_events (recording_id, created_at DESC);