CREATE OR REPLACE FUNCTION public.get_student_engagement_detail(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;
  v_videos jsonb;
  v_assignments jsonb;
BEGIN
  v_role := public.get_my_role();
  IF v_role NOT IN ('admin','superadmin','mentor','support_member','enrollment_manager') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT COALESCE(jsonb_agg(v ORDER BY v->>'course_title' NULLS LAST, (v->>'sequence_order')::int NULLS LAST, v->>'recording_title'), '[]'::jsonb)
  INTO v_videos
  FROM (
    SELECT jsonb_build_object(
      'id', al.id,
      'recording_title', al.recording_title,
      'sequence_order', al.sequence_order,
      'unlocked', COALESCE(uu.is_unlocked, false),
      'unlocked_at', uu.unlocked_at,
      'watched', COALESCE(rv.watched, false),
      'watched_at', rv.watched_at,
      'course_id', c.id,
      'course_title', c.title
    ) AS v
    FROM public.available_lessons al
    LEFT JOIN public.modules m ON m.id = al.module
    LEFT JOIN public.courses c ON c.id = m.course_id
    LEFT JOIN public.user_unlocks uu
      ON uu.recording_id = al.id AND uu.user_id = p_user_id
    LEFT JOIN public.recording_views rv
      ON rv.recording_id = al.id AND rv.user_id = p_user_id
  ) s;

  SELECT COALESCE(jsonb_agg(a ORDER BY a->>'course_title' NULLS LAST, a->>'name'), '[]'::jsonb)
  INTO v_assignments
  FROM (
    SELECT jsonb_build_object(
      'id', asg.id,
      'name', asg.name,
      'unlocked', COALESCE(bool_or(uu.is_unlocked), false),
      'status', COALESCE(MAX(latest.status), 'not_submitted'),
      'submitted_at', MAX(latest.submitted_at),
      'reviewed_at', MAX(latest.reviewed_at),
      'version', MAX(latest.version),
      'course_id', c.id,
      'course_title', c.title
    ) AS a
    FROM public.assignments asg
    LEFT JOIN public.courses c ON c.id = asg.course_id
    LEFT JOIN public.available_lessons al ON al.assignment_id = asg.id
    LEFT JOIN public.user_unlocks uu ON uu.recording_id = al.id AND uu.user_id = p_user_id
    LEFT JOIN LATERAL (
      SELECT s.status, s.submitted_at, s.reviewed_at, s.version
      FROM public.submissions s
      WHERE s.assignment_id = asg.id AND s.student_id = p_user_id
      ORDER BY s.version DESC NULLS LAST, s.submitted_at DESC NULLS LAST
      LIMIT 1
    ) latest ON true
    GROUP BY asg.id, asg.name, c.id, c.title
  ) t;

  RETURN jsonb_build_object(
    'videos', v_videos,
    'assignments', v_assignments
  );
END;
$function$;