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

    // Delete all related data in the correct order to avoid FK constraint violations
    console.log('Starting deletion process for user:', target_user_id)
    
    // Delete notifications first
    await supabaseClient.from('notifications').delete().eq('user_id', target_user_id)
    console.log('Deleted notifications')
    
    // Delete other related records
    await supabaseClient.from('user_activity_logs').delete().eq('user_id', target_user_id)
    await supabaseClient.from('recording_views').delete().eq('user_id', target_user_id)
    await supabaseClient.from('quiz_attempts').delete().eq('user_id', target_user_id)
    await supabaseClient.from('progress').delete().eq('user_id', target_user_id)
    await supabaseClient.from('feedback').delete().eq('user_id', target_user_id)
    await supabaseClient.from('assignment_submissions').delete().eq('user_id', target_user_id)
    await supabaseClient.from('support_tickets').delete().eq('user_id', target_user_id)
    await supabaseClient.from('ticket_replies').delete().eq('user_id', target_user_id)
    await supabaseClient.from('messages').delete().eq('user_id', target_user_id)
    await supabaseClient.from('installment_payments').delete().eq('user_id', target_user_id)
    await supabaseClient.from('certificates').delete().eq('user_id', target_user_id)
    await supabaseClient.from('session_attendance').delete().eq('user_id', target_user_id)
    await supabaseClient.from('user_badges').delete().eq('user_id', target_user_id)
    await supabaseClient.from('leaderboard').delete().eq('user_id', target_user_id)
    await supabaseClient.from('performance_record').delete().eq('user_id', target_user_id)
    await supabaseClient.from('onboarding_responses').delete().eq('user_id', target_user_id)
    await supabaseClient.from('mentorship_notes').delete().eq('student_id', target_user_id)
    console.log('Deleted all related records')

    // Finally delete the user record
    const { error: deletionError } = await supabaseClient
      .from('users')
      .delete()
      .eq('id', target_user_id)
    
    console.log('Deleted user record, error:', deletionError)

    if (deletionError) {
      return new Response(
        JSON.stringify({ error: deletionError.message }),
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