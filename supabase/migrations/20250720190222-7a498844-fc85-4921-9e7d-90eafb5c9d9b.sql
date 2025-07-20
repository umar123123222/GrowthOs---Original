-- Add role check back to the edge function and ensure proper access for student accounts
-- First, let's make sure all users table policies allow proper access for students

-- Update RLS policies to ensure students can access their own data after account creation
DROP POLICY IF EXISTS "Students can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Students can update their own profile" ON public.users;

-- Create more comprehensive policies for students
CREATE POLICY "Students can view their own profile" 
ON public.users 
FOR SELECT 
USING (auth.uid() = id AND role = 'student');

CREATE POLICY "Students can update their own profile" 
ON public.users 
FOR UPDATE 
USING (auth.uid() = id AND role = 'student')
WITH CHECK (auth.uid() = id AND role = 'student');

-- Ensure students can authenticate and access the system
CREATE POLICY "Students can read their own user data for login" 
ON public.users 
FOR SELECT 
USING (auth.uid() = id);

-- Make sure admins and superadmins can create students (add this if not exists)
CREATE POLICY "Admins and superadmins can insert students" 
ON public.users 
FOR INSERT 
WITH CHECK (get_current_user_role() = ANY (ARRAY['superadmin'::text, 'admin'::text]));