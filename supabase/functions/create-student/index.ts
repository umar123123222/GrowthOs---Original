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
  console.log('🚀 create-student function called:', req.method, req.url);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('✅ Handling CORS preflight');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Environment check
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    console.log('🔧 Environment variables:', {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      hasAnonKey: !!supabaseAnonKey,
      url: supabaseUrl
    });

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      console.error('❌ Missing environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error', success: false }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    // Parse request body
    let requestBody;
    try {
      requestBody = await req.json();
      console.log('📝 Request body:', requestBody);
    } catch (e) {
      console.error('❌ Failed to parse request body:', e);
      return new Response(
        JSON.stringify({ error: 'Invalid request body', success: false }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    const { fullName, email, phone, feesStructure }: CreateStudentRequest = requestBody;

    // Validate required fields
    if (!fullName || !email || !feesStructure) {
      console.error('❌ Missing required fields');
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

    // Create clients
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const authHeader = req.headers.get('Authorization');
    console.log('🔐 Auth header present:', !!authHeader);
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader ?? '',
        },
      },
    });

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    console.log('👤 Auth check:', { 
      userId: user?.id, 
      email: user?.email,
      hasError: !!authError 
    });
    
    if (authError || !user) {
      console.error('❌ Auth failed:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - please log in', success: false }),
        { 
          status: 401, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    // Check user role
    console.log('🔍 Checking role for user:', user.id);
    
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role, email, full_name')
      .eq('id', user.id)
      .single();

    console.log('👥 Role check:', { 
      role: userData?.role, 
      hasError: !!userError 
    });

    if (userError || !userData || !['admin', 'superadmin'].includes(userData.role)) {
      console.error('❌ Role check failed:', userError?.message, 'Role:', userData?.role);
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

    console.log('✅ User authorized with role:', userData.role);

    // Generate passwords
    const generatePassword = (): string => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
      let result = '';
      for (let i = 0; i < 12; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };

    const tempPassword = generatePassword();
    const lmsPassword = generatePassword();

    console.log('👤 Creating auth user for:', email);

    // Create auth user
    const { data: authData, error: authCreateError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName
      }
    });

    if (authCreateError) {
      console.error('❌ Auth user creation failed:', authCreateError.message);
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

    console.log('✅ Auth user created, ID:', authData.user.id);

    // Insert into users table
    const { error: insertError } = await supabaseAdmin
      .from('users')
      .insert({ 
        id: authData.user.id,
        email: email,
        role: 'student',
        full_name: fullName,
        phone: phone || null,
        fees_structure: feesStructure,
        lms_user_id: email,
        lms_password: lmsPassword,
        temp_password: tempPassword,
        lms_status: 'inactive'
      });

    if (insertError) {
      console.error('❌ Database insert failed:', insertError.message);
      
      // Cleanup auth user
      try {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        console.log('🧹 Cleaned up auth user');
      } catch (cleanupError) {
        console.error('❌ Cleanup failed:', cleanupError);
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

    console.log('🎉 Student created successfully!');

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
    console.error('💥 Unexpected error:', error.message, error.stack);
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

console.log('🚀 Starting create-student edge function...');
serve(handler);