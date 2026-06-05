ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS onboarding_video_enabled BOOLEAN NOT NULL DEFAULT true;