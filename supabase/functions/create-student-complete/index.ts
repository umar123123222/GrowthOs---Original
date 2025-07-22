import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.0";
import jsPDF from "npm:jspdf@2.5.1";

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

// Generate invoice PDF
function generateInvoicePDF(studentName: string, email: string, feesStructure: string): Uint8Array {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(20);
  doc.text('IDMPakistan LMS', 20, 30);
  doc.setFontSize(16);
  doc.text('INVOICE', 20, 50);
  
  // Invoice details
  doc.setFontSize(12);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 70);
  doc.text(`Invoice #: INV-${Date.now()}`, 20, 80);
  
  // Student details
  doc.text('Bill To:', 20, 100);
  doc.text(studentName, 20, 110);
  doc.text(email, 20, 120);
  
  // Fee structure
  doc.text('Fee Structure:', 20, 140);
  const feeAmount = feesStructure === '1_installment' ? '50,000' : 
                   feesStructure === '2_installments' ? '25,000' : '17,000';
  doc.text(`Payment Plan: ${feesStructure.replace('_', ' ').toUpperCase()}`, 20, 150);
  doc.text(`Amount Due: PKR ${feeAmount}`, 20, 160);
  
  // Payment instructions
  doc.text('Payment Instructions:', 20, 180);
  doc.text('• Pay within 14 days of invoice date', 20, 190);
  doc.text('• Send proof of payment to billing@idmpakistan.pk', 20, 200);
  doc.text('• Accounts with unpaid invoices are deleted after 2 weeks', 20, 210);
  
  return new Uint8Array(doc.output('arraybuffer'));
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    const { fullName, email, phone, feesStructure }: CreateStudentRequest = await req.json();

    // Generate secure temporary password
    const tempPassword = generateSecurePassword();

    console.log('Creating student account...');

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      user_metadata: { full_name: fullName },
      email_confirm: true
    });

    if (authError || !authData.user) {
      throw new Error(`Failed to create auth user: ${authError?.message}`);
    }

    // Create student record
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
        lms_password: tempPassword, // Store LMS password initially
        temp_password: tempPassword,
        lms_status: 'inactive'
      });

    if (insertError) {
      throw new Error(`Failed to create student record: ${insertError.message}`);
    }

    console.log('Student created, generating invoice...');

    // Generate invoice PDF
    const invoicePDF = generateInvoicePDF(fullName, email, feesStructure);

    console.log('Sending welcome email with invoice...');

    // Send welcome email with invoice
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
          filename: `invoice-${fullName.replace(/\s+/g, '-')}.pdf`,
          content: invoicePDF
        }
      ]
    });

    if (emailResult.error) {
      console.error('Email sending failed:', emailResult.error);
      // Don't throw here - student was created successfully
    }

    console.log('Student creation completed successfully');

    return new Response(JSON.stringify({ 
      success: true,
      studentId: authData.user.id,
      tempPassword,
      emailSent: !emailResult.error
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