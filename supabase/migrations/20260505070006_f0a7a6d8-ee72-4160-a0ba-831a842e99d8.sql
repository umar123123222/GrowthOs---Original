-- Bulk repair stale direct course enrollments when the same course belongs to an active pathway enrollment
WITH active_pathway_access AS (
  SELECT DISTINCT
    ce.student_id,
    ce.batch_id,
    ce.pathway_id,
    pc.course_id,
    ce.payment_status
  FROM public.course_enrollments ce
  JOIN public.pathway_courses pc ON pc.pathway_id = ce.pathway_id
  WHERE ce.status = 'active'
    AND ce.batch_id IS NOT NULL
    AND ce.pathway_id IS NOT NULL
), to_fix AS (
  SELECT
    ce.id AS enrollment_id,
    apa.student_id,
    apa.course_id,
    apa.batch_id,
    apa.pathway_id,
    apa.payment_status
  FROM public.course_enrollments ce
  JOIN active_pathway_access apa
    ON apa.student_id = ce.student_id
   AND apa.course_id = ce.course_id
  WHERE COALESCE(ce.status, '') <> 'active'
     OR ce.batch_id IS NULL
     OR ce.pathway_id IS NULL
     OR COALESCE(ce.enrollment_source, '') <> 'pathway'
)
UPDATE public.course_enrollments ce
SET
  status = 'active',
  batch_id = tf.batch_id,
  pathway_id = tf.pathway_id,
  enrollment_source = 'pathway',
  payment_status = COALESCE(NULLIF(ce.payment_status, 'pending'), tf.payment_status, ce.payment_status),
  updated_at = now()
FROM to_fix tf
WHERE ce.id = tf.enrollment_id;

-- Make the unlock RPC prefer an active pathway/batch context instead of stale direct enrollments
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
  SELECT s.id, s.fees_cleared, s.enrollment_date
  INTO v_student_id, v_fees_cleared, v_enrollment_date
  FROM students s
  WHERE s.user_id = p_user_id;

  IF v_student_id IS NULL THEN
    RETURN;
  END IF;

  -- Prefer a valid active direct/pathway course enrollment for this course.
  SELECT ce.batch_id, ce.pathway_id
  INTO v_batch_id, v_pathway_id
  FROM course_enrollments ce
  WHERE ce.student_id = v_student_id
    AND ce.course_id = p_course_id
    AND ce.status = 'active'
  ORDER BY
    (ce.batch_id IS NOT NULL) DESC,
    (ce.pathway_id IS NOT NULL) DESC,
    ce.enrolled_at DESC NULLS LAST,
    ce.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_batch_id IS NOT NULL OR v_pathway_id IS NOT NULL THEN
    v_has_course_access := true;
  END IF;

  -- If the student is enrolled in an active pathway/batch that contains this course,
  -- use that pathway as the access and payment context.
  IF v_batch_id IS NULL OR v_pathway_id IS NULL THEN
    SELECT ce.batch_id, ce.pathway_id
    INTO v_batch_id, v_pathway_id
    FROM course_enrollments ce
    JOIN pathway_courses pc ON pc.pathway_id = ce.pathway_id AND pc.course_id = p_course_id
    WHERE ce.student_id = v_student_id
      AND ce.status = 'active'
      AND ce.batch_id IS NOT NULL
      AND ce.pathway_id IS NOT NULL
    ORDER BY ce.enrolled_at DESC NULLS LAST, ce.created_at DESC NULLS LAST
    LIMIT 1;

    IF v_batch_id IS NOT NULL AND v_pathway_id IS NOT NULL THEN
      v_has_course_access := true;
    END IF;
  END IF;

  -- Direct batch-course fallback for non-pathway course access.
  IF v_batch_id IS NULL THEN
    SELECT ce.batch_id
    INTO v_batch_id
    FROM course_enrollments ce
    WHERE ce.student_id = v_student_id
      AND ce.status = 'active'
      AND ce.batch_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM batch_courses bc WHERE bc.batch_id = ce.batch_id AND bc.course_id = p_course_id)
    ORDER BY ce.enrolled_at DESC NULLS LAST, ce.created_at DESC NULLS LAST
    LIMIT 1;

    IF v_batch_id IS NOT NULL THEN
      v_has_course_access := true;
    END IF;
  END IF;

  IF v_batch_id IS NOT NULL THEN
    SELECT b.start_date INTO v_batch_start_date FROM batches b WHERE b.id = v_batch_id;
  END IF;

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

  IF v_batch_start_date IS NOT NULL THEN
    v_drip_base_date := v_batch_start_date::timestamptz;
  ELSIF v_enrollment_date IS NOT NULL THEN
    v_drip_base_date := v_enrollment_date;
  ELSE
    v_drip_base_date := now();
  END IF;

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
  LEFT JOIN LATERAL (
    SELECT ce.*
    FROM course_enrollments ce
    WHERE ce.course_id = c.id
      AND ce.student_id = v_student_id
      AND ce.status = 'active'
    ORDER BY
      (ce.batch_id IS NOT NULL) DESC,
      (ce.pathway_id IS NOT NULL) DESC,
      ce.enrolled_at DESC NULLS LAST,
      ce.created_at DESC NULLS LAST
    LIMIT 1
  ) ce ON true
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
  latest_current_submission AS (
    SELECT DISTINCT ON (sub.assignment_id)
      sub.assignment_id,
      sub.status
    FROM submissions sub
    WHERE sub.student_id = p_user_id
    ORDER BY sub.assignment_id, sub.version DESC NULLS LAST, sub.created_at DESC NULLS LAST
  ),
  latest_prev_submission AS (
    SELECT DISTINCT ON (sub.assignment_id)
      sub.assignment_id,
      sub.status
    FROM submissions sub
    WHERE sub.student_id = p_user_id
    ORDER BY sub.assignment_id, sub.version DESC NULLS LAST, sub.created_at DESC NULLS LAST
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
    LEFT JOIN latest_current_submission sub ON sub.assignment_id = pls.assignment_id
    LEFT JOIN latest_prev_submission prev_sub ON prev_sub.assignment_id = pls.prev_assignment_id
  )
  SELECT
    fs.id as recording_id,
    fs.recording_title::text,
    (
      CASE
        WHEN fs.manually_unlocked THEN true
        WHEN fs.current_watched THEN true
        WHEN fs.calculated_drip_date IS NOT NULL AND fs.calculated_drip_date > now() THEN false
        WHEN NOT v_has_course_access THEN false
        WHEN NOT COALESCE(v_fees_cleared, false) THEN false
        WHEN NOT v_sequential_enabled THEN true
        WHEN fs.seq_pos = 1 THEN true
        WHEN fs.prev_watched
             AND (fs.prev_assignment_id IS NULL OR fs.prev_assignment_status = 'approved') THEN true
        ELSE false
      END
    )::BOOLEAN as is_unlocked,
    CASE
      WHEN fs.manually_unlocked THEN 'manually_unlocked'
      WHEN fs.current_watched THEN 'already_watched'
      WHEN fs.calculated_drip_date IS NOT NULL AND fs.calculated_drip_date > now() THEN 'drip_locked'
      WHEN NOT v_has_course_access THEN 'not_started_yet'
      WHEN NOT COALESCE(v_fees_cleared, false) THEN 'not_started_yet'
      WHEN NOT v_sequential_enabled THEN 'sequential_disabled'
      WHEN fs.seq_pos = 1 THEN 'first_lesson'
      WHEN fs.prev_watched
           AND (fs.prev_assignment_id IS NULL OR fs.prev_assignment_status = 'approved')
           THEN 'requirements_met'
      ELSE 'locked'
    END::text as unlock_reason,
    fs.seq_pos::integer as sequence_position,
    CASE
      WHEN fs.manually_unlocked THEN NULL
      WHEN fs.current_watched THEN NULL
      WHEN fs.calculated_drip_date IS NOT NULL AND fs.calculated_drip_date > now() THEN 'drip_locked'
      WHEN NOT v_has_course_access THEN 'not_started_yet'
      WHEN NOT COALESCE(v_fees_cleared, false) THEN 'not_started_yet'
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