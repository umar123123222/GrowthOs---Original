ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_shared_account boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.prevent_shared_account_self_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(OLD.is_shared_account, false)
     AND auth.uid() IS NOT NULL
     AND auth.uid() = OLD.id
     AND NOT public.has_any_role(ARRAY['admin','superadmin']::app_role[])
     AND (
       COALESCE(NEW.full_name, '') <> COALESCE(OLD.full_name, '')
       OR COALESCE(NEW.email, '') <> COALESCE(OLD.email, '')
       OR COALESCE(NEW.is_shared_account, false) <> COALESCE(OLD.is_shared_account, false)
     )
  THEN
    RAISE EXCEPTION 'This is a shared account. Name and email can only be changed by an administrator.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_shared_account_self_edit ON public.users;
CREATE TRIGGER prevent_shared_account_self_edit
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.prevent_shared_account_self_edit();