ALTER TABLE public.user_metrics
DROP CONSTRAINT IF EXISTS user_metrics_source_check;

ALTER TABLE public.user_metrics
ADD CONSTRAINT user_metrics_source_check
CHECK (source = ANY (ARRAY['shopify'::text, 'meta_ads'::text, 'lms'::text]));