CREATE UNIQUE INDEX IF NOT EXISTS success_sessions_unique_link_start
ON public.success_sessions (link, start_time)
WHERE link IS NOT NULL AND link <> '';