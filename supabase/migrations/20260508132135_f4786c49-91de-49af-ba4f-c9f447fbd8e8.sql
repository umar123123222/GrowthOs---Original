create index if not exists idx_success_sessions_batch_ids_gin
  on public.success_sessions
  using gin (batch_ids jsonb_ops);

create index if not exists idx_course_enrollments_student_status_batch_course
  on public.course_enrollments (student_id, status, batch_id, course_id);

create or replace function public.student_can_view_success_session(
  _course_id uuid,
  _batch_id uuid,
  _batch_ids jsonb
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
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
      )
  );
$$;

drop policy if exists "Role-based visibility for success sessions" on public.success_sessions;

create policy "Role-based visibility for success sessions"
on public.success_sessions
for select
to authenticated
using (
  public.get_my_role() = any (array['admin', 'superadmin', 'enrollment_manager'])
  or (public.get_my_role() = 'mentor' and mentor_id = auth.uid())
  or (
    public.get_my_role() = 'student'
    and public.student_can_view_success_session(course_id, batch_id, batch_ids)
  )
);