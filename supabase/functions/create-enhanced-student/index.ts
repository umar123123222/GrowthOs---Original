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
  phone: string;
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

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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
    const { email, full_name, phone, installment_count }: CreateEnhancedStudentRequest = await req.json();
    console.log('Request data:', { email, full_name, phone, installment_count });

    // Generate passwords
    const loginPassword = generateSecurePassword();
    const lmsPassword = generateSecurePassword();
    const passwordHash = await hashPassword(loginPassword);
    const lmsUserId = email; // LMS user ID is the email

    // Validate input
    if (!email || !full_name || !phone || !installment_count) {
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
        phone: phone,
        role: 'student',
        password_display: loginPassword,
        password_hash: passwordHash,
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
              <p><strong>Student ID:</strong> ${studentRecord.student_id}</p>
              <p><strong>Installments:</strong> ${installment_count} installment${installment_count > 1 ? 's' : ''}</p>
              <p><strong>User ID:</strong> ${email}</p>
              <p><strong>Current Password:</strong> ${loginPassword}</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://majqoqagohicjigmsilu.lovable.app/login" 
                 style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
                Start Your Learning Journey
              </a>
            </div>
            
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
    // Create ALL installments at once
    try {
      const { data: companySettings } = await supabaseAdmin
        .from('company_settings')
        .select('original_fee_amount, invoice_overdue_days, invoice_send_gap_days')
        .single();

      if (companySettings) {
        const installmentAmount = companySettings.original_fee_amount / installment_count;
        const intervalDays = companySettings.invoice_send_gap_days || 30;
        
        // Create all installments
        const installments = [];
        for (let i = 1; i <= installment_count; i++) {
          const issueDate = new Date();
          issueDate.setDate(issueDate.getDate() + ((i - 1) * intervalDays));
          
          const dueDate = new Date(issueDate);
          dueDate.setDate(dueDate.getDate() + (companySettings.invoice_overdue_days || 5));

          installments.push({
            student_id: studentRecord.id,
            amount: installmentAmount,
            installment_number: i,
            due_date: dueDate.toISOString(),
            status: i === 1 ? 'pending' : 'scheduled',
            created_at: issueDate.toISOString()
          });
        }

        const { error: installmentError } = await supabaseAdmin
          .from('invoices')
          .insert(installments);

        if (installmentError) {
          console.error('Error creating installments:', installmentError);
        } else {
          console.log(`All ${installment_count} installments created successfully`);
        }
      }
      
      console.log('Installment creation completed successfully');
    } catch (invoiceError) {
      console.error('Invoice creation error:', invoiceError);
      // Continue anyway - invoices can be created manually
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