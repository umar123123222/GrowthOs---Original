import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateMemberRequest {
  email: string;
  full_name: string;
  role: string;
  temp_password: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Create team member function called");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    // Create a Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { email, full_name, role, temp_password }: CreateMemberRequest = await req.json();

    console.log(`Creating ${role} user: ${email}`);

    // Create auth user with admin client
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: temp_password,
      email_confirm: true,
      user_metadata: {
        full_name
      }
    });

    if (authError) {
      console.error('Auth creation error:', authError);
      throw authError;
    }

    console.log('Auth user created successfully:', authData.user.id);

    // Update user profile in the users table
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        full_name,
        email,
        role,
        status: 'Active',
        temp_password // Store for credential viewing
      })
      .eq('id', authData.user.id);

    if (updateError) {
      console.error('User profile update error:', updateError);
      throw updateError;
    }

    console.log('User profile updated successfully');

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Team member created successfully",
      user_id: authData.user.id 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in create-team-member function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);