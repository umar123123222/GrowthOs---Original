ALTER TABLE public.student_sessions
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS geo_accuracy_m double precision,
  ADD COLUMN IF NOT EXISTS geo_source text;