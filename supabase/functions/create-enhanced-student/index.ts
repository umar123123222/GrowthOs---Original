import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1';
import { SMTPClient } from '../_shared/smtp-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateEnhancedStudentRequest {
  email: string;
  full_name: string;
  installment_count: number;
}

interface CreateEnhancedStudentResponse {
  success: boolean;
  data?: {
    id: string;
    email: string;
    full_name: string;
    role: string;
    student_id: string;
    lms_credentials: {
      lms_user_id: string;
      lms_password: string;
    };
    generated_password: string;
    created_at: string;
  };
  error?: string;
}

function generateSecurePassword(): string {
  const length = 12;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return password;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    console.log('Enhanced student creation started');

    // Initialize Supabase client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Parse request body
    const { email, full_name, installment_count }: CreateEnhancedStudentRequest = await req.json();
    console.log('Request data:', { email, full_name, installment_count });

    // Generate passwords
    const loginPassword = generateSecurePassword();
    const lmsPassword = generateSecurePassword();
    const lmsUserId = email; // LMS user ID is the email

    // Validate input
    if (!email || !full_name || !installment_count) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      return new Response(
        JSON.stringify({ success: false, error: 'User with this email already exists' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create user in auth.users
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: loginPassword,
      email_confirm: true,
      user_metadata: {
        full_name,
        role: 'student'
      }
    });

    if (authError) {
      console.error('Auth user creation error:', authError);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to create auth user: ${authError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create user profile in public.users
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authUser.user.id,
        email,
        full_name,
        role: 'student',
        password_display: loginPassword,
        lms_user_id: lmsUserId,
        status: 'active',
        lms_status: 'active',
        is_temp_password: true
      })
      .select()
      .single();

    if (profileError) {
      console.error('Profile creation error:', profileError);
      // Cleanup auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to create user profile: ${profileError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create student record
    const { data: studentRecord, error: studentError } = await supabaseAdmin
      .from('students')
      .insert({
        user_id: authUser.user.id,
        installment_count,
        lms_username: lmsUserId
      })
      .select()
      .single();

    if (studentError) {
      console.error('Student record creation error:', studentError);
      // Cleanup on failure
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to create student record: ${studentError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Add to email queue for credential delivery
    const { error: emailQueueError } = await supabaseAdmin
      .from('email_queue')
      .insert({
        user_id: authUser.user.id,
        email_type: 'student_credentials',
        recipient_email: email,
        recipient_name: full_name,
        credentials: {
          login_password: loginPassword,
          lms_user_id: lmsUserId,
          lms_password: lmsPassword,
          student_id: studentRecord.student_id
        }
      });

    if (emailQueueError) {
      console.error('Email queue error:', emailQueueError);
      // Continue anyway - email can be sent manually
    }

    // Send welcome email with credentials via SMTP
    try {
      const smtpClient = SMTPClient.fromEnv();
      
      await smtpClient.sendEmail({
        to: email,
        subject: 'Welcome to Growth OS - Your LMS Access Credentials',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome to Growth OS, ${full_name}!</h2>
            
            <p>Your student account has been created successfully. Here are your login credentials:</p>
            
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>LMS Access Credentials</h3>
              <p><strong>LMS User ID:</strong> ${lmsUserId}</p>
              <p><strong>LMS Password:</strong> ${lmsPassword}</p>
              <p><strong>Student ID:</strong> ${studentRecord.student_id}</p>
            </div>
            
            <div style="background-color: #e8f4fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>Platform Login Credentials</h3>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Password:</strong> ${loginPassword}</p>
            </div>
            
            <p><strong>Payment Plan:</strong> ${installment_count} installment${installment_count > 1 ? 's' : ''}</p>
            
            <p>Please keep these credentials secure. You can change your password after logging in.</p>
            
            <p>If you have any questions, please contact our support team.</p>
            
            <p>Best regards,<br>Growth OS Team</p>
          </div>
        `,
      });

      console.log('Email sent successfully via SMTP to:', email);

      // Update email queue status
      await supabaseAdmin
        .from('email_queue')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('user_id', authUser.user.id)
        .eq('email_type', 'student_credentials');
        
    } catch (emailError) {
      console.error('SMTP email sending error:', emailError);
      // Update email queue with error
      await supabaseAdmin
        .from('email_queue')
        .update({ 
          status: 'failed', 
          error_message: emailError instanceof Error ? emailError.message : 'Unknown SMTP error'
        })
        .eq('user_id', authUser.user.id)
        .eq('email_type', 'student_credentials');
    }

    // Create first invoice
    try {
      // Get company settings for fee calculation
      const { data: companySettings } = await supabaseAdmin
        .from('company_settings')
        .select('original_fee_amount')
        .single();

      const totalFee = companySettings?.original_fee_amount || 3000;
      const installmentAmount = totalFee / installment_count;
      
      // Create first invoice
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7); // Due in 7 days

      await supabaseAdmin
        .from('invoices')
        .insert({
          student_id: studentRecord.id,
          installment_number: 1,
          amount: installmentAmount,
          due_date: dueDate.toISOString(),
          status: 'pending'
        });

      console.log('First invoice created successfully');
    } catch (invoiceError) {
      console.error('Invoice creation error:', invoiceError);
      // Continue anyway - invoice can be created manually
    }

    const response: CreateEnhancedStudentResponse = {
      success: true,
      data: {
        id: authUser.user.id,
        email,
        full_name,
        role: 'student',
        student_id: studentRecord.student_id || '',
        lms_credentials: {
          lms_user_id: lmsUserId,
          lms_password: lmsPassword
        },
        generated_password: loginPassword,
        created_at: userProfile.created_at
      }
    };

    console.log('Enhanced student creation completed successfully');

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error in enhanced student creation:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
};

serve(handler);