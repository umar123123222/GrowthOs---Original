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

    const { target_email, target_password, target_role, target_full_name, target_metadata } = await req.json()

    if (!target_email || !target_password || !target_role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: target_email, target_password, target_role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check permissions using our database function
    const { data: permissionCheck, error: permissionError } = await supabaseClient
      .rpc('create_user_with_role', {
        target_email,
        target_password,
        target_role,
        target_full_name: target_full_name || null,
        target_metadata: target_metadata || {}
      })

    if (permissionError || permissionCheck?.error) {
      return new Response(
        JSON.stringify({ error: permissionCheck?.error || permissionError?.message }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create the auth user
    const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
      email: target_email,
      password: target_password,
      user_metadata: {
        full_name: target_full_name || target_email,
        role: target_role,
        ...target_metadata
      }
    })

    if (createError) {
      return new Response(
        JSON.stringify({ error: `Failed to create auth user: ${createError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create the profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .insert({
        id: newUser.user.id,
        email: target_email,
        full_name: target_full_name || target_email,
        role: target_role,
        metadata: target_metadata || {},
        created_by: user.id  // Automatically set the creator
      })
      .select()
      .single()

    if (profileError) {
      // Rollback: delete the auth user if profile creation fails
      await supabaseClient.auth.admin.deleteUser(newUser.user.id)
      return new Response(
        JSON.stringify({ error: `Failed to create profile: ${profileError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: newUser.user.id,
          email: target_email,
          role: target_role,
          full_name: target_full_name || target_email,
          created_at: profile.created_at
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