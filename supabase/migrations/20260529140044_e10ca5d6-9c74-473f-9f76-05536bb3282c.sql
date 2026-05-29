-- Fix: update_course_progress should not flip pathway enrollments to 'completed'
-- when a single pathway step finishes. Pathway completion is owned by advance_pathway.
CREATE OR REPLACE FUNCTION public.update_course_progress(p_student_id uuid, p_course_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total_recordings integer;
  v_watched_recordings integer;
  v_progress integer;
  v_user_id uuid;
  v_is_pathway boolean;
BEGIN
  SELECT user_id INTO v_user_id FROM public.students WHERE id = p_student_id;

  SELECT COUNT(*) INTO v_total_recordings
  FROM public.available_lessons al
  JOIN public.modules m ON m.id = al.module
  WHERE m.course_id = p_course_id;

  SELECT COUNT(*) INTO v_watched_recordings
  FROM public.recording_views rv
  JOIN public.available_lessons al ON al.id = rv.recording_id
  JOIN public.modules m ON m.id = al.module
  WHERE rv.user_id = v_user_id
  AND rv.watched = true
  AND m.course_id = p_course_id;

  IF v_total_recordings > 0 THEN
    v_progress := ROUND((v_watched_recordings::numeric / v_total_recordings::numeric) * 100);
  ELSE
    v_progress := 0;
  END IF;

  -- Determine if this enrollment is part of a pathway
  SELECT (enrollment_source = 'pathway') INTO v_is_pathway
  FROM public.course_enrollments
  WHERE student_id = p_student_id AND course_id = p_course_id
  LIMIT 1;

  IF v_is_pathway THEN
    -- For pathway enrollments: ONLY update progress. Status is owned by advance_pathway.
    UPDATE public.course_enrollments
    SET progress_percentage = v_progress,
        updated_at = now()
    WHERE student_id = p_student_id AND course_id = p_course_id;
  ELSE
    -- Direct enrollments: keep original auto-complete behavior
    UPDATE public.course_enrollments
    SET progress_percentage = v_progress,
        completed_at = CASE WHEN v_progress = 100 THEN now() ELSE NULL END,
        status = CASE WHEN v_progress = 100 THEN 'completed' ELSE 'active' END,
        updated_at = now()
    WHERE student_id = p_student_id AND course_id = p_course_id;
  END IF;
END;
$function$;

-- Backfill: re-activate pathway enrollments incorrectly marked 'completed'
-- (current course is NOT the last step of their pathway).
WITH last_steps AS (
  SELECT pathway_id, MAX(step_number) AS max_step
  FROM public.pathway_courses
  GROUP BY pathway_id
),
to_revert AS (
  SELECT ce.id
  FROM public.course_enrollments ce
  JOIN public.pathway_courses pc
    ON pc.pathway_id = ce.pathway_id AND pc.course_id = ce.course_id
  JOIN last_steps ls ON ls.pathway_id = ce.pathway_id
  WHERE ce.enrollment_source = 'pathway'
    AND ce.status = 'completed'
    AND pc.step_number < ls.max_step
)
UPDATE public.course_enrollments
SET status = 'active',
    completed_at = NULL,
    updated_at = now()
WHERE id IN (SELECT id FROM to_revert);