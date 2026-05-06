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
  -- Check if student has fees cleared
  SELECT s.fees_cleared INTO v_fees_cleared
  FROM students s
  WHERE s.user_id = p_user_id;

  -- Global defaults
  SELECT
    COALESCE(cs.lms_sequential_unlock, false),
    COALESCE(cs.drip_enabled_default, false)
  INTO v_global_sequential_enabled, v_global_drip_enabled
  FROM company_settings cs
  WHERE cs.id = 1;

  RETURN QUERY
  WITH
  lesson_enrollments AS (
    SELECT
      al.id           AS rec_id,
      COALESCE(al.sequence_order, 0) AS seq_order,
      al.assignment_id,
      COALESCE(al.drip_days, 0) AS drip_days,
      m.course_id     AS course_id,
      ce.id           AS enrollment_id,
      COALESCE(b.start_date::timestamptz, ce.enrolled_at, now()) AS anchor_date,
      CASE
        WHEN ce.drip_override = true THEN COALESCE(ce.drip_enabled, false)
        ELSE COALESCE(c.drip_enabled, v_global_drip_enabled)
      END AS effective_drip_enabled,
      CASE
        WHEN ce.sequential_override = true THEN COALESCE(ce.sequential_enabled, false)
        ELSE v_global_sequential_enabled
      END AS effective_sequential_enabled,
      -- Full-bypass override: admin enabled "Skip Drip" for this enrollment.
      -- When true, this enrollment ignores fees gate AND all locks.
      (ce.drip_override = true AND COALESCE(ce.drip_enabled, false) = false
        AND ce.sequential_override = true AND COALESCE(ce.sequential_enabled, false) = false
      ) AS full_bypass
    FROM available_lessons al
    JOIN modules m ON m.id = al.module
    JOIN course_enrollments ce ON ce.course_id = m.course_id
    JOIN students s ON s.id = ce.student_id
    LEFT JOIN courses c ON c.id = m.course_id
    LEFT JOIN batches b ON b.id = ce.batch_id
    WHERE s.user_id = p_user_id
      AND ce.status = 'active'
  ),
  lesson_picked AS (
    SELECT DISTINCT ON (rec_id)
      le.*
    FROM lesson_enrollments le
    -- Prefer enrollments with full_bypass so override always wins
    ORDER BY le.rec_id, le.full_bypass DESC, le.anchor_date DESC NULLS LAST, le.enrollment_id
  ),
  recording_status AS (
    SELECT
      lp.*,
      EXISTS (
        SELECT 1 FROM recording_views rv
        WHERE rv.recording_id = lp.rec_id
          AND rv.user_id = p_user_id
          AND rv.watched = true
      ) AS is_watched,
      EXISTS (
        SELECT 1 FROM submissions sub
        WHERE sub.assignment_id = lp.assignment_id
          AND sub.student_id = p_user_id
          AND sub.status = 'approved'
      ) AS is_assignment_done,
      EXISTS (
        SELECT 1 FROM user_unlocks uu
        WHERE uu.user_id = p_user_id
          AND uu.recording_id = lp.rec_id
          AND uu.is_unlocked = true
      ) AS is_manually_unlocked
    FROM lesson_picked lp
  ),
  ordered_recordings AS (
    SELECT
      rs.*,
      ROW_NUMBER() OVER (PARTITION BY rs.course_id ORDER BY rs.seq_order NULLS LAST, rs.rec_id) AS row_num,
      LAG(rs.is_watched)         OVER (PARTITION BY rs.course_id ORDER BY rs.seq_order NULLS LAST, rs.rec_id) AS prev_watched,
      LAG(rs.is_assignment_done) OVER (PARTITION BY rs.course_id ORDER BY rs.seq_order NULLS LAST, rs.rec_id) AS prev_assignment_done,
      LAG(rs.assignment_id)      OVER (PARTITION BY rs.course_id ORDER BY rs.seq_order NULLS LAST, rs.rec_id) AS prev_assignment_id,
      rs.anchor_date + (rs.drip_days || ' days')::interval AS calc_drip_unlock_date,
      CASE
        WHEN rs.effective_drip_enabled = true
          THEN now() >= rs.anchor_date + (rs.drip_days || ' days')::interval
        ELSE true
      END AS drip_timing_met
    FROM recording_status rs
  )
  SELECT
    orr.rec_id::uuid AS recording_id,
    orr.seq_order::integer AS sequence_order,
    CASE
      -- Per-enrollment full bypass: always unlocked, even if fees not cleared
      WHEN orr.full_bypass THEN true
      -- Fees gate (only when no bypass)
      WHEN (v_fees_cleared IS NULL OR v_fees_cleared = false) THEN false
      WHEN orr.is_manually_unlocked THEN true
      WHEN orr.row_num = 1 THEN orr.drip_timing_met
      WHEN orr.effective_sequential_enabled THEN
        CASE
          WHEN orr.prev_assignment_id IS NOT NULL THEN
            COALESCE(orr.prev_watched, false) AND COALESCE(orr.prev_assignment_done, false) AND orr.drip_timing_met
          ELSE
            COALESCE(orr.prev_watched, false) AND orr.drip_timing_met
        END
      ELSE orr.drip_timing_met
    END AS is_unlocked,
    CASE
      WHEN orr.full_bypass THEN 'Drip bypass enabled'
      WHEN (v_fees_cleared IS NULL OR v_fees_cleared = false) THEN 'Fees not cleared'
      WHEN orr.is_manually_unlocked THEN 'Manually unlocked'
      WHEN orr.row_num = 1 AND NOT orr.drip_timing_met THEN
        'Available on ' || to_char(orr.calc_drip_unlock_date, 'Mon DD, YYYY')
      WHEN orr.row_num = 1 THEN 'First recording'
      WHEN NOT orr.drip_timing_met THEN
        'Available on ' || to_char(orr.calc_drip_unlock_date, 'Mon DD, YYYY')
      WHEN orr.effective_sequential_enabled AND orr.prev_assignment_id IS NOT NULL AND NOT COALESCE(orr.prev_watched, false) THEN
        'Watch previous recording first'
      WHEN orr.effective_sequential_enabled AND orr.prev_assignment_id IS NOT NULL AND NOT COALESCE(orr.prev_assignment_done, false) THEN
        'Complete previous assignment first'
      WHEN orr.effective_sequential_enabled AND NOT COALESCE(orr.prev_watched, false) THEN
        'Watch previous recording first'
      ELSE 'Unlocked'
    END::text AS unlock_reason,
    (orr.assignment_id IS NOT NULL) AS assignment_required,
    orr.is_assignment_done AS assignment_completed,
    orr.is_watched AS recording_watched,
    (NOT orr.full_bypass AND orr.effective_drip_enabled = true AND NOT orr.drip_timing_met) AS drip_locked,
    CASE
      WHEN NOT orr.full_bypass AND orr.effective_drip_enabled = true AND NOT orr.drip_timing_met
      THEN orr.calc_drip_unlock_date
      ELSE NULL
    END AS drip_unlock_date
  FROM ordered_recordings orr
  ORDER BY orr.course_id, orr.seq_order NULLS LAST;
END;
$function$;