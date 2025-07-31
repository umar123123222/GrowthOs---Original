import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

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

    // Store temp password for async email sending
    const { error: updatePasswordError } = await supabase
      .from('users')
      .update({ temp_password: tempPassword })
      .eq('id', authUser.user.id);

    if (updatePasswordError) {
      console.error('Error storing temp password:', updatePasswordError);
    }

    // Enqueue onboarding jobs for async processing
    const { error: enqueueError } = await supabase.rpc('enqueue_student_onboarding_jobs', {
      p_student_id: authUser.user.id
    });

    if (enqueueError) {
      console.error('Error enqueuing onboarding jobs:', enqueueError);
    } else {
      console.log('Onboarding jobs enqueued successfully for student:', studentId);
    }

    // Create initial installment payment records
    const totalInstallments = parseInt(fees_structure.split('_')[0]);
    console.log(`Creating ${totalInstallments} installment records for student ${studentId}`);

    // Get company settings for fee calculation
    const { data: companyData } = await supabase
      .from('company_settings')
      .select('original_fee_amount')
      .single();

    const totalFee = companyData?.original_fee_amount || 50000;
    const installmentAmount = Math.round(totalFee / totalInstallments);

    // Create all installment payment records
    const installmentRecords = [];
    for (let i = 1; i <= totalInstallments; i++) {
      installmentRecords.push({
        user_id: authUser.user.id,
        installment_number: i,
        total_installments: totalInstallments,
        amount: installmentAmount,
        status: 'pending'
      });
    }

    const { error: installmentError } = await supabase
      .from('installment_payments')
      .insert(installmentRecords);

    if (installmentError) {
      console.error('Error creating installment records:', installmentError);
    } else {
      console.log('Installment records created successfully');
    }

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
          onboarding_queued: true,
        },
      });

    return new Response(
      JSON.stringify({
        success: true,
        studentId,
        tempPassword,
        onboardingQueued: true,
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