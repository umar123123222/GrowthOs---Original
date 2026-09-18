CREATE OR REPLACE FUNCTION public.prevent_shared_account_self_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.is_shared_account
     AND auth.uid() = OLD.id
     AND NOT public.has_any_role(ARRAY['admin','superadmin']::text[])
     AND (
       NEW.full_name IS DISTINCT FROM OLD.full_name
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.is_shared_account IS DISTINCT FROM OLD.is_shared_account
     )
  THEN
    RAISE EXCEPTION 'This is a shared account. Name and email can only be changed by an administrator.';
  END IF;
  RETURN NEW;
END;
$$;