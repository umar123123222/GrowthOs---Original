
CREATE OR REPLACE FUNCTION public.fill_enrollment_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_price numeric;
  v_currency text;
  v_source text;
BEGIN
  -- Only act when snapshot not already provided by caller
  IF NEW.snapshot_price IS NOT NULL THEN
    IF NEW.snapshot_taken_at IS NULL THEN
      NEW.snapshot_taken_at := now();
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.pathway_id IS NOT NULL THEN
    SELECT price, currency INTO v_price, v_currency
    FROM public.learning_pathways WHERE id = NEW.pathway_id;
    IF v_price IS NOT NULL THEN
      v_source := 'pathway';
    END IF;
  END IF;

  IF v_price IS NULL AND NEW.course_id IS NOT NULL THEN
    SELECT price, currency INTO v_price, v_currency
    FROM public.courses WHERE id = NEW.course_id;
    IF v_price IS NOT NULL THEN
      v_source := 'course';
    END IF;
  END IF;

  IF v_price IS NULL AND NEW.total_amount IS NOT NULL THEN
    v_price := NEW.total_amount;
    v_source := 'legacy_total';
  END IF;

  NEW.snapshot_price := v_price;
  NEW.snapshot_currency := COALESCE(v_currency, 'PKR');
  NEW.snapshot_source := v_source;
  NEW.snapshot_taken_at := now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_enrollment_snapshot ON public.course_enrollments;
CREATE TRIGGER trg_fill_enrollment_snapshot
  BEFORE INSERT ON public.course_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.fill_enrollment_snapshot();
