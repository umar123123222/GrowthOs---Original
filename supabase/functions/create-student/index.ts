
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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { fullName, email, phone, feesStructure }: CreateStudentRequest = await req.json();

    // Generate a temporary password for the new student
    const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';
    
    console.log('Creating student with email:', email);

    // Create auth user first
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName
      }
    });

    if (authError) {
      console.error('Auth error:', authError);
      throw authError;
    }

    console.log('User created successfully, updating profile...');

    // Update user with additional information
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ 
        role: 'student',
        full_name: fullName,
        phone: phone,
        fees_structure: feesStructure,
        lms_user_id: email, // Set LMS user ID to email
        lms_status: 'inactive' // Set status to inactive until first payment
      })
      .eq('id', authData.user.id);

    if (updateError) {
      console.error('Update error:', updateError);
      throw updateError;
    }

    console.log('Student created successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        tempPassword,
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
