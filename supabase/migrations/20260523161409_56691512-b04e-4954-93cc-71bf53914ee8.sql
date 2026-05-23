ALTER TABLE public.recording_attachments
  ADD COLUMN IF NOT EXISTS resource_id uuid REFERENCES public.resources(id) ON DELETE SET NULL,
  ALTER COLUMN file_url DROP NOT NULL;