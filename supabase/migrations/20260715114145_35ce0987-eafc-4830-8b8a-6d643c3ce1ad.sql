
-- =========================================================
-- 1. Schema: lesson_drip_overrides
-- =========================================================
CREATE TABLE public.lesson_drip_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.available_lessons(id) ON DELETE CASCADE,
  pathway_id uuid REFERENCES public.learning_pathways(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  drip_days integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.lesson_drip_overrides TO authenticated;
GRANT ALL ON public.lesson_drip_overrides TO service_role;

ALTER TABLE public.lesson_drip_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lesson_drip_overrides_select_authenticated"
  ON public.lesson_drip_overrides FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "lesson_drip_overrides_admin_write"
  ON public.lesson_drip_overrides FOR ALL
  TO authenticated
  USING (public.get_my_role() IN ('admin','superadmin'))
  WITH CHECK (public.get_my_role() IN ('admin','superadmin'));

-- One override row per context. NULLs are distinct in unique indexes,
-- so use two partial indexes to cover pathway-scoped and course-scoped rows.
CREATE UNIQUE INDEX lesson_drip_overrides_pathway_uniq
  ON public.lesson_drip_overrides (lesson_id, pathway_id, course_id)
  WHERE pathway_id IS NOT NULL;

CREATE UNIQUE INDEX lesson_drip_overrides_course_uniq
  ON public.lesson_drip_overrides (lesson_id, course_id)
  WHERE pathway_id IS NULL;

CREATE INDEX lesson_drip_overrides_lookup
  ON public.lesson_drip_overrides (lesson_id, course_id, pathway_id);

CREATE TRIGGER update_lesson_drip_overrides_updated_at
  BEFORE UPDATE ON public.lesson_drip_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 2. Backfill: freeze current schedule for every active enrollment
-- =========================================================
-- Pathway-scoped snapshot: every (pathway, course, lesson) combo that any
-- active pathway enrollment currently resolves to.
INSERT INTO public.lesson_drip_overrides (lesson_id, pathway_id, course_id, drip_days)
SELECT DISTINCT
  al.id,
  ce.pathway_id,
  m.course_id,
  COALESCE(al.drip_days, 0)
FROM public.course_enrollments ce
JOIN public.pathway_courses pc ON pc.pathway_id = ce.pathway_id
JOIN public.modules m ON m.course_id = pc.course_id
JOIN public.available_lessons al ON al.module = m.id
WHERE ce.status = 'active'
  AND ce.pathway_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Standalone-course snapshot: every (course, lesson) combo currently used by
-- an active direct course enrollment.
INSERT INTO public.lesson_drip_overrides (lesson_id, pathway_id, course_id, drip_days)
SELECT DISTINCT
  al.id,
  NULL::uuid,
  m.course_id,
  COALESCE(al.drip_days, 0)
FROM public.course_enrollments ce
JOIN public.modules m ON m.course_id = ce.course_id
JOIN public.available_lessons al ON al.module = m.id
WHERE ce.status = 'active'
  AND ce.course_id IS NOT NULL
  AND ce.pathway_id IS NULL
ON CONFLICT DO NOTHING;

-- =========================================================
-- 3. Helper: resolve effective drip days for a (lesson, pathway, course)
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_effective_drip_days(
  p_lesson_id uuid,
  p_pathway_id uuid,
  p_course_id uuid
) RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    -- Tier 1: pathway + course + lesson
    (SELECT drip_days FROM public.lesson_drip_overrides
      WHERE lesson_id = p_lesson_id
        AND pathway_id IS NOT DISTINCT FROM p_pathway_id
        AND course_id  = p_course_id
      LIMIT 1),
    -- Tier 2: course + lesson (pathway NULL fallback)
    (SELECT drip_days FROM public.lesson_drip_overrides
      WHERE lesson_id = p_lesson_id
        AND pathway_id IS NULL
        AND course_id  = p_course_id
      LIMIT 1),
    -- Tier 3: lesson global default
    (SELECT drip_days FROM public.available_lessons WHERE id = p_lesson_id),
    0
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_effective_drip_days(uuid, uuid, uuid) TO authenticated, anon, service_role;

-- =========================================================
-- 4. Rewrite: get_sequential_unlock_status (per-context drip)
-- =========================================================
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
  SELECT s.fees_cleared INTO v_fees_cleared
  FROM students s
  WHERE s.user_id = p_user_id;

  SELECT
    COALESCE(cs.lms_sequential_unlock, false),
    COALESCE(cs.drip_enabled_default, false)
  INTO v_global_sequential_enabled, v_global_drip_enabled
  FROM company_settings cs
  WHERE cs.id = 1;

  RETURN QUERY
  WITH enrollment_courses AS (
    SELECT
      ce.id           AS enrollment_id,
      ce.course_id    AS direct_course_id,
      ce.pathway_id   AS pathway_id,
      ce.batch_id     AS batch_id,
      ce.enrolled_at  AS enrolled_at,
      ce.drip_override,
      ce.drip_enabled,
      ce.sequential_override,
      ce.sequential_enabled,
      x.course_id     AS course_id
    FROM course_enrollments ce
    JOIN students s ON s.id = ce.student_id
    CROSS JOIN LATERAL (
      SELECT ce.course_id AS course_id
      WHERE ce.course_id IS NOT NULL
      UNION
      SELECT pc.course_id
      FROM pathway_courses pc
      WHERE ce.pathway_id IS NOT NULL
        AND pc.pathway_id = ce.pathway_id
    ) x
    WHERE s.user_id = p_user_id
      AND ce.status = 'active'
      AND x.course_id IS NOT NULL
  ),
  lesson_enrollments AS (
    SELECT
      al.id           AS rec_id,
      COALESCE(al.sequence_order, 0) AS seq_order,
      al.assignment_id,
      -- Per-context drip: pathway+course > course > lesson default
      COALESCE(
        (SELECT ldo.drip_days FROM lesson_drip_overrides ldo
          WHERE ldo.lesson_id = al.id
            AND ldo.pathway_id IS NOT DISTINCT FROM ec.pathway_id
            AND ldo.course_id  = m.course_id
          LIMIT 1),
        (SELECT ldo.drip_days FROM lesson_drip_overrides ldo
          WHERE ldo.lesson_id = al.id
            AND ldo.pathway_id IS NULL
            AND ldo.course_id  = m.course_id
          LIMIT 1),
        al.drip_days,
        0
      ) AS drip_days,
      m.course_id     AS course_id,
      ec.enrollment_id,
      COALESCE(b.start_date::timestamptz, ec.enrolled_at, now()) AS anchor_date,
      CASE
        WHEN ec.drip_override = true THEN COALESCE(ec.drip_enabled, false)
        ELSE COALESCE(c.drip_enabled, v_global_drip_enabled)
      END AS effective_drip_enabled,
      CASE
        WHEN ec.sequential_override = true THEN COALESCE(ec.sequential_enabled, false)
        ELSE v_global_sequential_enabled
      END AS effective_sequential_enabled,
      (ec.drip_override = true AND COALESCE(ec.drip_enabled, false) = false
        AND ec.sequential_override = true AND COALESCE(ec.sequential_enabled, false) = false
      ) AS full_bypass
    FROM available_lessons al
    JOIN modules m ON m.id = al.module
    JOIN enrollment_courses ec ON ec.course_id = m.course_id
    LEFT JOIN courses c ON c.id = m.course_id
    LEFT JOIN batches b ON b.id = ec.batch_id
  ),
  lesson_picked AS (
    SELECT DISTINCT ON (rec_id)
      le.*
    FROM lesson_enrollments le
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
      WHEN orr.full_bypass THEN true
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

-- =========================================================
-- 5. Rewrite: get_course_sequential_unlock_status (per-context drip)
-- =========================================================
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
  v_full_bypass BOOLEAN := false;
BEGIN
  SELECT s.id, s.fees_cleared, s.enrollment_date
  INTO v_student_id, v_fees_cleared, v_enrollment_date
  FROM students s
  WHERE s.user_id = p_user_id;

  IF v_student_id IS NULL THEN
    RETURN;
  END IF;

  SELECT true INTO v_has_course_access
  FROM course_enrollments ce
  WHERE ce.student_id = v_student_id
    AND ce.status = 'active'
    AND (
      ce.course_id = p_course_id
      OR EXISTS (SELECT 1 FROM pathway_courses pc WHERE pc.pathway_id = ce.pathway_id AND pc.course_id = p_course_id)
      OR EXISTS (SELECT 1 FROM batch_courses bc WHERE bc.batch_id = ce.batch_id AND bc.course_id = p_course_id)
    )
  LIMIT 1;
  v_has_course_access := COALESCE(v_has_course_access, false);

  SELECT true
  INTO v_full_bypass
  FROM course_enrollments ce
  WHERE ce.student_id = v_student_id
    AND ce.status = 'active'
    AND ce.drip_override = true AND COALESCE(ce.drip_enabled, false) = false
    AND ce.sequential_override = true AND COALESCE(ce.sequential_enabled, false) = false
    AND (
      ce.course_id = p_course_id
      OR EXISTS (SELECT 1 FROM pathway_courses pc WHERE pc.pathway_id = ce.pathway_id AND pc.course_id = p_course_id)
    )
  LIMIT 1;
  v_full_bypass := COALESCE(v_full_bypass, false);

  SELECT ce.batch_id, ce.pathway_id
  INTO v_batch_id, v_pathway_id
  FROM course_enrollments ce
  WHERE ce.student_id = v_student_id
    AND ce.course_id = p_course_id
    AND ce.status = 'active'
  ORDER BY (ce.batch_id IS NOT NULL) DESC, (ce.pathway_id IS NOT NULL) DESC, ce.enrolled_at DESC NULLS LAST, ce.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_batch_id IS NULL OR v_pathway_id IS NULL THEN
    SELECT ce.batch_id, ce.pathway_id INTO v_batch_id, v_pathway_id
    FROM course_enrollments ce
    JOIN pathway_courses pc ON pc.pathway_id = ce.pathway_id AND pc.course_id = p_course_id
    WHERE ce.student_id = v_student_id AND ce.status = 'active' AND ce.pathway_id IS NOT NULL
    ORDER BY (ce.batch_id IS NOT NULL) DESC, ce.enrolled_at DESC NULLS LAST, ce.created_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_batch_id IS NULL THEN
    SELECT ce.batch_id INTO v_batch_id
    FROM course_enrollments ce
    WHERE ce.student_id = v_student_id AND ce.status = 'active' AND ce.batch_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM batch_courses bc WHERE bc.batch_id = ce.batch_id AND bc.course_id = p_course_id)
    ORDER BY ce.enrolled_at DESC NULLS LAST, ce.created_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_batch_id IS NOT NULL THEN
    SELECT b.start_date INTO v_batch_start_date FROM batches b WHERE b.id = v_batch_id;
  END IF;

  IF v_pathway_id IS NOT NULL THEN
    SELECT EXISTS (SELECT 1 FROM invoices i WHERE i.student_id = v_student_id AND i.pathway_id = v_pathway_id AND i.installment_number = 1 AND i.status = 'paid') INTO v_first_installment_paid;
  ELSE
    SELECT EXISTS (SELECT 1 FROM invoices i WHERE i.student_id = v_student_id AND i.course_id = p_course_id AND i.installment_number = 1 AND i.status = 'paid') INTO v_first_installment_paid;
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
    COALESCE(CASE WHEN ce.sequential_override = true THEN ce.sequential_enabled ELSE NULL END, (SELECT lms_sequential_unlock FROM company_settings LIMIT 1), true),
    COALESCE(CASE WHEN ce.drip_override = true THEN ce.drip_enabled ELSE NULL END, c.drip_enabled, (SELECT drip_enabled_default FROM company_settings LIMIT 1), false)
  INTO v_sequential_enabled, v_drip_enabled
  FROM courses c
  LEFT JOIN LATERAL (
    SELECT ce.*
    FROM course_enrollments ce
    WHERE (ce.course_id = c.id OR EXISTS (SELECT 1 FROM pathway_courses pc WHERE pc.pathway_id = ce.pathway_id AND pc.course_id = c.id))
      AND ce.student_id = v_student_id AND ce.status = 'active'
    ORDER BY
      (ce.drip_override = true AND COALESCE(ce.drip_enabled, false) = false AND ce.sequential_override = true AND COALESCE(ce.sequential_enabled, false) = false) DESC,
      (ce.batch_id IS NOT NULL) DESC, (ce.pathway_id IS NOT NULL) DESC,
      ce.enrolled_at DESC NULLS LAST, ce.created_at DESC NULLS LAST
    LIMIT 1
  ) ce ON true
  WHERE c.id = p_course_id;

  IF v_full_bypass THEN
    v_has_course_access := true;
    v_fees_cleared := true;
    v_sequential_enabled := false;
    v_drip_enabled := false;
  END IF;

  RETURN QUERY
  WITH ordered_lessons AS (
    SELECT
      al.id,
      al.recording_title,
      al.sequence_order,
      -- Per-context drip: pathway+course > course > lesson default
      COALESCE(
        (SELECT ldo.drip_days FROM lesson_drip_overrides ldo
          WHERE ldo.lesson_id = al.id
            AND ldo.pathway_id IS NOT DISTINCT FROM v_pathway_id
            AND ldo.course_id  = p_course_id
          LIMIT 1),
        (SELECT ldo.drip_days FROM lesson_drip_overrides ldo
          WHERE ldo.lesson_id = al.id
            AND ldo.pathway_id IS NULL
            AND ldo.course_id  = p_course_id
          LIMIT 1),
        al.drip_days
      ) AS drip_days,
      al.assignment_id,
      m."order" as module_order,
      ROW_NUMBER() OVER (ORDER BY m."order" NULLS LAST, al.sequence_order NULLS LAST, al.id) as seq_pos
    FROM available_lessons al
    INNER JOIN modules m ON m.id = al.module AND m.course_id = p_course_id
  ),
  prev_lesson_status AS (
    SELECT ol.*, LAG(ol.id) OVER (ORDER BY ol.seq_pos) as prev_lesson_id, LAG(ol.assignment_id) OVER (ORDER BY ol.seq_pos) as prev_assignment_id
    FROM ordered_lessons ol
  ),
  latest_current_submission AS (
    SELECT DISTINCT ON (sub.assignment_id) sub.assignment_id, sub.status FROM submissions sub
    WHERE sub.student_id = p_user_id ORDER BY sub.assignment_id, sub.version DESC NULLS LAST, sub.created_at DESC NULLS LAST
  ),
  latest_prev_submission AS (
    SELECT DISTINCT ON (sub.assignment_id) sub.assignment_id, sub.status FROM submissions sub
    WHERE sub.student_id = p_user_id ORDER BY sub.assignment_id, sub.version DESC NULLS LAST, sub.created_at DESC NULLS LAST
  ),
  full_status AS (
    SELECT pls.id, pls.recording_title, pls.seq_pos, pls.drip_days, pls.assignment_id, pls.prev_lesson_id, pls.prev_assignment_id,
      COALESCE(uu.is_unlocked, false) as manually_unlocked,
      COALESCE(rv.watched, false) as prev_watched,
      COALESCE(curr_rv.watched, false) as current_watched,
      prev_sub.status as prev_assignment_status,
      sub.status as current_assignment_status,
      CASE WHEN v_drip_enabled AND pls.drip_days IS NOT NULL THEN v_drip_base_date + (pls.drip_days || ' days')::interval ELSE NULL END as calculated_drip_date
    FROM prev_lesson_status pls
    LEFT JOIN user_unlocks uu ON uu.recording_id = pls.id AND uu.user_id = p_user_id
    LEFT JOIN recording_views rv ON rv.recording_id = pls.prev_lesson_id AND rv.user_id = p_user_id
    LEFT JOIN recording_views curr_rv ON curr_rv.recording_id = pls.id AND curr_rv.user_id = p_user_id
    LEFT JOIN latest_current_submission sub ON sub.assignment_id = pls.assignment_id
    LEFT JOIN latest_prev_submission prev_sub ON prev_sub.assignment_id = pls.prev_assignment_id
  )
  SELECT fs.id, fs.recording_title::text,
    (CASE
      WHEN v_full_bypass THEN true
      WHEN fs.manually_unlocked THEN true
      WHEN fs.current_watched THEN true
      WHEN fs.calculated_drip_date IS NOT NULL AND fs.calculated_drip_date > now() THEN false
      WHEN NOT v_has_course_access THEN false
      WHEN NOT COALESCE(v_fees_cleared, false) THEN false
      WHEN NOT v_sequential_enabled THEN true
      WHEN fs.seq_pos = 1 THEN true
      WHEN fs.prev_watched AND (fs.prev_assignment_id IS NULL OR fs.prev_assignment_status = 'approved') THEN true
      ELSE false
    END)::BOOLEAN,
    CASE
      WHEN v_full_bypass THEN 'drip_bypass'
      WHEN fs.manually_unlocked THEN 'manually_unlocked'
      WHEN fs.current_watched THEN 'already_watched'
      WHEN fs.calculated_drip_date IS NOT NULL AND fs.calculated_drip_date > now() THEN 'drip_locked'
      WHEN NOT v_has_course_access THEN 'not_started_yet'
      WHEN NOT COALESCE(v_fees_cleared, false) THEN 'fees_not_cleared'
      WHEN NOT v_sequential_enabled THEN 'sequential_disabled'
      WHEN fs.seq_pos = 1 THEN 'first_lesson'
      WHEN fs.prev_watched AND (fs.prev_assignment_id IS NULL OR fs.prev_assignment_status = 'approved') THEN 'requirements_met'
      ELSE 'locked'
    END::text,
    fs.seq_pos::integer,
    CASE
      WHEN v_full_bypass THEN NULL
      WHEN fs.manually_unlocked THEN NULL
      WHEN fs.current_watched THEN NULL
      WHEN fs.calculated_drip_date IS NOT NULL AND fs.calculated_drip_date > now() THEN 'drip_locked'
      WHEN NOT v_has_course_access THEN 'not_started_yet'
      WHEN NOT COALESCE(v_fees_cleared, false) THEN 'fees_not_cleared'
      WHEN v_sequential_enabled AND fs.seq_pos > 1 AND NOT fs.prev_watched THEN 'previous_lesson_not_watched'
      WHEN v_sequential_enabled AND fs.seq_pos > 1 AND fs.prev_assignment_id IS NOT NULL AND fs.prev_assignment_status IS NULL THEN 'previous_assignment_not_submitted'
      WHEN v_sequential_enabled AND fs.seq_pos > 1 AND fs.prev_assignment_id IS NOT NULL AND fs.prev_assignment_status != 'approved' THEN 'previous_assignment_not_approved'
      ELSE NULL
    END::text,
    CASE WHEN v_full_bypass THEN NULL ELSE fs.calculated_drip_date END
  FROM full_status fs
  ORDER BY fs.seq_pos;
END;
$function$;
