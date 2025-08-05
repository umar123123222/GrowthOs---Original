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

    // Get user info before deletion
    const { data: userToDelete, error: userFetchError } = await supabaseClient
      .from('users')
      .select('role, student_id, full_name')
      .eq('id', target_user_id)
      .single()

    if (userFetchError || !userToDelete) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Delete the auth user first - this will trigger cascading deletion of all related records
    console.log('Starting deletion process for user:', target_user_id)
    
    const { error: authDeleteError } = await supabaseClient.auth.admin.deleteUser(target_user_id)

    if (authDeleteError) {
      return new Response(
        JSON.stringify({ error: `Failed to delete auth user: ${authDeleteError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Successfully deleted user from auth and triggered cascading deletion')

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