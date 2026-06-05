ALTER TABLE public.company_settings 
  ADD COLUMN IF NOT EXISTS billing_email_cc TEXT,
  ADD COLUMN IF NOT EXISTS notification_email_cc TEXT;