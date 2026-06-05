
CREATE OR REPLACE FUNCTION public.get_student_engagement_detail(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_videos jsonb;
  v_assignments jsonb;
BEGIN
  v_role := public.get_my_role();
  IF v_role NOT IN ('admin','superadmin','mentor','support_member','enrollment_manager') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT COALESCE(jsonb_agg(v ORDER BY (v->>'sequence_order')::int NULLS LAST, v->>'recording_title'), '[]'::jsonb)
  INTO v_videos
  FROM (
    SELECT jsonb_build_object(
      'id', al.id,
      'recording_title', al.recording_title,
      'sequence_order', al.sequence_order,
      'unlocked', COALESCE(uu.is_unlocked, false),
      'unlocked_at', uu.unlocked_at,
      'watched', COALESCE(rv.watched, false),
      'watched_at', rv.watched_at
    ) AS v
    FROM public.available_lessons al
    LEFT JOIN public.user_unlocks uu
      ON uu.recording_id = al.id AND uu.user_id = p_user_id
    LEFT JOIN public.recording_views rv
      ON rv.recording_id = al.id AND rv.user_id = p_user_id
  ) s;

  SELECT COALESCE(jsonb_agg(a ORDER BY a->>'name'), '[]'::jsonb)
  INTO v_assignments
  FROM (
    SELECT jsonb_build_object(
      'id', asg.id,
      'name', asg.name,
      'unlocked', COALESCE(bool_or(uu.is_unlocked), false),
      'status', COALESCE(latest.status, 'not_submitted'),
      'submitted_at', latest.submitted_at,
      'reviewed_at', latest.reviewed_at,
      'version', latest.version
    ) AS a
    FROM public.assignments asg
    LEFT JOIN public.available_lessons al ON al.assignment_id = asg.id
    LEFT JOIN public.user_unlocks uu ON uu.recording_id = al.id AND uu.user_id = p_user_id
    LEFT JOIN LATERAL (
      SELECT s.status, s.submitted_at, s.reviewed_at, s.version
      FROM public.submissions s
      WHERE s.assignment_id = asg.id AND s.student_id = p_user_id
      ORDER BY s.version DESC NULLS LAST, s.submitted_at DESC NULLS LAST
      LIMIT 1
    ) latest ON true
    GROUP BY asg.id, asg.name, latest.status, latest.submitted_at, latest.reviewed_at, latest.version
  ) t;

  RETURN jsonb_build_object(
    'videos', v_videos,
    'assignments', v_assignments
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_student_engagement_detail(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_student_engagement_detail(uuid) TO authenticated;
