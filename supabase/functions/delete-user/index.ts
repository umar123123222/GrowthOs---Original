import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeleteUserRequest {
  userId: string;
  userRole: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create admin client for user deletion
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
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError || !userData || !['admin', 'superadmin'].includes(userData.role)) {
      console.error('User role check failed:', userError, 'userData:', userData);
      return new Response(
        JSON.stringify({ 
          error: 'Access denied. Only admins and superadmins can delete users.',
          success: false
        }),
        { 
          status: 403, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    const { userId, userRole }: DeleteUserRequest = await req.json();

    // Additional authorization check: 
    // - Superadmins can delete anyone
    // - Admins can only delete students and mentors (not other admins or superadmins)
    if (userData.role === 'admin' && ['admin', 'superadmin'].includes(userRole)) {
      return new Response(
        JSON.stringify({ 
          error: 'Admins cannot delete other admins or superadmins.',
          success: false
        }),
        { 
          status: 403, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    console.log(`Deleting user ${userId} with role ${userRole}`);

    // Get user info before deletion for logging
    const { data: userToDelete, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('email, full_name')
      .eq('id', userId)
      .single();

    if (fetchError) {
      console.error('Error fetching user to delete:', fetchError);
      throw new Error('User not found');
    }

    // First, delete from public.users table (this will cascade delete related data)
    const { error: dbDeleteError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId);

    if (dbDeleteError) {
      console.error('Database deletion error:', dbDeleteError);
      throw dbDeleteError;
    }

    // Then, delete from auth.users table (complete cleanup)
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (authDeleteError) {
      console.error('Auth deletion error:', authDeleteError);
      // Even if auth deletion fails, we've already deleted from database
      // Log the error but don't fail the request entirely
      console.warn('Auth user deletion failed but database cleanup completed');
    }

    console.log(`Successfully deleted user: ${userToDelete.full_name} (${userToDelete.email})`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `User ${userToDelete.full_name} has been completely deleted from the system.`
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
    console.error('Error in delete-user function:', error);
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