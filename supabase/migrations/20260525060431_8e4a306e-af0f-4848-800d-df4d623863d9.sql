
-- 1) Allow viewer in validation trigger
CREATE OR REPLACE FUNCTION public.validate_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role NOT IN ('superadmin', 'admin', 'enrollment_manager', 'mentor', 'student', 'support_member', 'viewer') THEN
    RAISE EXCEPTION 'Invalid role: %', NEW.role;
  END IF;
  RETURN NEW;
END;
$$;

-- 2) Add login_blocked column
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS login_blocked boolean NOT NULL DEFAULT false;

-- 3) Permissioned RPC to set login_blocked
CREATE OR REPLACE FUNCTION public.set_user_login_blocked(
  target_user_id uuid,
  blocked boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role text;
  target_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF auth.uid() = target_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'You cannot ban yourself');
  END IF;

  SELECT role INTO caller_role FROM public.users WHERE id = auth.uid();
  SELECT role INTO target_role FROM public.users WHERE id = target_user_id;

  IF target_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target user not found');
  END IF;

  IF caller_role = 'superadmin' THEN
    IF target_role = 'superadmin' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Cannot ban another superadmin');
    END IF;
  ELSIF caller_role = 'admin' THEN
    IF target_role NOT IN ('viewer', 'support_member', 'mentor') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Admins can only ban viewers, support members, and mentors');
    END IF;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
  END IF;

  UPDATE public.users
  SET login_blocked = blocked,
      updated_at = now()
  WHERE id = target_user_id;

  INSERT INTO public.admin_logs (performed_by, action, entity_type, entity_id, description, data)
  VALUES (
    auth.uid(),
    CASE WHEN blocked THEN 'login_banned' ELSE 'login_unbanned' END,
    'user',
    target_user_id,
    CASE WHEN blocked THEN 'Banned user from logging in' ELSE 'Restored user login access' END,
    jsonb_build_object('target_role', target_role, 'blocked', blocked)
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_user_login_blocked(uuid, boolean) TO authenticated;
