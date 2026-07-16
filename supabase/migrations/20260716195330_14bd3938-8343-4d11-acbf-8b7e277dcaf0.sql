CREATE OR REPLACE FUNCTION public.student_can_view_success_session(_course_id uuid, _batch_id uuid, _batch_ids jsonb)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with current_student as (
    select s.id
    from public.students s
    where s.user_id = auth.uid()
    limit 1
  )
  select exists (
    select 1
    from public.course_enrollments ce
    join current_student cs on cs.id = ce.student_id
    where ce.status = 'active'
      and (
        (
          _course_id is null
          and _batch_id is null
          and (
            _batch_ids is null
            or (jsonb_typeof(_batch_ids) = 'array' and jsonb_array_length(_batch_ids) = 0)
          )
        )
        or (_batch_id is not null and ce.batch_id = _batch_id)
        or (
          ce.batch_id is not null
          and coalesce(_batch_ids, '[]'::jsonb) ? ce.batch_id::text
        )
        or (
          _course_id is not null
          and _batch_id is null
          and (
            _batch_ids is null
            or (jsonb_typeof(_batch_ids) = 'array' and jsonb_array_length(_batch_ids) = 0)
          )
          and ce.course_id = _course_id
          and ce.batch_id is null
        )
        or (
          -- Unbatched-audience sessions: batch_ids contains the 'unbatched' sentinel,
          -- student has no batch on this course enrollment, and the course matches.
          _course_id is not null
          and ce.batch_id is null
          and ce.course_id = _course_id
          and coalesce(_batch_ids, '[]'::jsonb) ? 'unbatched'
        )
      )
  );
$function$;