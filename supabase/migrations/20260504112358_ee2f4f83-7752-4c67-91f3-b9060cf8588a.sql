
CREATE OR REPLACE FUNCTION public.get_course_sequential_unlock_status(p_user_id uuid, p_course_id uuid)
 RETURNS TABLE(recording_id uuid, recording_title text, is_unlocked boolean, unlock_reason text, sequence_position integer, lock_reason text, drip_unlock_date timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sequential_enabled BOOLEAN;
  v_drip_enabled BOOLEAN;
  v_drip_base_date TIMESTAMPTZ;
  v_fees_cleared BOOLEAN;
  v_student_id UUID;
  v_enrollment_date TIMESTAMPTZ;
  v_batch_id UUID;
  v_batch_start_date DATE;
  v_first_installment_paid BOOLEAN;
  v_pathway_id UUID;
  v_has_course_access BOOLEAN := false;
BEGIN
  -- Get student info
  SELECT s.id, s.fees_cleared, s.enrollment_date
  INTO v_student_id, v_fees_cleared, v_enrollment_date
  FROM students s
  WHERE s.user_id = p_user_id;

  IF v_student_id IS NULL THEN
    RETURN;
  END IF;

  -- 1. Try direct course enrollment first
  SELECT ce.batch_id, ce.pathway_id
  INTO v_batch_id, v_pathway_id
  FROM course_enrollments ce
  WHERE ce.student_id = v_student_id AND ce.course_id = p_course_id
  LIMIT 1;

  IF v_batch_id IS NOT NULL OR v_pathway_id IS NOT NULL THEN
    v_has_course_access := true;
  END IF;

  -- 2. Fallback: derive batch from any enrollment whose batch contains this course
  --    via batch_courses (direct course-in-batch) or batch_pathways → pathway_courses.
  IF v_batch_id IS NULL THEN
    SELECT ce.batch_id
    INTO v_batch_id
    FROM course_enrollments ce
    WHERE ce.student_id = v_student_id
      AND ce.batch_id IS NOT NULL
      AND (
        EXISTS (SELECT 1 FROM batch_courses bc WHERE bc.batch_id = ce.batch_id AND bc.course_id = p_course_id)
        OR EXISTS (
          SELECT 1 FROM batch_pathways bp
          JOIN pathway_courses pc ON pc.pathway_id = bp.pathway_id
          WHERE bp.batch_id = ce.batch_id AND pc.course_id = p_course_id
        )
      )
    ORDER BY ce.enrolled_at DESC NULLS LAST
    LIMIT 1;

    IF v_batch_id IS NOT NULL THEN
      v_has_course_access := true;
    END IF;
  END IF;

  -- Resolve batch start date
  IF v_batch_id IS NOT NULL THEN
    SELECT b.start_date INTO v_batch_start_date FROM batches b WHERE b.id = v_batch_id;
  END IF;

  -- Fee check (first installment paid OR legacy fees_cleared)
  IF v_pathway_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.student_id = v_student_id
        AND i.pathway_id = v_pathway_id
        AND i.installment_number = 1
        AND i.status = 'paid'
    ) INTO v_first_installment_paid;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.student_id = v_student_id
        AND i.course_id = p_course_id
        AND i.installment_number = 1
        AND i.status = 'paid'
    ) INTO v_first_installment_paid;
  END IF;
  v_fees_cleared := COALESCE(v_first_installment_paid, false) OR COALESCE(v_fees_cleared, false);

  -- Determine drip base date: batch start > enrollment date > now()
  IF v_batch_start_date IS NOT NULL THEN
    v_drip_base_date := v_batch_start_date::timestamptz;
  ELSIF v_enrollment_date IS NOT NULL THEN
    v_drip_base_date := v_enrollment_date;
  ELSE
    v_drip_base_date := now();
  END IF;

  -- Resolve sequential & drip flags (enrollment override > course > global default)
  SELECT
    COALESCE(
      CASE WHEN ce.sequential_override = true THEN ce.sequential_enabled ELSE NULL END,
      (SELECT lms_sequential_unlock FROM company_settings LIMIT 1),
      true
    ),
    COALESCE(
      CASE WHEN ce.drip_override = true THEN ce.drip_enabled ELSE NULL END,
      c.drip_enabled,
      (SELECT drip_enabled_default FROM company_settings LIMIT 1),
      false
    )
  INTO v_sequential_enabled, v_drip_enabled
  FROM courses c
  LEFT JOIN course_enrollments ce ON ce.course_id = c.id AND ce.student_id = v_student_id
  WHERE c.id = p_course_id;

  RETURN QUERY
  WITH ordered_lessons AS (
    SELECT
      al.id,
      al.recording_title,
      al.sequence_order,
      al.drip_days,
      al.assignment_id,
      m."order" as module_order,
      ROW_NUMBER() OVER (ORDER BY m."order" NULLS LAST, al.sequence_order NULLS LAST, al.id) as seq_pos
    FROM available_lessons al
    INNER JOIN modules m ON m.id = al.module AND m.course_id = p_course_id
  ),
  prev_lesson_status AS (
    SELECT
      ol.*,
      LAG(ol.id) OVER (ORDER BY ol.seq_pos) as prev_lesson_id,
      LAG(ol.assignment_id) OVER (ORDER BY ol.seq_pos) as prev_assignment_id
    FROM ordered_lessons ol
  ),
  full_status AS (
    SELECT
      pls.id,
      pls.recording_title,
      pls.seq_pos,
      pls.drip_days,
      pls.assignment_id,
      pls.prev_lesson_id,
      pls.prev_assignment_id,
      COALESCE(uu.is_unlocked, false) as manually_unlocked,
      COALESCE(rv.watched, false) as prev_watched,
      COALESCE(curr_rv.watched, false) as current_watched,
      prev_sub.status as prev_assignment_status,
      sub.status as current_assignment_status,
      CASE
        WHEN v_drip_enabled AND pls.drip_days IS NOT NULL THEN
          v_drip_base_date + (pls.drip_days || ' days')::interval
        ELSE NULL
      END as calculated_drip_date
    FROM prev_lesson_status pls
    LEFT JOIN user_unlocks uu ON uu.recording_id = pls.id AND uu.user_id = p_user_id
    LEFT JOIN recording_views rv ON rv.recording_id = pls.prev_lesson_id AND rv.user_id = p_user_id
    LEFT JOIN recording_views curr_rv ON curr_rv.recording_id = pls.id AND curr_rv.user_id = p_user_id
    LEFT JOIN submissions sub ON sub.assignment_id = pls.assignment_id AND sub.student_id = p_user_id
    LEFT JOIN submissions prev_sub ON prev_sub.assignment_id = pls.prev_assignment_id AND prev_sub.student_id = p_user_id
  )
  SELECT
    fs.id as recording_id,
    fs.recording_title::text,
    (
      -- Already watched OR manually unlocked: always accessible (don't strip earned access)
      fs.current_watched
      OR fs.manually_unlocked
      -- Otherwise the student must have access to this course AND fees + drip + sequential rules pass
      OR (
        v_has_course_access
        AND COALESCE(v_fees_cleared, false)
        AND (fs.calculated_drip_date IS NULL OR fs.calculated_drip_date <= now())
        AND (
          NOT v_sequential_enabled
          OR fs.seq_pos = 1
          OR (
            fs.prev_watched
            AND (fs.prev_assignment_id IS NULL OR fs.prev_assignment_status = 'approved')
          )
        )
      )
    )::BOOLEAN as is_unlocked,
    CASE
      WHEN fs.current_watched THEN 'already_watched'
      WHEN fs.manually_unlocked THEN 'manually_unlocked'
      WHEN NOT v_has_course_access THEN 'not_enrolled'
      WHEN NOT COALESCE(v_fees_cleared, false) THEN 'fees_not_cleared'
      WHEN fs.calculated_drip_date IS NOT NULL AND fs.calculated_drip_date > now() THEN 'drip_locked'
      WHEN NOT v_sequential_enabled THEN 'sequential_disabled'
      WHEN fs.seq_pos = 1 THEN 'first_lesson'
      WHEN fs.prev_watched
           AND (fs.prev_assignment_id IS NULL OR fs.prev_assignment_status = 'approved')
           THEN 'requirements_met'
      ELSE 'locked'
    END::text as unlock_reason,
    fs.seq_pos::integer as sequence_position,
    CASE
      WHEN fs.current_watched THEN NULL
      WHEN fs.manually_unlocked THEN NULL
      WHEN NOT v_has_course_access THEN 'not_enrolled'
      WHEN NOT COALESCE(v_fees_cleared, false) THEN 'fees_not_cleared'
      WHEN fs.calculated_drip_date IS NOT NULL AND fs.calculated_drip_date > now() THEN 'drip_locked'
      WHEN v_sequential_enabled AND fs.seq_pos > 1 AND NOT fs.prev_watched THEN 'previous_lesson_not_watched'
      WHEN v_sequential_enabled AND fs.seq_pos > 1 AND fs.prev_assignment_id IS NOT NULL AND fs.prev_assignment_status IS NULL THEN 'previous_assignment_not_submitted'
      WHEN v_sequential_enabled AND fs.seq_pos > 1 AND fs.prev_assignment_id IS NOT NULL AND fs.prev_assignment_status != 'approved' THEN 'previous_assignment_not_approved'
      ELSE NULL
    END::text as lock_reason,
    fs.calculated_drip_date as drip_unlock_date
  FROM full_status fs
  ORDER BY fs.seq_pos;
END;
$function$;
