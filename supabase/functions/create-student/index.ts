
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateStudentRequest {
  fullName: string;
  email: string;
  phone: string;
  feesStructure: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create admin client for user creation
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Create regular client for authorization check
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: req.headers.get('Authorization') ?? '',
          },
        },
      }
    );

    // Check authentication and user role
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    console.log('Auth check result:', { user: user?.id, error: authError });
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized', success: false }),
        { 
          status: 401, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    // Check user role using admin client to bypass RLS
    console.log('Checking role for user:', user.id);
    
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    console.log('Role check result:', { userData, error: userError });

    if (userError || !userData || !['admin', 'superadmin'].includes(userData.role)) {
      console.error('User role check failed:', userError, 'userData:', userData);
      return new Response(
        JSON.stringify({ 
          error: 'Access denied. Only admins and superadmins can create student accounts.',
          success: false
        }),
        { 
          status: 403, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    console.log('User authorized with role:', userData.role);

    const { fullName, email, phone, feesStructure }: CreateStudentRequest = await req.json();

    // Generate a secure temporary password for the new student
    const generateSecurePassword = (): string => {
      const length = Math.floor(Math.random() * 5) + 8; // 8-12 characters
      const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const lowercase = 'abcdefghijklmnopqrstuvwxyz';
      const numbers = '0123456789';
      const special = '!@#$%^&*';
      
      // Ensure at least one character from each type
      let password = '';
      password += uppercase[Math.floor(Math.random() * uppercase.length)];
      password += lowercase[Math.floor(Math.random() * lowercase.length)];
      password += numbers[Math.floor(Math.random() * numbers.length)];
      password += special[Math.floor(Math.random() * special.length)];
      
      // Fill the rest randomly
      const allChars = uppercase + lowercase + numbers + special;
      for (let i = password.length; i < length; i++) {
        password += allChars[Math.floor(Math.random() * allChars.length)];
      }
      
      // Shuffle the password
      return password.split('').sort(() => Math.random() - 0.5).join('');
    };

    const tempPassword = generateSecurePassword();
    const lmsPassword = generateSecurePassword(); // Separate LMS password

    // Check if user already exists first
    const { data: existingUser } = await supabaseAdmin.auth.admin.getUserByEmail(email);
    
    if (existingUser.user) {
      console.log('User already exists with this email');
      return new Response(
        JSON.stringify({ 
          error: 'A user with this email address already exists. Please use a different email.',
          success: false
        }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    // Create auth user first using admin client
    const { data: authData, error: authCreateError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName
      }
    });

    if (authCreateError) {
      console.error('Auth creation error:', authCreateError);
      throw authCreateError;
    }

    console.log('Creating student with email:', email);

    // Insert user into public.users table using admin client
    const { error: insertError } = await supabaseAdmin
      .from('users')
      .insert({ 
        id: authData.user.id,
        email: email,
        role: 'student',
        full_name: fullName,
        phone: phone,
        fees_structure: feesStructure,
        lms_user_id: email, // Set LMS user ID to email
        lms_password: lmsPassword, // Store the LMS password
        temp_password: tempPassword, // Store the temp password for login
        lms_status: 'inactive' // Set status to inactive until first payment
      });

    if (insertError) {
      console.error('Insert error:', insertError);
      throw insertError;
    }

    console.log('Student created successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        tempPassword,
        lmsPassword,
        message: 'Student created successfully'
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error('Error in create-student function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false
      }),
      {
        status: 500,
        headers: { 
          'Content-Type': 'application/json', 
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);
