import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    
    // Verify the caller's token
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { target_user_id } = await req.json()

    if (!target_user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: target_user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // First check user role and permissions
    const { data: userToDelete, error: userFetchError } = await supabaseClient
      .from('users')
      .select('role')
      .eq('id', target_user_id)
      .single()

    if (userFetchError || !userToDelete) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Use the appropriate deletion function based on user role
    let deletionResult, deletionError;
    
    if (userToDelete.role === 'student') {
      const result = await supabaseClient.rpc('delete_student_atomic', {
        p_user_id: target_user_id
      })
      deletionResult = result.data
      deletionError = result.error
    } else {
      // For non-student users, delete related records manually
      // Delete notifications first (this was causing the FK constraint error)
      await supabaseClient
        .from('notifications')
        .delete()
        .eq('user_id', target_user_id)
      
      // Delete from users table
      const result = await supabaseClient
        .from('users')
        .delete()
        .eq('id', target_user_id)
      
      deletionResult = result.data
      deletionError = result.error
    }

    if (deletionError || deletionResult?.error) {
      return new Response(
        JSON.stringify({ error: deletionResult?.error || deletionError?.message }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Delete the auth user
    const { error: authDeleteError } = await supabaseClient.auth.admin.deleteUser(target_user_id)

    if (authDeleteError) {
      return new Response(
        JSON.stringify({ error: `Failed to delete auth user: ${authDeleteError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'User successfully deleted'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})