ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS onboarding_document_url TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_document_name TEXT;