CREATE OR REPLACE FUNCTION public.get_sequential_unlock_status(p_user_id uuid)
 RETURNS TABLE(recording_id uuid, sequence_order integer, is_unlocked boolean, unlock_reason text, assignment_required boolean, assignment_completed boolean, recording_watched boolean, drip_locked boolean, drip_unlock_date timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_fees_cleared boolean;
  v_global_sequential_enabled boolean;
  v_global_drip_enabled boolean;
BEGIN
  SELECT s.fees_cleared INTO v_fees_cleared FROM students s WHERE s.user_id = p_user_id;

  SELECT COALESCE(cs.lms_sequential_unlock, false), COALESCE(cs.drip_enabled_default, false)
  INTO v_global_sequential_enabled, v_global_drip_enabled
  FROM company_settings cs WHERE cs.id = 1;

  RETURN QUERY
  WITH
  enrollment_courses AS (
    SELECT ce.id AS enrollment_id, ce.course_id AS direct_course_id, ce.pathway_id, ce.batch_id,
           ce.enrolled_at, ce.drip_override, ce.drip_enabled, ce.sequential_override, ce.sequential_enabled,
           x.course_id AS course_id
    FROM course_enrollments ce
    JOIN students s ON s.id = ce.student_id
    CROSS JOIN LATERAL (
      SELECT ce.course_id WHERE ce.course_id IS NOT NULL
      UNION
      SELECT pc.course_id FROM pathway_courses pc WHERE ce.pathway_id IS NOT NULL AND pc.pathway_id = ce.pathway_id
    ) x
    WHERE s.user_id = p_user_id AND ce.status = 'active' AND x.course_id IS NOT NULL
  ),
  lesson_enrollments AS (
    SELECT al.id AS rec_id, COALESCE(al.sequence_order, 0) AS seq_order, al.assignment_id,
           COALESCE(al.drip_days, 0) AS drip_days, m.course_id, ec.enrollment_id,
           COALESCE(b.start_date::timestamptz, ec.enrolled_at, now()) AS anchor_date,
           CASE WHEN ec.drip_override = true THEN COALESCE(ec.drip_enabled, false)
                ELSE COALESCE(c.drip_enabled, v_global_drip_enabled) END AS effective_drip_enabled,
           CASE WHEN ec.sequential_override = true THEN COALESCE(ec.sequential_enabled, false)
                ELSE v_global_sequential_enabled END AS effective_sequential_enabled,
           (ec.drip_override = true AND COALESCE(ec.drip_enabled, false) = false
            AND ec.sequential_override = true AND COALESCE(ec.sequential_enabled, false) = false) AS full_bypass
    FROM available_lessons al
    JOIN modules m ON m.id = al.module
    JOIN enrollment_courses ec ON ec.course_id = m.course_id
    LEFT JOIN courses c ON c.id = m.course_id
    LEFT JOIN batches b ON b.id = ec.batch_id
  ),
  lesson_picked AS (
    SELECT DISTINCT ON (rec_id) le.* FROM lesson_enrollments le
    ORDER BY le.rec_id, le.full_bypass DESC, le.anchor_date DESC NULLS LAST, le.enrollment_id
  ),
  recording_status AS (
    SELECT lp.*,
      EXISTS (SELECT 1 FROM recording_views rv WHERE rv.recording_id = lp.rec_id AND rv.user_id = p_user_id AND rv.watched = true) AS is_watched,
      EXISTS (SELECT 1 FROM submissions sub WHERE sub.assignment_id = lp.assignment_id AND sub.student_id = p_user_id AND sub.status = 'approved') AS is_assignment_done,
      EXISTS (SELECT 1 FROM user_unlocks uu WHERE uu.user_id = p_user_id AND uu.recording_id = lp.rec_id AND uu.is_unlocked = true) AS is_manually_unlocked
    FROM lesson_picked lp
  ),
  ordered_recordings AS (
    SELECT rs.*,
      ROW_NUMBER() OVER (PARTITION BY rs.course_id ORDER BY rs.seq_order NULLS LAST, rs.rec_id) AS row_num,
      -- Count of prior recordings in the same course that are NOT fully complete
      -- (not watched, OR have an assignment that is not approved)
      SUM(
        CASE
          WHEN (rs.is_watched = false) OR (rs.assignment_id IS NOT NULL AND rs.is_assignment_done = false)
          THEN 1 ELSE 0
        END
      ) OVER (
        PARTITION BY rs.course_id
        ORDER BY rs.seq_order NULLS LAST, rs.rec_id
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      ) AS prior_incomplete_count,
      rs.anchor_date + (rs.drip_days || ' days')::interval AS calc_drip_unlock_date,
      CASE WHEN rs.effective_drip_enabled = true
           THEN now() >= rs.anchor_date + (rs.drip_days || ' days')::interval
           ELSE true END AS drip_timing_met
    FROM recording_status rs
  )
  SELECT
    orr.rec_id::uuid,
    orr.seq_order::integer,
    CASE
      WHEN orr.full_bypass THEN true
      WHEN (v_fees_cleared IS NULL OR v_fees_cleared = false) THEN false
      WHEN orr.is_manually_unlocked THEN true
      WHEN orr.row_num = 1 THEN orr.drip_timing_met
      WHEN orr.effective_sequential_enabled THEN
        (COALESCE(orr.prior_incomplete_count, 0) = 0) AND orr.drip_timing_met
      ELSE orr.drip_timing_met
    END AS is_unlocked,
    CASE
      WHEN orr.full_bypass THEN 'Drip bypass enabled'
      WHEN (v_fees_cleared IS NULL OR v_fees_cleared = false) THEN 'Fees not cleared'
      WHEN orr.is_manually_unlocked THEN 'Manually unlocked'
      WHEN orr.row_num = 1 AND NOT orr.drip_timing_met THEN 'Available on ' || to_char(orr.calc_drip_unlock_date, 'Mon DD, YYYY')
      WHEN orr.row_num = 1 THEN 'First recording'
      WHEN NOT orr.drip_timing_met THEN 'Available on ' || to_char(orr.calc_drip_unlock_date, 'Mon DD, YYYY')
      WHEN orr.effective_sequential_enabled AND COALESCE(orr.prior_incomplete_count, 0) > 0 THEN
        'Complete previous recordings and assignments first'
      ELSE 'Unlocked'
    END::text AS unlock_reason,
    (orr.assignment_id IS NOT NULL),
    orr.is_assignment_done,
    orr.is_watched,
    (NOT orr.full_bypass AND orr.effective_drip_enabled = true AND NOT orr.drip_timing_met),
    CASE WHEN NOT orr.full_bypass AND orr.effective_drip_enabled = true AND NOT orr.drip_timing_met
         THEN orr.calc_drip_unlock_date ELSE NULL END
  FROM ordered_recordings orr
  ORDER BY orr.course_id, orr.seq_order NULLS LAST;
END;
$function$;