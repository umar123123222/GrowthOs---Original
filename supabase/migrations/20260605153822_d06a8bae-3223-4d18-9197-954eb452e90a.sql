ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS onboarding_pointers JSONB NOT NULL DEFAULT '[]'::jsonb;