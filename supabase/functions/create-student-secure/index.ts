import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateStudentRequest {
  full_name: string;
  email: string;
  phone: string;
  fees_structure: string;
}

function generateSecurePassword(): string {
  const length = 14;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return password;
}

function generateStudentId(existingStudents: any[]): string {
  const maxId = existingStudents
    .filter(s => s.student_id && s.student_id.startsWith('STU'))
    .map(s => parseInt(s.student_id.slice(3)))
    .reduce((max, id) => Math.max(max, id || 0), 0);
  
  return `STU${String(maxId + 1).padStart(6, '0')}`;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get JWT token from request
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify JWT and get user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check user role
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return new Response(JSON.stringify({ success: false, error: 'User not found' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const allowedRoles = ['superadmin', 'admin', 'enrollment_manager'];
    if (!allowedRoles.includes(userData.role)) {
      return new Response(JSON.stringify({ success: false, error: 'Insufficient permissions' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const { full_name, email, phone, fees_structure }: CreateStudentRequest = await req.json();

    // Validate input
    if (!full_name || full_name.length < 3) {
      return new Response(JSON.stringify({ success: false, error: 'Full name must be at least 3 characters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid email format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!phone || !/^\+\d{10,}$/.test(phone)) {
      return new Response(JSON.stringify({ success: false, error: 'Phone must start with + and have at least 10 digits' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!fees_structure) {
      return new Response(JSON.stringify({ success: false, error: 'Fees structure is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check email uniqueness
    const { data: existingUser, error: existingError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existingUser) {
      return new Response(JSON.stringify({ success: false, error: 'Student Email Exists' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get existing students for ID generation
    const { data: students } = await supabase
      .from('users')
      .select('student_id')
      .eq('role', 'student');

    // Generate student ID and temp password
    const studentId = generateStudentId(students || []);
    const tempPassword = generateSecurePassword();
    
    console.log('Creating auth user with:', { email: email.toLowerCase(), tempPassword });

    // Create auth user
    const { data: authUser, error: createAuthError } = await supabase.auth.admin.createUser({
      email: email.toLowerCase(),
      password: tempPassword,
      email_confirm: true,
    });

    if (createAuthError || !authUser.user) {
      console.error('Auth user creation error:', {
        error: createAuthError,
        authUser,
        email: email.toLowerCase(),
        passwordLength: tempPassword.length
      });
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to create auth user',
        details: createAuthError?.message || 'Unknown error'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create user record
    const { error: insertError } = await supabase
      .from('users')
      .insert({
        id: authUser.user.id,
        email: email.toLowerCase(),
        full_name,
        phone,
        role: 'student',
        fees_structure,
        student_id: studentId,
        lms_user_id: email.toLowerCase(),
        lms_password: tempPassword,
        lms_status: 'inactive',
        created_by: user.id,
        status: 'Active',
        onboarding_done: false,
      });

    if (insertError) {
      console.error('User insert error:', insertError);
      // Clean up auth user if database insert fails
      await supabase.auth.admin.deleteUser(authUser.user.id);
      return new Response(JSON.stringify({ success: false, error: 'Failed to create user record' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get company settings for email
    const { data: companySettings } = await supabase
      .from('company_settings')
      .select('company_email, company_name')
      .single();

    const fromEmail = companySettings?.company_email || 'admin@company.com';
    const companyName = companySettings?.company_name || 'Your Company';

    // Send login details email via SMTP (optional - won't fail if missing)
    let emailSent = false;
    
    console.log('Starting email sending process...');
    
    try {
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      console.log('RESEND_API_KEY configured:', !!resendApiKey);
      
      if (resendApiKey) {
        console.log('Attempting to send welcome email to:', email);
        
        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
              .credentials { background: #e7f3ff; padding: 15px; border-radius: 6px; margin: 20px 0; }
              .warning { background: #fff3cd; padding: 15px; border-radius: 6px; border-left: 4px solid #ffc107; }
              .footer { margin-top: 30px; font-size: 14px; color: #666; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Welcome to ${companyName}!</h1>
                <p>Hello ${full_name},</p>
                <p>Your student account has been successfully created.</p>
              </div>
              
              <div class="credentials">
                <h3>🔐 Your Login Details</h3>
                <p><strong>Student ID:</strong> ${studentId}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Temporary Password:</strong> ${tempPassword}</p>
              </div>
              
              <div class="warning">
                <h4>⚠️ Important Notice</h4>
                <p>Your LMS access is currently <strong>disabled</strong> until your fees are cleared.</p>
              </div>
              
              <div class="footer">
                <p>Best regards,<br>${companyName} Team</p>
              </div>
            </div>
          </body>
          </html>
        `;
        
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [email],
            subject: `Welcome to ${companyName} - Your Login Credentials`,
            html: emailHtml,
          }),
        });
        
        emailSent = emailResponse.ok;
        if (emailSent) {
          console.log('Email sent successfully to:', email);
        } else {
          const errorText = await emailResponse.text();
          console.error('Email sending failed with status:', emailResponse.status, 'Response:', errorText);
        }
      } else {
        console.log('RESEND_API_KEY not configured, email sending skipped');
      }
    } catch (emailError) {
      console.error('Email sending error (non-blocking):', emailError);
      // Email failure should not prevent student creation
    }
    
    console.log('Email process completed. Email sent:', emailSent);

    // Log admin action
    await supabase
      .from('admin_logs')
      .insert({
        entity_type: 'user',
        entity_id: authUser.user.id,
        action: 'created',
        description: `Student ${studentId} created successfully`,
        performed_by: user.id,
        data: {
          student_id: studentId,
          full_name,
          email,
          phone,
          fees_structure,
          email_sent: emailSent,
        },
      });

    return new Response(
      JSON.stringify({
        success: true,
        studentId,
        tempPassword,
        emailSent,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in create-student-secure:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
};

serve(handler);