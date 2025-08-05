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
      console.error('Authorization failed:', authError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { target_user_id } = await req.json()

    if (!target_user_id) {
      console.error('Missing target_user_id')
      return new Response(
        JSON.stringify({ error: 'Missing required field: target_user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Starting deletion process for user:', target_user_id)

    // Get user info before deletion for logging and verification
    const { data: userToDelete, error: userFetchError } = await supabaseClient
      .from('users')
      .select('role, student_id, full_name, email')
      .eq('id', target_user_id)
      .single()

    if (userFetchError || !userToDelete) {
      console.error('User not found in public.users:', userFetchError)
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Found user to delete:', { 
      id: target_user_id, 
      email: userToDelete.email, 
      role: userToDelete.role 
    })

    // Check if user exists in auth.users before attempting deletion
    const { data: authUser, error: authCheckError } = await supabaseClient.auth.admin.getUserById(target_user_id)
    
    if (authCheckError || !authUser.user) {
      console.error('User not found in auth.users:', authCheckError)
      return new Response(
        JSON.stringify({ error: 'User not found in authentication system' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('User found in auth.users, proceeding with deletion')

    // Delete the auth user first - this should trigger cascading deletion
    const { error: authDeleteError } = await supabaseClient.auth.admin.deleteUser(target_user_id)

    if (authDeleteError) {
      console.error('Failed to delete auth user:', authDeleteError)
      return new Response(
        JSON.stringify({ 
          error: `Failed to delete auth user: ${authDeleteError.message}`,
          details: authDeleteError
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Auth user deletion completed, verifying deletion...')

    // Verify auth user is actually deleted
    const { data: verifyAuthUser, error: verifyAuthError } = await supabaseClient.auth.admin.getUserById(target_user_id)
    
    if (!verifyAuthError && verifyAuthUser.user) {
      console.error('Auth user still exists after deletion attempt')
      return new Response(
        JSON.stringify({ error: 'Auth user deletion failed - user still exists' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Auth user successfully deleted, waiting for cascading deletion...')

    // Wait a moment for cascading deletion to complete
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Verify public user record is also deleted
    const { data: verifyPublicUser, error: verifyPublicError } = await supabaseClient
      .from('users')
      .select('id')
      .eq('id', target_user_id)
      .maybeSingle()

    if (verifyPublicUser) {
      console.error('Public user record still exists after deletion')
      
      // Attempt manual cleanup of public records
      console.log('Attempting manual cleanup of public records...')
      
      try {
        // Delete from students table first (due to foreign key constraints)
        await supabaseClient
          .from('students')
          .delete()
          .eq('user_id', target_user_id)

        // Delete from users table
        const { error: manualDeleteError } = await supabaseClient
          .from('users')
          .delete()
          .eq('id', target_user_id)

        if (manualDeleteError) {
          console.error('Manual cleanup failed:', manualDeleteError)
          return new Response(
            JSON.stringify({ 
              error: 'Partial deletion - auth user deleted but public records cleanup failed',
              details: manualDeleteError
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        console.log('Manual cleanup completed successfully')
      } catch (cleanupError) {
        console.error('Manual cleanup error:', cleanupError)
        return new Response(
          JSON.stringify({ 
            error: 'Partial deletion - auth user deleted but public records cleanup failed',
            details: cleanupError
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    console.log('User deletion completed successfully - both auth and public records removed')

    return new Response(
      JSON.stringify({
        success: true,
        message: 'User successfully deleted from both auth and public records',
        deleted_user: {
          id: target_user_id,
          email: userToDelete.email,
          role: userToDelete.role
        }
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