import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateStudentRequest {
  fullName: string;
  email: string;
  phone: string;
  feesStructure: string; // "1_installment", "2_installments", "3_installments"
}

const generateSecurePassword = (): string => {
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
  
  for (let i = password.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [password[i], password[j]] = [password[j], password[i]];
  }
  
  return password.join('');
};

const getAmountByPlan = (feesStructure: string): string => {
  switch (feesStructure) {
    case '1_installment':
      return '50,000';
    case '2_installments':
      return '25,000';
    case '3_installments':
      return '17,000';
    default:
      return '50,000';
  }
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const resend = new Resend(RESEND_API_KEY);

    const { fullName, email, phone, feesStructure }: CreateStudentRequest = await req.json();

    if (!fullName || !email || !phone || !feesStructure) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate secure temporary password
    const tempPassword = generateSecurePassword();
    console.log('Generated temp password for:', email);

    // Create user in Supabase Auth
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      user_metadata: {
        full_name: fullName
      }
    });

    if (authError) {
      console.error('Auth user creation error:', authError);
      return new Response(
        JSON.stringify({ error: `Failed to create auth user: ${authError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert into users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert({
        id: authUser.user.id,
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
      .select()
      .single();

    if (userError) {
      console.error('User table insertion error:', userError);
      // Cleanup: delete the auth user if DB insertion fails
      await supabase.auth.admin.deleteUser(authUser.user.id);
      return new Response(
        JSON.stringify({ error: `Failed to create user record: ${userError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch company settings
    const { data: companySettings, error: settingsError } = await supabase
      .from('company_settings')
      .select('invoice_send_gap_days, company_logo')
      .limit(1)
      .single();

    if (settingsError) {
      console.error('Company settings fetch error:', settingsError);
    }

    const invoiceDueDays = companySettings?.invoice_send_gap_days || 7;
    const companyLogo = companySettings?.company_logo || '';
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + invoiceDueDays);

    // Send Welcome Email
    const welcomeEmailResult = await resend.emails.send({
      from: "LMS Support <onboarding@resend.dev>",
      to: [email],
      subject: "Your LMS Account is Ready",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333; margin-bottom: 20px;">Welcome to IDM Pakistan LMS!</h1>
          <p style="color: #666; line-height: 1.6;">Dear ${fullName},</p>
          <p style="color: #666; line-height: 1.6;">Your LMS account has been successfully created. Here are your login credentials:</p>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #333;">Login Details</h3>
            <p style="margin: 5px 0;"><strong>Login URL:</strong> <a href="https://lms.idmpakistan.pk" style="color: #007bff;">https://lms.idmpakistan.pk</a></p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 5px 0;"><strong>Temporary Password:</strong> ${tempPassword}</p>
          </div>
          
          <p style="color: #666; line-height: 1.6;">Please change your password after your first login for security purposes.</p>
          <p style="color: #666; line-height: 1.6;">If you have any questions, please don't hesitate to contact our support team.</p>
          
          <p style="color: #666; line-height: 1.6;">Best regards,<br>IDM Pakistan Team</p>
        </div>
      `,
    });

    // Send Invoice Email
    const amount = getAmountByPlan(feesStructure);
    const invoiceEmailResult = await resend.emails.send({
      from: "IDM Pakistan Billing <billing@resend.dev>",
      to: [email],
      subject: "Your First LMS Invoice",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${companyLogo ? `<img src="${companyLogo}" alt="Company Logo" style="max-width: 200px; margin-bottom: 20px;">` : ''}
          
          <h1 style="color: #333; margin-bottom: 20px;">Invoice - LMS Enrollment</h1>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #333;">Student Information</h3>
            <p style="margin: 5px 0;"><strong>Name:</strong> ${fullName}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 5px 0;"><strong>Selected Plan:</strong> ${feesStructure.replace('_', ' ').toUpperCase()}</p>
          </div>
          
          <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #333;">Payment Details</h3>
            <p style="margin: 5px 0;"><strong>Amount Due:</strong> PKR ${amount}</p>
            <p style="margin: 5px 0;"><strong>Due Date:</strong> ${dueDate.toLocaleDateString()}</p>
          </div>
          
          <p style="color: #666; line-height: 1.6;">Please ensure payment is made by the due date to maintain uninterrupted access to your LMS account.</p>
          <p style="color: #666; line-height: 1.6;">For payment instructions or any billing questions, please contact our finance team.</p>
          
          <p style="color: #666; line-height: 1.6;">Thank you for choosing IDM Pakistan!</p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">This is an automated email. Please do not reply directly to this message.</p>
        </div>
      `,
    });

    console.log('Welcome email result:', welcomeEmailResult);
    console.log('Invoice email result:', invoiceEmailResult);

    const emailSent = !welcomeEmailResult.error && !invoiceEmailResult.error;

    return new Response(
      JSON.stringify({
        success: true,
        studentId: authUser.user.id,
        tempPassword: tempPassword,
        emailSent: emailSent
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in create-student-lms function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
};

serve(handler);