-- Create a trigger to ensure complete user cleanup
-- This will handle cleanup if users are deleted directly from auth.users

-- Function to handle auth user deletion cleanup
CREATE OR REPLACE FUNCTION public.handle_auth_user_deleted()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete from public.users table when auth user is deleted
  DELETE FROM public.users WHERE id = OLD.id;
  
  -- Log the deletion
  INSERT INTO public.admin_logs (
    entity_type,
    entity_id,
    action,
    description,
    performed_by
  ) VALUES (
    'user',
    OLD.id,
    'auth_deleted',
    'User deleted from auth system, cleanup performed',
    OLD.id
  );
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users for deletion
CREATE OR REPLACE TRIGGER on_auth_user_deleted
  AFTER DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_deleted();

-- Ensure the edge function has the proper config
-- Add any cleanup policies needed for related tables
CREATE POLICY "Allow cascade deletes for user data" ON public.user_activity_logs
FOR DELETE USING (true);