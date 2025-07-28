import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateStudentRequest {
  fullName: string;
  email: string;
  phone: string;
  feesStructure: string;
}

// Cryptographically secure password generator
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
  
  // Fisher-Yates shuffle with crypto random
  for (let i = password.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [password[i], password[j]] = [password[j], password[i]];
  }
  
  return password.join('');
}

// Generate simple invoice HTML (avoiding PDF for now)
function generateInvoiceHTML(studentName: string, email: string, feesStructure: string): string {
  const feeAmount = feesStructure === '1_installment' ? '50,000' : 
                   feesStructure === '2_installments' ? '25,000' : '17,000';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Invoice - IDMPakistan LMS</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .invoice-details { margin: 20px 0; }
        .payment-info { background: #f5f5f5; padding: 15px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>IDMPakistan LMS</h1>
        <h2>INVOICE</h2>
      </div>
      
      <div class="invoice-details">
        <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
        <p><strong>Invoice #:</strong> INV-${Date.now()}</p>
        
        <h3>Bill To:</h3>
        <p>${studentName}</p>
        <p>${email}</p>
        
        <h3>Fee Structure:</h3>
        <p><strong>Payment Plan:</strong> ${feesStructure.replace('_', ' ').toUpperCase()}</p>
        <p><strong>Amount Due:</strong> PKR ${feeAmount}</p>
      </div>
      
      <div class="payment-info">
        <h3>Payment Instructions:</h3>
        <ul>
          <li>Pay within 14 days of invoice date</li>
          <li>Send proof of payment to billing@idmpakistan.pk</li>
          <li>Accounts with unpaid invoices are deleted after 2 weeks</li>
        </ul>
      </div>
    </body>
    </html>
  `;
}

const handler = async (req: Request): Promise<Response> => {
  console.log('Function called, method:', req.method);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    
    console.log('Environment check:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      hasResendKey: !!resendApiKey
    });

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const requestBody = await req.text();
    console.log('Request body:', requestBody);
    
    const { fullName, email, phone, feesStructure }: CreateStudentRequest = JSON.parse(requestBody);

    // Generate secure temporary password
    const tempPassword = generateSecurePassword();

    console.log('Creating student account for:', email);

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      user_metadata: { full_name: fullName },
      email_confirm: true
    });

    if (authError || !authData.user) {
      console.error('Auth error:', authError);
      throw new Error(`Failed to create auth user: ${authError?.message}`);
    }

    console.log('Auth user created:', authData.user.id);

    // Get the current user for created_by field
    const authHeader = req.headers.get('Authorization');
    let createdBy = null;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      createdBy = user?.id;
    }

    // Create student record with inactive status
    const { error: insertError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email,
        role: 'student',
        full_name: fullName,
        phone: phone || null,
        fees_structure: feesStructure,
        lms_user_id: email,
        lms_password: tempPassword,
        temp_password: tempPassword,
        lms_status: 'inactive',
        status: 'inactive', // Key: Start as inactive until payment
        first_login_complete: false,
        onboarding_done: false,
        created_by: createdBy
      });

    if (insertError) {
      console.error('Insert error:', insertError);
      throw new Error(`Failed to create student record: ${insertError.message}`);
    }

    console.log('Student record created');

    let emailSent = false;
    
    // Try to send welcome email if Resend is configured
    if (resendApiKey) {
      try {
        const resend = new Resend(resendApiKey);
        const invoiceHTML = generateInvoiceHTML(fullName, email, feesStructure);

        const emailResult = await resend.emails.send({
          from: 'IDMPakistan LMS <noreply@idmpakistan.pk>',
          to: [email],
          subject: 'Your IDMPakistan LMS account & first invoice',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Welcome to IDMPakistan LMS</h2>
              <p>Dear ${fullName},</p>
              <p>Your LMS account has been created and your first invoice is attached to this email.</p>
              
              <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h3>Login Details</h3>
                <p><strong>LMS URL:</strong> https://lms.idmpakistan.pk</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Password:</strong> ${tempPassword}</p>
              </div>
              
              <p><strong>Important:</strong> Please change your password immediately after signing in.</p>
              
              <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h3>Payment Instructions</h3>
                <p>• Pay your invoice within fourteen days</p>
                <p>• Send proof of payment to <strong>billing@idmpakistan.pk</strong></p>
                <p>• Note that accounts with unpaid invoices are automatically deleted after two weeks</p>
              </div>
              
              <p>Thank you for joining IDMPakistan LMS!</p>
              <p>Best regards,<br>The IDMPakistan Team</p>
            </div>
          `,
          attachments: [
            {
              filename: `invoice-${fullName.replace(/\s+/g, '-')}.html`,
              content: invoiceHTML
            }
          ]
        });

        console.log('Email result:', emailResult);
        emailSent = !emailResult.error;
        
        if (emailResult.error) {
          console.error('Email sending failed:', emailResult.error);
        }
      } catch (emailError) {
        console.error('Email error:', emailError);
        // Don't throw - student was created successfully
      }
    } else {
      console.log('RESEND_API_KEY not configured, skipping email');
    }

    console.log('Student creation completed successfully');

    return new Response(JSON.stringify({ 
      success: true,
      studentId: authData.user.id,
      tempPassword,
      emailSent
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in create-student-complete function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);