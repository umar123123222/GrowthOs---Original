CREATE INDEX IF NOT EXISTS idx_notifications_template_hash_created
  ON public.notifications (template_key, payload_hash, created_at DESC);

CREATE OR REPLACE FUNCTION public.notify_all_students(p_type text, p_title text, p_message text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  inserted_count INTEGER := 0;
BEGIN
  INSERT INTO public.notifications (user_id, type, channel, status, sent_at, payload)
  SELECT u.id, p_type, 'system', 'sent', now(),
         jsonb_build_object('title', p_title, 'message', p_message, 'metadata', p_metadata)
  FROM public.users u
  WHERE u.role = 'student';

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_users(user_ids uuid[], template_key text, payload jsonb)
 RETURNS uuid[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_ids alias for $1;
  v_template_key alias for $2;
  v_payload alias for $3;

  tpl record;
  inserted_ids uuid[] := '{}';
  now_ts timestamptz := now();
  p_hash text := md5(coalesce(v_payload::text,''));
  rendered_title text;
  rendered_body text;
begin
  if v_user_ids is null or array_length(v_user_ids, 1) is null then
    return inserted_ids;
  end if;

  select * into tpl
  from public.notification_templates
  where key = v_template_key and active = true
  limit 1;

  if tpl is null then
    return inserted_ids;
  end if;

  rendered_title := public.interpolate_template(tpl.title_md, v_payload);
  rendered_body  := public.interpolate_template(tpl.body_md,  v_payload);

  with targets as (
    select distinct uid from unnest(v_user_ids) as uid
  ),
  eligible as (
    select t.uid
    from targets t
    left join public.notification_settings ns on ns.user_id = t.uid
    where coalesce((ns.mutes ->> v_template_key)::boolean, false) = false
      and not exists (
        select 1 from public.notifications n
        where n.template_key = v_template_key
          and n.payload_hash = p_hash
          and n.user_id = t.uid
          and n.created_at > (now_ts - interval '1 second')
      )
  ),
  ins as (
    insert into public.notifications
      (user_id, type, channel, status, sent_at, payload, template_key, payload_hash)
    select e.uid, v_template_key, 'in_app', 'sent', now_ts,
           jsonb_build_object(
             'title', rendered_title,
             'message', rendered_body,
             'template_key', v_template_key,
             'data', v_payload
           ),
           v_template_key,
           p_hash
    from eligible e
    returning id
  )
  select coalesce(array_agg(id), '{}') into inserted_ids from ins;

  return inserted_ids;
end;
$function$;