-- Remove redundant heavy triggers that caused statement timeouts on success_sessions insert/update
DROP TRIGGER IF EXISTS success_session_changes_trigger ON public.success_sessions;
DROP TRIGGER IF EXISTS success_session_notification_trigger ON public.success_sessions;

-- Keep learning-item-changed trigger, but scope success_sessions to admins/superadmins only (skip student fan-out)
CREATE OR REPLACE FUNCTION public.notify_on_learning_item_changed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  actor_name text;
  action text;
  item_type text;
  item_title text;
  item_id uuid;
  payload jsonb;
  target_roles text[];
BEGIN
  SELECT full_name INTO actor_name FROM public.users WHERE id = auth.uid();
  action := lower(tg_op);

  IF tg_table_name = 'available_lessons' THEN
    item_type := 'recording';
    item_title := coalesce(new.recording_title, old.recording_title);
    item_id := coalesce(new.id, old.id);
    target_roles := array['admin','superadmin','student'];
  ELSIF tg_table_name = 'assignments' THEN
    item_type := 'assignment';
    item_title := coalesce(new.name, old.name);
    item_id := coalesce(new.id, old.id);
    target_roles := array['admin','superadmin','student'];
  ELSIF tg_table_name = 'success_sessions' THEN
    item_type := 'success_session';
    item_title := coalesce(new.title, old.title);
    item_id := coalesce(new.id, old.id);
    -- Student notifications are handled by the app's targeted batch email flow
    target_roles := array['admin','superadmin'];
  ELSE
    RETURN coalesce(new, old);
  END IF;

  payload := jsonb_build_object(
    'changed_by_name', coalesce(actor_name, 'System'),
    'action', action,
    'item_type', item_type,
    'item_title', coalesce(item_title, 'Item'),
    'item_id', item_id
  );

  PERFORM public.notify_roles(target_roles, 'learning_item_changed', payload);

  RETURN coalesce(new, old);
END;
$function$;