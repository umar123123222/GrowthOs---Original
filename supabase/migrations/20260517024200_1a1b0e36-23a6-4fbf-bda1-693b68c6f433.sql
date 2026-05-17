
-- Notify all students who can see a given resource when it is added or edited.
CREATE OR REPLACE FUNCTION public.notify_resource_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_title text;
  v_message text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'insert';
  ELSIF TG_OP = 'UPDATE' THEN
    -- Avoid noisy notifications: only notify on meaningful content changes.
    IF NEW.title IS NOT DISTINCT FROM OLD.title
       AND NEW.description IS NOT DISTINCT FROM OLD.description
       AND NEW.content IS NOT DISTINCT FROM OLD.content
       AND NEW.is_active IS NOT DISTINCT FROM OLD.is_active THEN
      RETURN NEW;
    END IF;
    v_action := 'update';
  ELSE
    RETURN NEW;
  END IF;

  IF NEW.is_active IS DISTINCT FROM TRUE THEN
    RETURN NEW;
  END IF;

  v_title := CASE WHEN v_action = 'insert'
    THEN 'Resource added: ' || COALESCE(NEW.title, 'New resource')
    ELSE 'Resource updated: ' || COALESCE(NEW.title, 'Resource')
  END;
  v_message := COALESCE(NULLIF(NEW.description, ''), 'A new resource is available for you.');

  INSERT INTO public.notifications (user_id, type, template_key, channel, status, sent_at, payload)
  SELECT
    u.id,
    'resource_changed',
    'resource_changed',
    'in_app',
    'sent',
    now(),
    jsonb_build_object(
      'title', v_title,
      'message', v_message,
      'data', jsonb_build_object(
        'resource_id', NEW.id,
        'section_id', NEW.section_id,
        'action', v_action,
        'title', NEW.title
      )
    )
  FROM public.users u
  JOIN public.user_roles ur ON ur.user_id = u.id AND ur.role = 'student'
  WHERE public.user_can_see_resource(u.id, NEW.id) = true;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_resource_change ON public.resources;
CREATE TRIGGER trg_notify_resource_change
AFTER INSERT OR UPDATE ON public.resources
FOR EACH ROW EXECUTE FUNCTION public.notify_resource_change();
