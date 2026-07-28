
CREATE OR REPLACE FUNCTION public.prevent_duplicate_enrollment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_id uuid;
BEGIN
  IF NEW.pathway_id IS NOT NULL THEN
    SELECT id INTO existing_id
    FROM public.course_enrollments
    WHERE student_id = NEW.student_id
      AND pathway_id = NEW.pathway_id
    LIMIT 1;

    IF existing_id IS NOT NULL THEN
      RAISE EXCEPTION 'DUPLICATE_ENROLLMENT: student % is already enrolled in pathway % (existing enrollment %)',
        NEW.student_id, NEW.pathway_id, existing_id
        USING ERRCODE = 'unique_violation';
    END IF;

  ELSIF NEW.course_id IS NOT NULL THEN
    SELECT id INTO existing_id
    FROM public.course_enrollments
    WHERE student_id = NEW.student_id
      AND course_id = NEW.course_id
      AND pathway_id IS NULL
    LIMIT 1;

    IF existing_id IS NOT NULL THEN
      RAISE EXCEPTION 'DUPLICATE_ENROLLMENT: student % is already enrolled in course % (existing enrollment %)',
        NEW.student_id, NEW.course_id, existing_id
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_duplicate_enrollment_trg ON public.course_enrollments;
CREATE TRIGGER prevent_duplicate_enrollment_trg
BEFORE INSERT ON public.course_enrollments
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_enrollment();
