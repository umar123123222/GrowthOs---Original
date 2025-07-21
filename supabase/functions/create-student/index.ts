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
  console.log('create-student function called with method:', req.method);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    console.log('Environment check:', {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      hasAnonKey: !!supabaseAnonKey
    });

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      throw new Error('Missing required environment variables');
    }

    // Create admin client for user creation
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Create regular client for authorization check
    const authHeader = req.headers.get('Authorization');
    console.log('Auth header present:', !!authHeader);
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader ?? '',
        },
      },
    });

    // Check if the current user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    console.log('Auth check result:', { 
      userId: user?.id, 
      email: user?.email,
      hasError: !!authError,
      errorMessage: authError?.message 
    });
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - please log in', success: false }),
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
      .select('role, email, full_name')
      .eq('id', user.id)
      .single();

    console.log('Role check result:', { 
      userData: userData ? { role: userData.role, email: userData.email } : null, 
      hasError: !!userError,
      errorMessage: userError?.message 
    });

    if (userError || !userData || !['admin', 'superadmin'].includes(userData.role)) {
      console.error('User role check failed:', userError, 'userData:', userData);
      return new Response(
        JSON.stringify({ 
          error: `Access denied - ${userData?.role || 'unknown'} role cannot create students`, 
          success: false
        }),
        { 
          status: 403, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    console.log('User authorized with role:', userData.role);

    // Parse request body
    const requestBody = await req.json();
    console.log('Request body:', requestBody);
    
    const { fullName, email, phone, feesStructure }: CreateStudentRequest = requestBody;

    // Validate required fields
    if (!fullName || !email || !feesStructure) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields: fullName, email, feesStructure', 
          success: false 
        }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

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

    console.log('Creating auth user for email:', email);

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
      return new Response(
        JSON.stringify({ 
          error: `Failed to create user account: ${authCreateError.message}`, 
          success: false 
        }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    console.log('Auth user created, inserting into users table...');

    // Insert user into public.users table using admin client
    const { error: insertError } = await supabaseAdmin
      .from('users')
      .insert({ 
        id: authData.user.id,
        email: email,
        role: 'student',
        full_name: fullName,
        phone: phone || null,
        fees_structure: feesStructure,
        lms_user_id: email, // Set LMS user ID to email
        lms_password: lmsPassword, // Store the LMS password
        temp_password: tempPassword, // Store the temp password for login
        lms_status: 'inactive' // Set status to inactive until first payment
      });

    if (insertError) {
      console.error('Insert error:', insertError);
      
      // Clean up auth user if database insert fails
      try {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        console.log('Cleaned up auth user after database insert failure');
      } catch (cleanupError) {
        console.error('Failed to cleanup auth user:', cleanupError);
      }
      
      return new Response(
        JSON.stringify({ 
          error: `Failed to create student record: ${insertError.message}`, 
          success: false 
        }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    console.log('Student created successfully with ID:', authData.user.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        tempPassword,
        lmsPassword,
        studentId: authData.user.id,
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
        error: `Server error: ${error.message}`,
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