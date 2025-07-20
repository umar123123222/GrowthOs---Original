import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const emailsToDelete = ['test0@gmail.com', 'idmpakistan@gmail.com'];
    const results = [];

    for (const email of emailsToDelete) {
      console.log(`Checking auth user with email: ${email}`);
      
      // Check if user exists in auth
      const { data: userData, error: fetchError } = await supabaseAdmin.auth.admin.getUserByEmail(email);
      
      if (fetchError) {
        console.log(`No auth user found for ${email}: ${fetchError.message}`);
        results.push({
          email,
          status: 'not_found',
          message: `No auth user found with email ${email}`
        });
        continue;
      }

      if (userData.user) {
        console.log(`Found auth user: ${email}, ID: ${userData.user.id}`);
        
        // Delete from auth system
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userData.user.id);
        
        if (deleteError) {
          console.error(`Failed to delete auth user ${email}:`, deleteError);
          results.push({
            email,
            status: 'error',
            message: `Failed to delete: ${deleteError.message}`
          });
        } else {
          console.log(`Successfully deleted auth user: ${email}`);
          results.push({
            email,
            status: 'deleted',
            message: `Successfully deleted from auth system`
          });
        }
      } else {
        results.push({
          email,
          status: 'not_found',
          message: `No auth user found with email ${email}`
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        results
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error('Error in cleanup-auth function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);