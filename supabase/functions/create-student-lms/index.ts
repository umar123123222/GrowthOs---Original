import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from "npm:resend@2.0.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateStudentRequest {
  fullName: string;
  email: string;
  phone: string;
  feesStructure: string;
}

// Generate cryptographically secure temporary password
function generateSecurePassword(): string {
  const length = 12 + Math.floor(crypto.getRandomValues(new Uint8Array(1))[0] % 5);
  
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()-_+=[]{}:;\'\"<>?,./';
  const allChars = uppercase + lowercase + numbers + symbols;
  
  const getSecureRandomChar = (charset: string): string => {
    const randomIndex = crypto.getRandomValues(new Uint32Array(1))[0] % charset.length;
    return charset[randomIndex];
  };
  
  let password = [
    getSecureRandomChar(uppercase),
    getSecureRandomChar(lowercase),
    getSecureRandomChar(numbers),
    getSecureRandomChar(symbols)
  ];
  
  for (let i = password.length; i < length; i++) {
    password.push(getSecureRandomChar(allChars));
  }
  
  // Shuffle using Fisher-Yates algorithm
  for (let i = password.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [password[i], password[j]] = [password[j], password[i]];
  }
  
  return password.join('');
}

function generateWelcomeEmailHTML(fullName: string, email: string, password: string): string {
  return `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb;">Welcome to IDM Pakistan LMS!</h2>
          <p>Dear ${fullName},</p>
          <p>Your LMS account has been successfully created. Here are your login credentials:</p>
          
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Login Details:</h3>
            <p><strong>LMS URL:</strong> <a href="https://lms.idmpakistan.pk" target="_blank">https://lms.idmpakistan.pk</a></p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Password:</strong> ${password}</p>
          </div>
          
          <p><strong>Important:</strong> Please keep these credentials secure and change your password after your first login.</p>
          
          <p>If you have any questions, please don't hesitate to contact our support team.</p>
          
          <p>Best regards,<br>IDM Pakistan Team</p>
        </div>
      </body>
    </html>
  `;
}

function generateInvoiceEmailHTML(
  fullName: string, 
  email: string, 
  feesStructure: string, 
  dueDate: string, 
  amount: string, 
  companyLogo: string
): string {
  return `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          ${companyLogo ? `<img src="${companyLogo}" alt="Company Logo" style="max-width: 200px; margin-bottom: 20px;">` : ''}
          
          <h2 style="color: #2563eb;">Invoice - IDM Pakistan LMS</h2>
          
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Student Information:</h3>
            <p><strong>Name:</strong> ${fullName}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Plan:</strong> ${feesStructure.replace('_', ' ').replace('installments', 'Installments').replace('installment', 'Installment')}</p>
          </div>
          
          <div style="background: #fee2e2; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #dc2626;">Payment Details:</h3>
            <p><strong>Amount Due:</strong> PKR ${amount}</p>
            <p><strong>Due Date:</strong> ${dueDate}</p>
          </div>
          
          <p>Please ensure payment is made by the due date to avoid any interruption in your LMS access.</p>
          
          <p>For payment instructions or questions, please contact our billing department.</p>
          
          <p>Thank you for choosing IDM Pakistan!</p>
          
          <p>Best regards,<br>IDM Pakistan Billing Team</p>
        </div>
      </body>
    </html>
  `;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendApiKey = Deno.env.get('RESEND_API_KEY')!

    if (!supabaseUrl || !supabaseServiceKey || !resendApiKey) {
      throw new Error('Missing required environment variables')
    }

    // Create Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const resend = new Resend(resendApiKey)

    // Parse request body
    const { fullName, email, phone, feesStructure }: CreateStudentRequest = await req.json()

    // Validate required fields
    if (!fullName || !email || !phone || !feesStructure) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate fees structure
    if (!['1_installment', '2_installments', '3_installments'].includes(feesStructure)) {
      return new Response(
        JSON.stringify({ error: 'Invalid fees structure' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate secure temporary password
    const tempPassword = generateSecurePassword()

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      user_metadata: {
        full_name: fullName
      }
    })

    if (authError || !authData.user) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: `Failed to create auth user: ${authError?.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Insert user record
    const { error: userError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email,
        full_name: fullName,
        phone,
        fees_structure: feesStructure,
        lms_user_id: email,
        lms_password: tempPassword,
        temp_password: tempPassword,
        lms_status: 'inactive',
        role: 'student'
      })

    if (userError) {
      console.error('User insert error:', userError)
      // Clean up auth user if user insert fails
      await supabase.auth.admin.deleteUser(authData.user.id)
      return new Response(
        JSON.stringify({ error: `Failed to create user record: ${userError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch company settings
    const { data: companySettings } = await supabase
      .from('company_settings')
      .select('invoice_send_gap_days, company_logo')
      .limit(1)
      .single()

    const invoiceDueDays = companySettings?.invoice_send_gap_days || 7
    const companyLogo = companySettings?.company_logo || ''

    // Calculate due date
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + invoiceDueDays)
    const dueDateString = dueDate.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })

    // Determine amount based on fees structure
    const amountMap = {
      '1_installment': '50,000',
      '2_installments': '25,000',
      '3_installments': '17,000'
    }
    const amount = amountMap[feesStructure as keyof typeof amountMap]

    // Send welcome email
    const welcomeEmailHTML = generateWelcomeEmailHTML(fullName, email, tempPassword)
    
    await resend.emails.send({
      from: 'IDM Pakistan <noreply@idmpakistan.pk>',
      to: [email],
      subject: 'Your LMS Account is Ready',
      html: welcomeEmailHTML
    })

    // Send invoice email
    const invoiceEmailHTML = generateInvoiceEmailHTML(
      fullName, 
      email, 
      feesStructure, 
      dueDateString, 
      amount, 
      companyLogo
    )
    
    await resend.emails.send({
      from: 'IDM Pakistan Billing <billing@idmpakistan.pk>',
      to: [email],
      subject: 'Your First LMS Invoice',
      html: invoiceEmailHTML
    })

    return new Response(
      JSON.stringify({
        success: true,
        studentId: authData.user.id,
        tempPassword: tempPassword,
        emailSent: true
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error: any) {
    console.error('Error in create-student-lms function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
}

serve(handler)