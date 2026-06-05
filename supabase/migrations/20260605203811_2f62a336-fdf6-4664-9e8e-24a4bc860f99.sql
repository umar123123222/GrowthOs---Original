
-- Indexes to support aggregation
CREATE INDEX IF NOT EXISTS idx_recording_views_user_watched
  ON public.recording_views (user_id) WHERE watched = true;
CREATE INDEX IF NOT EXISTS idx_recording_views_watched_at
  ON public.recording_views (watched_at) WHERE watched = true;
CREATE INDEX IF NOT EXISTS idx_submissions_student_status
  ON public.submissions (student_id, status);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at
  ON public.submissions (submitted_at);

CREATE OR REPLACE FUNCTION public.get_student_analytics_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role text;
  total_recordings int;
  total_assignments int;
  today_start timestamptz := date_trunc('day', now());
  students_json jsonb;
  overview_json jsonb;
BEGIN
  -- Only admins / superadmins / support
  caller_role := public.get_my_role();
  IF caller_role NOT IN ('admin','superadmin','support_member','mentor') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT count(*) INTO total_recordings FROM public.available_lessons;
  SELECT count(*) INTO total_assignments FROM public.assignments;

  WITH s AS (
    SELECT
      u.id,
      u.full_name,
      u.email,
      u.status,
      u.created_at,
      u.last_active_at,
      st.enrollment_date
    FROM public.users u
    JOIN public.students st ON st.user_id = u.id
    WHERE u.role = 'student'
  ),
  views AS (
    SELECT user_id, count(*) FILTER (WHERE watched) AS watched_count
    FROM public.recording_views
    GROUP BY user_id
  ),
  subs AS (
    SELECT student_id, count(*) FILTER (WHERE status = 'approved') AS approved_count
    FROM public.submissions
    GROUP BY student_id
  ),
  per_student AS (
    SELECT
      s.id,
      COALESCE(s.full_name, 'Unknown') AS full_name,
      COALESCE(s.email, '') AS email,
      COALESCE(s.status, 'active') AS status,
      COALESCE(s.enrollment_date::timestamptz, s.created_at) AS enrollment_date,
      COALESCE(v.watched_count, 0)::int AS videos_watched,
      total_recordings AS videos_total,
      COALESCE(sb.approved_count, 0)::int AS assignments_completed,
      total_assignments AS assignments_total,
      COALESCE(s.last_active_at::text, '') AS last_activity,
      LEAST(100, GREATEST(0, ROUND(
        ( COALESCE(v.watched_count,0)::numeric / GREATEST(total_recordings,1) * 0.6
        + COALESCE(sb.approved_count,0)::numeric / GREATEST(total_assignments,1) * 0.4
        ) * 100
      )))::int AS progress_percentage
    FROM s
    LEFT JOIN views v ON v.user_id = s.id
    LEFT JOIN subs sb ON sb.student_id = s.id
  )
  SELECT jsonb_agg(to_jsonb(per_student) ORDER BY full_name) INTO students_json FROM per_student;

  SELECT jsonb_build_object(
    'total_students', (SELECT count(*) FROM per_student_tmp),
    'active_students', (SELECT count(*) FROM per_student_tmp WHERE status = 'active'),
    'avg_progress', COALESCE((SELECT ROUND(AVG(progress_percentage))::int FROM per_student_tmp), 0),
    'total_completions', (SELECT count(*) FROM per_student_tmp WHERE progress_percentage >= 100),
    'videos_watched_today', (
      SELECT count(*) FROM public.recording_views
      WHERE watched = true AND watched_at >= today_start
    ),
    'assignments_submitted_today', (
      SELECT count(*) FROM public.submissions
      WHERE submitted_at >= today_start
    )
  ) INTO overview_json
  FROM (SELECT (jsonb_array_elements(students_json))) AS dummy;  -- ensure CTE evaluated

  -- Simpler: recompute overview from students_json
  overview_json := jsonb_build_object(
    'total_students', COALESCE(jsonb_array_length(students_json), 0),
    'active_students', (
      SELECT count(*) FROM jsonb_array_elements(students_json) e WHERE e->>'status' = 'active'
    ),
    'avg_progress', COALESCE((
      SELECT ROUND(AVG((e->>'progress_percentage')::int))::int
      FROM jsonb_array_elements(students_json) e
    ), 0),
    'total_completions', (
      SELECT count(*) FROM jsonb_array_elements(students_json) e
      WHERE (e->>'progress_percentage')::int >= 100
    ),
    'videos_watched_today', (
      SELECT count(*) FROM public.recording_views
      WHERE watched = true AND watched_at >= today_start
    ),
    'assignments_submitted_today', (
      SELECT count(*) FROM public.submissions
      WHERE submitted_at >= today_start
    )
  );

  RETURN jsonb_build_object(
    'overview', overview_json,
    'students', COALESCE(students_json, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_student_analytics_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_student_analytics_summary() TO authenticated;
