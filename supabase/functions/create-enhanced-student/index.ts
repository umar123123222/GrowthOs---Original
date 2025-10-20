import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SMTPClient } from '../_shared/smtp-client.ts';
// Note: PDF generation removed to avoid Deno file system restrictions

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateEnhancedStudentRequest {
  email: string;
  full_name: string;
  phone: string;
  installment_count: number;
  discount_amount?: number;
  discount_percentage?: number;
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

interface CompanyDetails {
  company_name: string;
  address: string;
  contact_email: string;
  primary_phone: string;
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
    const { 
      email, 
      full_name, 
      phone, 
      installment_count,
      discount_amount = 0,
      discount_percentage = 0
    }: CreateEnhancedStudentRequest = await req.json();
    console.log('Request data:', { email, full_name, phone, installment_count, discount_amount, discount_percentage });

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

    // Get the current user who is creating this student and validate discount permissions
    const authHeader = req.headers.get('authorization');
    let createdBy = null;
    let creatorRole = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.replace('Bearer ', '');
        console.log('Auth token received:', token ? 'Present' : 'Missing');
        
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? ''
        );
        
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
        if (userError) {
          console.log('Error getting user from token:', userError);
        } else {
          createdBy = user?.id || null;
          console.log('Student being created by user:', createdBy);
          
          // Get creator's role for discount validation
          if (createdBy) {
            const { data: userData } = await supabaseAdmin
              .from('users')
              .select('role')
              .eq('id', createdBy)
              .single();
            creatorRole = userData?.role || null;
            console.log('Creator role:', creatorRole);
          }
        }
      } catch (error) {
        console.log('Could not determine creator:', error);
      }
    } else {
      console.log('No authorization header found or invalid format');
    }

    // Validate discount permissions
    if ((discount_amount > 0 || discount_percentage > 0) && !['admin', 'superadmin'].includes(creatorRole || '')) {
      console.error('Unauthorized discount attempt by role:', creatorRole);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Only admins and superadmins can apply discounts to student fees' 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        lms_status: 'inactive',
        is_temp_password: true,
        created_by: createdBy
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

    // Get company settings to calculate final fee
    const { data: companySettings } = await supabaseAdmin
      .from('company_settings')
      .select('original_fee_amount')
      .eq('id', 1)
      .single();

    if (!companySettings) {
      return new Response(
        JSON.stringify({ success: false, error: 'Company settings not found' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate final fee with discount
    let finalFeeAmount = companySettings.original_fee_amount;
    if (discount_percentage > 0) {
      finalFeeAmount = finalFeeAmount * (1 - discount_percentage / 100);
    } else if (discount_amount > 0) {
      finalFeeAmount = finalFeeAmount - discount_amount;
    }
    finalFeeAmount = Math.max(0, finalFeeAmount); // Allow 0 fee for 100% discount

    console.log('Fee calculation:', {
      original: companySettings.original_fee_amount,
      discount_amount,
      discount_percentage,
      final: finalFeeAmount
    });

    // Create student record with discount info
    const { data: studentRecord, error: studentError } = await supabaseAdmin
      .from('students')
      .insert({
        user_id: authUser.user.id,
        installment_count,
        lms_username: lmsUserId,
        discount_amount: discount_amount || 0,
        discount_percentage: discount_percentage || 0,
        final_fee_amount: finalFeeAmount
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

    // Queue email for credential delivery (non-blocking)
    supabaseAdmin
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
      })
      .then(({ error: emailQueueError }) => {
        if (emailQueueError) {
          console.error('Email queue error:', emailQueueError);
        }
      });

    // Get company settings including currency and company details
    const { data: companyDetailsData } = await supabaseAdmin
      .from('company_settings')
      .select('lms_url, currency, company_name, address, contact_email, primary_phone, payment_methods')
      .eq('id', 1)
      .single();
    
    const loginUrl = companyDetailsData?.lms_url || 'https://growthos.core47.ai';
    const currency = companyDetailsData?.currency || 'USD';
    const companyDetails: CompanyDetails = {
      company_name: companyDetailsData?.company_name || 'Your Company',
      address: companyDetailsData?.address || '',
      contact_email: companyDetailsData?.contact_email || '',
      primary_phone: companyDetailsData?.primary_phone || ''
    };

    // Create ALL installments first (fast operation)
    try {
      const { data: installmentSettings } = await supabaseAdmin
        .from('company_settings')
        .select('original_fee_amount, invoice_overdue_days, invoice_send_gap_days, payment_methods, currency')
        .single();

      if (installmentSettings) {
        const installmentAmount = finalFeeAmount / installment_count;
        const intervalDays = installmentSettings.invoice_send_gap_days || 30;
        
        // Create all installments
        const installments = [];
        for (let i = 1; i <= installment_count; i++) {
          const issueDate = new Date();
          issueDate.setDate(issueDate.getDate() + ((i - 1) * intervalDays));
          
          const dueDate = new Date(issueDate);
          dueDate.setDate(dueDate.getDate() + (installmentSettings.invoice_overdue_days || 5));

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
          
          // Log discount application if applied
          if (discount_amount > 0 || discount_percentage > 0) {
            await supabaseAdmin.from('admin_logs').insert({
              entity_type: 'student',
              entity_id: studentRecord.id,
              action: 'discount_applied',
              description: `Discount applied: ${discount_percentage > 0 ? discount_percentage + '%' : currency + ' ' + discount_amount}`,
              performed_by: createdBy,
              data: {
                original_amount: installmentSettings.original_fee_amount,
                discount_amount: discount_amount || 0,
                discount_percentage: discount_percentage || 0,
                final_amount: finalFeeAmount,
                student_email: email,
                student_name: full_name
              }
            });
            console.log('Discount application logged to admin_logs');
          }
        }
      }
      
      console.log('Installment creation completed successfully');
    } catch (invoiceError) {
      console.error('Invoice creation error:', invoiceError);
      // Continue anyway - invoices can be created manually
    }

    // Send emails in background (non-blocking using EdgeRuntime.waitUntil)
    const sendEmailsInBackground = async () => {
      try {
        const smtpClient = SMTPClient.fromEnv();
        
        // Send welcome email
        try {
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
                  <a href="${loginUrl}" 
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

          console.log('Welcome email sent successfully to:', email);

          await supabaseAdmin
            .from('email_queue')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .eq('user_id', authUser.user.id)
            .eq('email_type', 'student_credentials');
            
        } catch (emailError) {
          console.error('Welcome email error:', emailError);
          await supabaseAdmin
            .from('email_queue')
            .update({ 
              status: 'failed', 
              error_message: emailError instanceof Error ? emailError.message : 'Unknown SMTP error'
            })
            .eq('user_id', authUser.user.id)
            .eq('email_type', 'student_credentials');
        }

        // Send first invoice email if installments were created
        const { data: invoiceSettings } = await supabaseAdmin
          .from('company_settings')
          .select('original_fee_amount, invoice_overdue_days, invoice_send_gap_days, payment_methods, currency')
          .single();

        if (invoiceSettings) {
          const { data: firstInvoice } = await supabaseAdmin
            .from('invoices')
            .select('*')
            .eq('student_id', studentRecord.id)
            .eq('installment_number', 1)
            .maybeSingle();

          if (firstInvoice) {
            try {
              await sendFirstInvoiceEmail({
                installment_number: firstInvoice.installment_number,
                amount: firstInvoice.amount,
                due_date: firstInvoice.due_date,
                student_email: email,
                student_name: full_name
              }, loginUrl, currency, companyDetails, invoiceSettings?.payment_methods || []);
              console.log('First invoice email sent successfully');
            } catch (invoiceEmailError) {
              console.error('Invoice email error:', invoiceEmailError);
            }
          }
        }
      } catch (error) {
        console.error('Background email processing error:', error);
      }
    };

    // Start background email processing (non-blocking)
    EdgeRuntime.waitUntil(sendEmailsInBackground());

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

async function sendFirstInvoiceEmail(invoice: any, loginUrl: string, currency: string, companyDetails: CompanyDetails, paymentMethods: any[]) {
  try {
    const smtpClient = SMTPClient.fromEnv();
    const studentEmail = invoice.student_email;
    const studentName = invoice.student_name;
    const dueDate = new Date(invoice.due_date).toLocaleDateString();
    
    // Get currency symbol
    const getCurrencySymbol = (curr: string = 'USD') => {
      const symbols: { [key: string]: string } = {
        USD: '$', EUR: '€', GBP: '£', INR: '₹', CAD: 'C$', AUD: 'A$', PKR: '₨'
      };
      return symbols[curr] || curr;
    };
    
    const currencySymbol = getCurrencySymbol(currency);
    
    // Generate payment methods HTML
    const paymentMethodsHtml = paymentMethods.filter((pm: any) => pm.enabled).map((method: any) => `
      <div style="border-left: 3px solid #2563eb; padding-left: 15px; margin-bottom: 15px;">
        <h4 style="margin: 0 0 10px 0; color: #1e40af;">${method.name}</h4>
        ${Object.entries(method.details).map(([key, value]) => `
          <p style="margin: 5px 0; font-size: 14px;"><strong>${key.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}:</strong> ${value}</p>
        `).join('')}
      </div>
    `).join('');
    
    await smtpClient.sendEmail({
      to: studentEmail,
      subject: `Invoice #${invoice.installment_number.toString().padStart(3, '0')} - Payment Due ${dueDate}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Invoice #${invoice.installment_number.toString().padStart(3, '0')}</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #2563eb, #7c3aed); color: white; padding: 30px 40px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: bold;">INVOICE</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">${companyDetails.company_name}</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.6;">Dear ${studentName},</p>
              
              <p style="color: #374151; font-size: 16px; line-height: 1.6;">Your installment invoice has been generated. Please find the details below:</p>
              
              <!-- Invoice Details -->
              <div style="background-color: #f0f9ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 25px; margin: 25px 0;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                  <div>
                    <h3 style="margin: 0 0 15px 0; color: #1e40af; font-size: 18px;">Invoice To:</h3>
                    <p style="margin: 0; font-weight: bold; color: #111827;">${studentName}</p>
                    <p style="margin: 5px 0 0 0; color: #6b7280;">${studentEmail}</p>
                  </div>
                  <div style="text-align: right;">
                    <p style="margin: 0; color: #6b7280;">Invoice #: <strong>INV-${invoice.installment_number.toString().padStart(3, '0')}</strong></p>
                    <p style="margin: 5px 0; color: #6b7280;">Date: <strong>${new Date().toLocaleDateString()}</strong></p>
                    <p style="margin: 5px 0; color: #6b7280;">Due Date: <strong>${dueDate}</strong></p>
                  </div>
                </div>
                
                <!-- Amount Due -->
                <div style="background-color: white; border-radius: 6px; padding: 20px; text-align: center; border: 2px solid #2563eb;">
                  <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">AMOUNT DUE</p>
                  <p style="margin: 0; font-size: 36px; font-weight: bold; color: #2563eb;">${currencySymbol}${parseFloat(invoice.amount).toLocaleString()}</p>
                </div>
              </div>
              
              <!-- Course Details -->
              <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <h3 style="margin: 0 0 15px 0; color: #374151;">Course Details:</h3>
                <div style="border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; margin-bottom: 10px;">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #374151;">Course Installment Payment #${invoice.installment_number}</span>
                    <span style="font-weight: bold; color: #111827;">${currencySymbol}${parseFloat(invoice.amount).toLocaleString()}</span>
                  </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; font-weight: bold; color: #2563eb;">
                  <span>Total Amount Due:</span>
                  <span>${currencySymbol}${parseFloat(invoice.amount).toLocaleString()}</span>
                </div>
              </div>
              
              <!-- Payment Methods -->
              ${paymentMethodsHtml ? `
              <div style="margin: 25px 0;">
                <h3 style="margin: 0 0 20px 0; color: #374151;">Payment Methods:</h3>
                ${paymentMethodsHtml}
              </div>
              ` : ''}
              
              <!-- Action Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${loginUrl}" style="background: linear-gradient(135deg, #2563eb, #7c3aed); color: white; text-decoration: none; padding: 15px 30px; border-radius: 6px; font-weight: bold; display: inline-block;">
                  Access Learning Platform
                </a>
              </div>
              
              <!-- Footer Notes -->
              <div style="background-color: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <h4 style="margin: 0 0 10px 0; color: #92400e;">Important Notes:</h4>
                <ul style="margin: 0; padding-left: 20px; color: #92400e;">
                  <li>Payment is due by ${dueDate}</li>
                  <li>Access to courses may be restricted for overdue payments</li>
                  <li>Contact support if you have any payment-related questions</li>
                </ul>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">If you have any questions about this invoice or need assistance with payment, please contact our support team.</p>
              
              <p style="color: #374151; font-size: 16px; margin-top: 30px;">Best regards,<br><strong>${companyDetails.company_name} Team</strong></p>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f3f4f6; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px;">${companyDetails.company_name}</p>
              <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 12px;">${companyDetails.address}</p>
              <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 12px;">Email: ${companyDetails.contact_email} | Phone: ${companyDetails.primary_phone}</p>
            </div>
          </div>
        </body>
        </html>
      `
    });

    console.log(`First invoice email sent successfully to ${studentEmail} for installment ${invoice.installment_number}`);
  } catch (error) {
    console.error('Error sending first invoice email:', error);
    throw error;
  }
};

serve(handler);