
-- Phase 2.1: additive snapshot columns on enrollments
ALTER TABLE public.course_enrollments
  ADD COLUMN IF NOT EXISTS snapshot_price numeric,
  ADD COLUMN IF NOT EXISTS snapshot_currency text,
  ADD COLUMN IF NOT EXISTS snapshot_source text,
  ADD COLUMN IF NOT EXISTS snapshot_taken_at timestamptz;

-- Backfill: pathway price wins when pathway_id present, else course price, else total_amount
UPDATE public.course_enrollments ce
SET
  snapshot_price = COALESCE(p.price, c.price, ce.total_amount),
  snapshot_currency = COALESCE(p.currency, c.currency, 'PKR'),
  snapshot_source = CASE
    WHEN ce.pathway_id IS NOT NULL AND p.price IS NOT NULL THEN 'pathway'
    WHEN c.price IS NOT NULL THEN 'course'
    ELSE 'legacy_total'
  END,
  snapshot_taken_at = COALESCE(ce.enrolled_at, ce.created_at, now())
FROM public.course_enrollments ce2
LEFT JOIN public.learning_pathways p ON p.id = ce2.pathway_id
LEFT JOIN public.courses c ON c.id = ce2.course_id
WHERE ce.id = ce2.id
  AND ce.snapshot_price IS NULL;

-- Helpful index for drift scans (optional but cheap)
CREATE INDEX IF NOT EXISTS idx_course_enrollments_snapshot_price
  ON public.course_enrollments (student_id)
  WHERE snapshot_price IS NOT NULL;
