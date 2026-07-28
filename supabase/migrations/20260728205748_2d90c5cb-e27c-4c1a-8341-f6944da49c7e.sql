
CREATE OR REPLACE FUNCTION public.enforce_enrollment_target_consistency()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.enrollment_source = 'pathway' AND NEW.pathway_id IS NULL THEN
    RAISE EXCEPTION 'Pathway enrollment requires pathway_id (student_id=%, course_id=%)',
      NEW.student_id, NEW.course_id
      USING ERRCODE = '23514';
  END IF;

  IF NEW.course_id IS NULL AND NEW.pathway_id IS NULL THEN
    RAISE EXCEPTION 'Enrollment must have either course_id or pathway_id (student_id=%)',
      NEW.student_id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_enrollment_target_consistency_trg ON public.course_enrollments;
CREATE TRIGGER enforce_enrollment_target_consistency_trg
BEFORE INSERT ON public.course_enrollments
FOR EACH ROW
EXECUTE FUNCTION public.enforce_enrollment_target_consistency();
