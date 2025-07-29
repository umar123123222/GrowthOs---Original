import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

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
    
    // SMTP Configuration for LMS emails
    const smtpConfig = {
      hostname: Deno.env.get("SMTP_HOST") || "",
      port: parseInt(Deno.env.get("SMTP_PORT") || "587"),
      username: Deno.env.get("SMTP_USER") || "",
      password: Deno.env.get("SMTP_PASSWORD") || "",
      from: Deno.env.get("SMTP_LMS_FROM_EMAIL") || "",
      fromName: Deno.env.get("SMTP_LMS_FROM_NAME") || "IDMPakistan LMS"
    };
    
    console.log('Environment check:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      hasSmtpConfig: !!(smtpConfig.hostname && smtpConfig.username)
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

    // Generate auto-incrementing student ID
    const { data: existingStudents, error: countError } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'student');
    
    if (countError) {
      console.error('Error counting students:', countError);
      throw new Error(`Failed to generate student ID: ${countError.message}`);
    }
    
    const studentCount = (existingStudents?.length || 0) + 1;
    const studentId = `STU${studentCount.toString().padStart(6, '0')}`;
    
    console.log('Generated student ID:', studentId);

    // Create student record with inactive status
    console.log('Attempting to insert student record...');
    
    const studentData = {
      id: authData.user.id,
      email,
      role: 'student',
      full_name: fullName,
      phone: phone || null,
      fees_structure: feesStructure,
      lms_user_id: email,
      temp_password: tempPassword,
      lms_status: 'inactive',
      onboarding_done: false,
      fees_overdue: true,
      created_by: createdBy
    };
    
    // Add student_id only if the column exists (try without it first)
    try {
      const testData = { ...studentData, student_id: studentId };
      console.log('Student data to insert (with student_id):', JSON.stringify(testData, null, 2));
      
      const { error: insertError } = await supabase
        .from('users')
        .insert(testData);
        
      if (insertError) {
        throw insertError;
      }
    } catch (firstAttemptError: any) {
      console.log('First attempt failed, trying without student_id column:', firstAttemptError.message);
      
      // Try without student_id column if it doesn't exist
      console.log('Student data to insert (without student_id):', JSON.stringify(studentData, null, 2));
      
      const { error: insertError } = await supabase
        .from('users')
        .insert(studentData);
        
      if (insertError) {
        console.error('Insert error details:', JSON.stringify(insertError, null, 2));
        throw new Error(`Failed to create student record: ${insertError.message} - Code: ${insertError.code} - Details: ${insertError.details || 'N/A'}`);
      }
    }

    console.log('Student record created');

    // Try to create initial invoice record (optional - won't fail if table doesn't exist)
    let invoiceResult = null;
    try {
      const invoiceData = {
        student_id: authData.user.id,
        student_email: email,
        student_name: fullName,
        fees_structure: feesStructure,
        amount: feesStructure === '1_installment' ? 50000 : 
                feesStructure === '2_installments' ? 25000 : 17000,
        currency: 'PKR',
        status: 'pending',
        due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days from now
        invoice_number: `INV-${studentId}-${Date.now()}`
      };

      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .insert(invoiceData)
        .select()
        .single();

      if (invoiceError) {
        console.warn('Could not create invoice (table may not exist):', invoiceError.message);
      } else {
        invoiceResult = invoiceData;
        console.log('Invoice created:', invoiceResult?.id);
      }
    } catch (invoiceError) {
      console.warn('Invoice creation failed (non-critical):', invoiceError);
    }

    let emailSent = false;
    
    // Try to send welcome email if SMTP is configured
    if (smtpConfig.hostname && smtpConfig.username) {
      try {
        const client = new SMTPClient({
          connection: {
            hostname: smtpConfig.hostname,
            port: smtpConfig.port,
            tls: smtpConfig.port === 465,
            auth: {
              username: smtpConfig.username,
              password: smtpConfig.password,
            },
          },
        });

        const fromAddress = smtpConfig.fromName 
          ? `${smtpConfig.fromName} <${smtpConfig.from}>` 
          : smtpConfig.from;

        const invoiceHTML = generateInvoiceHTML(fullName, email, feesStructure);

        await client.send({
          from: fromAddress,
          to: email,
          subject: 'Your IDMPakistan LMS account & login credentials',
          content: "auto",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Welcome to IDMPakistan LMS</h2>
              <p>Dear ${fullName},</p>
              <p>Your LMS account has been created successfully. Below are your login credentials:</p>
              
              <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h3>Login Details</h3>
                <p><strong>LMS URL:</strong> https://lms.idmpakistan.pk</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Temporary Password:</strong> ${tempPassword}</p>
              </div>
              
              <p style="color: #d9534f;"><strong>Important:</strong> Please change your password immediately after your first login for security purposes.</p>
              
              <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h3>Next Steps</h3>
                <p>• Log in to your LMS account using the credentials above</p>
                <p>• Complete your profile setup</p>
                <p>• Check your payment instructions for course fees</p>
                <p>• Contact support if you need any assistance</p>
              </div>
              
              <p>Thank you for joining IDMPakistan LMS! We're excited to help you on your learning journey.</p>
              <p>Best regards,<br>The IDMPakistan Team</p>
            </div>
          `,
        });

        await client.close();
        emailSent = true;
        console.log('Welcome email sent successfully via SMTP');

      } catch (emailError) {
        console.error('SMTP email error:', emailError);
        // Don't throw - student was created successfully
      }
    } else {
      console.log('SMTP not configured, skipping welcome email');
    }

    console.log('Student creation completed successfully');

    return new Response(JSON.stringify({ 
      success: true,
      studentId: studentId,
      lmsUserId: authData.user.id,
      invoiceId: invoiceResult?.id || null,
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