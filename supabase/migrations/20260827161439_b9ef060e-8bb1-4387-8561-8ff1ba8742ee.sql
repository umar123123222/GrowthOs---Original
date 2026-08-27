CREATE INDEX IF NOT EXISTS idx_notifications_cleanup ON public.notifications (created_at);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON public.error_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON public.admin_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_created_at ON public.user_activity_logs (created_at);

CREATE OR REPLACE FUNCTION public.cleanup_old_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int;
  batches int;
BEGIN
  -- Read notifications older than 60 days (max 4 batches x 50k per run)
  batches := 0;
  LOOP
    DELETE FROM public.notifications WHERE id IN (
      SELECT id FROM public.notifications
      WHERE read_at IS NOT NULL AND created_at < now() - interval '60 days'
      LIMIT 50000);
    GET DIAGNOSTICS n = ROW_COUNT;
    batches := batches + 1;
    EXIT WHEN n = 0 OR batches >= 4;
  END LOOP;

  -- Unread notifications older than 180 days
  batches := 0;
  LOOP
    DELETE FROM public.notifications WHERE id IN (
      SELECT id FROM public.notifications
      WHERE read_at IS NULL AND created_at < now() - interval '180 days'
      LIMIT 50000);
    GET DIAGNOSTICS n = ROW_COUNT;
    batches := batches + 1;
    EXIT WHEN n = 0 OR batches >= 4;
  END LOOP;

  -- Error logs older than 30 days
  batches := 0;
  LOOP
    DELETE FROM public.error_logs WHERE id IN (
      SELECT id FROM public.error_logs
      WHERE created_at < now() - interval '30 days'
      LIMIT 50000);
    GET DIAGNOSTICS n = ROW_COUNT;
    batches := batches + 1;
    EXIT WHEN n = 0 OR batches >= 4;
  END LOOP;

  -- User activity logs older than 365 days
  batches := 0;
  LOOP
    DELETE FROM public.user_activity_logs WHERE id IN (
      SELECT id FROM public.user_activity_logs
      WHERE created_at < now() - interval '365 days'
      LIMIT 50000);
    GET DIAGNOSTICS n = ROW_COUNT;
    batches := batches + 1;
    EXIT WHEN n = 0 OR batches >= 4;
  END LOOP;

  -- Admin logs older than 365 days
  batches := 0;
  LOOP
    DELETE FROM public.admin_logs WHERE id IN (
      SELECT id FROM public.admin_logs
      WHERE created_at < now() - interval '365 days'
      LIMIT 50000);
    GET DIAGNOSTICS n = ROW_COUNT;
    batches := batches + 1;
    EXIT WHEN n = 0 OR batches >= 4;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_old_data() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule(
  'cleanup-old-data',
  '*/15 * * * *',
  $$SELECT public.cleanup_old_data();$$
);