DROP FUNCTION IF EXISTS public.get_student_analytics_summary();
DROP FUNCTION IF EXISTS public.get_student_analytics_summary(int, int, text);

CREATE OR REPLACE FUNCTION public.get_student_analytics_summary(
  p_page int DEFAULT 1,
  p_page_size int DEFAULT 25,
  p_search text DEFAULT NULL
)
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
  total_count int;
  filtered_count int;
  active_count int;
  completions_count int;
  avg_progress_val int;
  videos_today int;
  subs_today int;
  page int := GREATEST(1, COALESCE(p_page, 1));
  page_size int := LEAST(200, GREATEST(1, COALESCE(p_page_size, 25)));
  search_pattern text := NULLIF(TRIM(COALESCE(p_search, '')), '');
BEGIN
  caller_role := public.get_my_role();
  IF caller_role NOT IN ('admin','superadmin','support_member','mentor') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT count(*) INTO total_recordings FROM public.available_lessons;
  SELECT count(*) INTO total_assignments FROM public.assignments;

  WITH student_base AS (
    SELECT
      u.id,
      COALESCE(u.full_name, 'Unknown') AS full_name,
      COALESCE(u.email, '') AS email,
      COALESCE(u.status, 'active') AS status,
      u.created_at,
      u.last_active_at,
      st.enrollment_date
    FROM public.users u
    JOIN public.students st ON st.user_id = u.id
    WHERE u.role = 'student'
  ),
  viewed AS (
    SELECT rv.user_id, count(*) FILTER (WHERE rv.watched) AS watched_count
    FROM public.recording_views rv
    JOIN student_base sb ON sb.id = rv.user_id
    GROUP BY rv.user_id
  ),
  approved_submissions AS (
    SELECT s.student_id, count(*) FILTER (WHERE s.status = 'approved') AS approved_count
    FROM public.submissions s
    JOIN student_base sb ON sb.id = s.student_id
    GROUP BY s.student_id
  ),
  per_student AS (
    SELECT
      sb.id,
      sb.full_name,
      sb.email,
      sb.status,
      COALESCE(sb.enrollment_date::timestamptz, sb.created_at) AS enrollment_date,
      COALESCE(v.viewed_count, 0)::int AS videos_watched,
      total_recordings AS videos_total,
      COALESCE(aps.approved_count, 0)::int AS assignments_completed,
      total_assignments AS assignments_total,
      COALESCE(sb.last_active_at::text, '') AS last_activity,
      LEAST(100, GREATEST(0, ROUND(
        (
          COALESCE(v.viewed_count, 0)::numeric / GREATEST(total_recordings, 1) * 0.6
          + COALESCE(aps.approved_count, 0)::numeric / GREATEST(total_assignments, 1) * 0.4
        ) * 100
      )))::int AS progress_percentage
    FROM student_base sb
    LEFT JOIN viewed v ON v.user_id = sb.id
    LEFT JOIN approved_submissions aps ON aps.student_id = sb.id
  )
  SELECT
    count(*),
    count(*) FILTER (WHERE status = 'active'),
    count(*) FILTER (WHERE progress_percentage >= 100),
    COALESCE(ROUND(AVG(progress_percentage))::int, 0)
  INTO total_count, active_count, completions_count, avg_progress_val
  FROM per_student;

  SELECT count(*) INTO videos_today
  FROM public.recording_views
  WHERE watched = true AND watched_at >= today_start;

  SELECT count(*) INTO subs_today
  FROM public.submissions
  WHERE submitted_at >= today_start;

  WITH student_base AS (
    SELECT
      u.id,
      COALESCE(u.full_name, 'Unknown') AS full_name,
      COALESCE(u.email, '') AS email,
      COALESCE(u.status, 'active') AS status,
      u.created_at,
      u.last_active_at,
      st.enrollment_date
    FROM public.users u
    JOIN public.students st ON st.user_id = u.id
    WHERE u.role = 'student'
  )
  SELECT count(*)
  INTO filtered_count
  FROM student_base
  WHERE search_pattern IS NULL
     OR full_name ILIKE '%' || search_pattern || '%'
     OR email ILIKE '%' || search_pattern || '%';

  WITH student_base AS (
    SELECT
      u.id,
      COALESCE(u.full_name, 'Unknown') AS full_name,
      COALESCE(u.email, '') AS email,
      COALESCE(u.status, 'active') AS status,
      u.created_at,
      u.last_active_at,
      st.enrollment_date
    FROM public.users u
    JOIN public.students st ON st.user_id = u.id
    WHERE u.role = 'student'
      AND (
        search_pattern IS NULL
        OR COALESCE(u.full_name, 'Unknown') ILIKE '%' || search_pattern || '%'
        OR COALESCE(u.email, '') ILIKE '%' || search_pattern || '%'
      )
    ORDER BY COALESCE(u.full_name, 'Unknown'), u.id
    LIMIT page_size OFFSET (page - 1) * page_size
  ),
  viewed AS (
    SELECT rv.user_id, count(*) FILTER (WHERE rv.watched) AS watched_count
    FROM public.recording_views rv
    JOIN student_base sb ON sb.id = rv.user_id
    GROUP BY rv.user_id
  ),
  approved_submissions AS (
    SELECT s.student_id, count(*) FILTER (WHERE s.status = 'approved') AS approved_count
    FROM public.submissions s
    JOIN student_base sb ON sb.id = s.student_id
    GROUP BY s.student_id
  ),
  per_page AS (
    SELECT
      sb.id,
      sb.full_name,
      sb.email,
      sb.status,
      COALESCE(sb.enrollment_date::timestamptz, sb.created_at) AS enrollment_date,
      COALESCE(v.viewed_count, 0)::int AS videos_watched,
      total_recordings AS videos_total,
      COALESCE(aps.approved_count, 0)::int AS assignments_completed,
      total_assignments AS assignments_total,
      COALESCE(sb.last_active_at::text, '') AS last_activity,
      LEAST(100, GREATEST(0, ROUND(
        (
          COALESCE(v.viewed_count, 0)::numeric / GREATEST(total_recordings, 1) * 0.6
          + COALESCE(aps.approved_count, 0)::numeric / GREATEST(total_assignments, 1) * 0.4
        ) * 100
      )))::int AS progress_percentage
    FROM student_base sb
    LEFT JOIN viewed v ON v.user_id = sb.id
    LEFT JOIN approved_submissions aps ON aps.student_id = sb.id
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(per_page) ORDER BY full_name), '[]'::jsonb)
  INTO students_json
  FROM per_page;

  overview_json := jsonb_build_object(
    'total_students', total_count,
    'active_students', active_count,
    'avg_progress', avg_progress_val,
    'total_completions', completions_count,
    'videos_watched_today', videos_today,
    'assignments_submitted_today', subs_today
  );

  RETURN jsonb_build_object(
    'overview', overview_json,
    'students', students_json,
    'total_count', total_count,
    'filtered_count', filtered_count,
    'page', page,
    'page_size', page_size
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_student_analytics_summary(int, int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_student_analytics_summary(int, int, text) TO authenticated;