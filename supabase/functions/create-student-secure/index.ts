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

    // Check if user has permission to create students
    const { data: userRole, error: roleError } = await supabaseClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (roleError || !userRole || !['admin', 'superadmin', 'enrollment_manager'].includes(userRole.role)) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { full_name, email, phone, fees_structure } = await req.json()

    if (!full_name || !email || !phone || !fees_structure) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: full_name, email, phone, fees_structure' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Robust fees structure parsing function
    function parseFeesStructure(feesStructure: string): number {
      console.log('Parsing fees_structure:', feesStructure)
      
      // Use regex to extract number from both singular and plural forms
      const match = feesStructure.match(/^(\d+)_installments?$/)
      
      if (!match) {
        console.error('Invalid fees_structure format:', feesStructure)
        throw new Error(`Invalid fees_structure format: ${feesStructure}. Expected format: "N_installment" or "N_installments"`)
      }
      
      const installments = parseInt(match[1], 10)
      
      if (isNaN(installments) || installments < 1) {
        console.error('Invalid installment number:', match[1])
        throw new Error(`Invalid installment number: ${match[1]}. Must be a positive integer`)
      }
      
      console.log('Parsed installments:', installments)
      return installments
    }

    // Parse and validate fees structure
    let installments: number
    try {
      installments = parseFeesStructure(fees_structure)
    } catch (error) {
      console.error('Fees structure parsing error:', error.message)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid fees structure format',
          details: error.message
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate against company settings
    const { data: companySettings, error: settingsError } = await supabaseClient
      .from('company_settings')
      .select('maximum_installment_count')
      .single()

    if (settingsError || !companySettings) {
      console.error('Failed to fetch company settings:', settingsError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Configuration error',
          details: 'Unable to validate installment limits'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (installments > companySettings.maximum_installment_count) {
      console.error(`Installments ${installments} exceed maximum allowed ${companySettings.maximum_installment_count}`)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid installment count',
          details: `Installments (${installments}) exceed maximum allowed (${companySettings.maximum_installment_count})`
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if student already exists
    const { data: existingStudent } = await supabaseClient
      .from('users')
      .select('id')
      .eq('email', email)
      .eq('role', 'student')
      .single()

    if (existingStudent) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Student Email Exists',
          details: 'A student with this email already exists'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate secure temporary password
    const tempPassword = generateSecurePassword()

    // Create auth user
    const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
      email,
      password: tempPassword,
      user_metadata: {
        full_name,
        role: 'student'
      }
    })

    if (createError) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: createError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create student record using atomic function with validated installments
    console.log('Creating student with installments:', installments)
    const { data: studentResult, error: studentError } = await supabaseClient
      .rpc('create_student_atomic', {
        p_user_id: newUser.user.id, // Pass the auth user ID to prevent ID mismatch
        p_full_name: full_name,
        p_email: email,
        p_phone: phone,
        p_installments: installments
      })

    if (studentError) {
      // Rollback auth user if student creation fails
      await supabaseClient.auth.admin.deleteUser(newUser.user.id)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: studentError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send welcome email (placeholder for future implementation)
    console.log('Student created successfully:', {
      studentId: newUser.user.id,
      email,
      tempPassword: '[REDACTED]'
    })

    return new Response(
      JSON.stringify({
        success: true,
        studentId: newUser.user.id,
        tempPassword: tempPassword,
        emailSent: false, // TODO: Implement email sending
        invoiceCreated: true
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Student creation error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function generateSecurePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  let password = ''
  
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  
  return password
}