import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2.55.0'
import { Resend } from "npm:resend@2.0.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function getCurrencySymbol(curr: string = 'USD'): string {
  const symbols: Record<string, string> = {
    USD: '$', EUR: '€', GBP: '£', INR: '₹', CAD: 'C$', AUD: 'A$', PKR: '₨'
  };
  return symbols[curr] || curr;
}

function sanitizeEmail(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/<([^>]+)>/);
  return match ? match[1].trim() : trimmed;
}

async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  cc?: string;
}): Promise<void> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const rawFromEmail = Deno.env.get('SMTP_FROM_EMAIL');
  const fromEmail = rawFromEmail ? sanitizeEmail(rawFromEmail) : '';
  const fromName = Deno.env.get('SMTP_FROM_NAME') || 'Growth OS';

  if (!resendApiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }
  if (!fromEmail) {
    throw new Error('SMTP_FROM_EMAIL is required');
  }

  const resend = new Resend(resendApiKey);
  const payload: Record<string, unknown> = {
    from: `${fromName} <${fromEmail}>`,
    to: [options.to],
    subject: options.subject,
    html: options.html,
  };
  if (options.cc) payload.cc = [options.cc];

  const { error } = await resend.emails.send(payload as any);
  if (error) {
    throw new Error(`Resend API error: ${(error as any).message}`);
  }
}

function generateInvoiceEmailHtml(params: {
  companyName: string;
  companyEmail: string;
  studentName: string;
  studentEmail: string;
  studentId: string;
  installmentNumber: number;
  amount: number;
  currency: string;
  dueDate: string;
  enrollmentName: string;
  invoiceNumber: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <!-- Header -->
          <div style="background-color: #1e40af; color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">${params.companyName}</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Invoice ${params.invoiceNumber}</p>
          </div>

          <!-- Student Information -->
          <div style="background-color: #ffffff; padding: 25px 30px; border-bottom: 1px solid #e5e7eb;">
            <h2 style="margin: 0 0 15px 0; font-size: 16px; color: #374151;">Student Information</h2>
            <p style="margin: 5px 0; color: #4b5563; font-size: 14px;"><strong>Name:</strong> ${params.studentName}</p>
            <p style="margin: 5px 0; color: #4b5563; font-size: 14px;"><strong>Student ID:</strong> ${params.studentId}</p>
            <p style="margin: 5px 0; color: #4b5563; font-size: 14px;"><strong>Email:</strong> ${params.studentEmail}</p>
          </div>

          <!-- Payment Details -->
          <div style="background-color: #ffffff; padding: 25px 30px; border-bottom: 1px solid #e5e7eb;">
            <h2 style="margin: 0 0 15px 0; font-size: 16px; color: #374151;">Payment Details</h2>
            <p style="margin: 5px 0; color: #4b5563; font-size: 14px;"><strong>Enrollment:</strong> ${params.enrollmentName}</p>
            <p style="margin: 5px 0; color: #4b5563; font-size: 14px;"><strong>Installment:</strong> ${params.installmentNumber}</p>
            <p style="margin: 5px 0; color: #4b5563; font-size: 14px;"><strong>Amount Due:</strong> ${params.currency} ${params.amount}</p>
            <p style="margin: 5px 0; color: #4b5563; font-size: 14px;"><strong>Due Date:</strong> ${params.dueDate}</p>
          </div>

          <!-- Footer -->
          <div style="background-color: #f9fafb; padding: 25px 30px; border-radius: 0 0 8px 8px; text-align: center;">
            <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Please make your payment by the due date to avoid any late fees.</p>
            <p style="margin: 0; color: #6b7280; font-size: 14px;">For any questions, contact us at <a href="mailto:${params.companyEmail}" style="color: #1e40af;">${params.companyEmail}</a></p>
          </div>
        </div>
      </body>
    </html>
  `;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { student_ids } = await req.json();

    if (!student_ids || !Array.isArray(student_ids) || student_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'student_ids array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get company settings
    const { data: companySettings } = await supabaseAdmin
      .from('company_settings')
      .select('currency, company_name, contact_email')
      .eq('id', 1)
      .single();

    const currency = companySettings?.currency || 'USD';
    const companyName = companySettings?.company_name || 'The Learning Team';
    const companyEmail = companySettings?.contact_email || 'support@company.com';

    // Get student records for the user IDs
    const { data: students, error: studentsErr } = await supabaseAdmin
      .from('students')
      .select('id, user_id, student_id, users!inner(full_name, email)')
      .in('user_id', student_ids);

    if (studentsErr) throw studentsErr;
    if (!students || students.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No student records found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const studentRecordIds = students.map((s: any) => s.id);

    // Get all unpaid invoices for these students, ordered by installment_number desc
    const { data: invoices, error: invErr } = await supabaseAdmin
      .from('invoices')
      .select('id, student_id, installment_number, amount, due_date, extended_due_date, status, course_id, pathway_id')
      .in('student_id', studentRecordIds)
      .neq('status', 'paid')
      .neq('status', 'scheduled')
      .order('installment_number', { ascending: false });

    if (invErr) throw invErr;

    // Group by student_id and take the latest (highest installment_number) unpaid invoice per student
    const latestPerStudent = new Map<string, any>();
    for (const inv of invoices || []) {
      if (!latestPerStudent.has(inv.student_id)) {
        latestPerStudent.set(inv.student_id, inv);
      }
    }

    // Build student lookup
    const studentMap = new Map<string, any>();
    for (const s of students) {
      studentMap.set(s.id, s);
    }

    // Fetch course and pathway names
    const courseIds = [...new Set([...latestPerStudent.values()].map((i: any) => i.course_id).filter(Boolean))];
    const pathwayIds = [...new Set([...latestPerStudent.values()].map((i: any) => i.pathway_id).filter(Boolean))];

    const courseMap = new Map<string, string>();
    const pathwayMap = new Map<string, string>();

    if (courseIds.length) {
      const { data: courses } = await supabaseAdmin.from('courses').select('id, title').in('id', courseIds);
      (courses || []).forEach((c: any) => courseMap.set(c.id, c.title));
    }
    if (pathwayIds.length) {
      const { data: pathways } = await supabaseAdmin.from('learning_pathways').select('id, name').in('id', pathwayIds);
      (pathways || []).forEach((p: any) => pathwayMap.set(p.id, p.name));
    }

    const billingCc = Deno.env.get('BILLING_EMAIL_CC');
    let sentCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const [studentId, invoice] of latestPerStudent) {
      const student = studentMap.get(studentId);
      if (!student) continue;

      const studentEmail = (student as any).users.email;
      const studentName = (student as any).users.full_name;
      const studentDisplayId = (student as any).student_id || studentId;
      const dueDate = new Date(invoice.extended_due_date || invoice.due_date).toLocaleDateString();
      const enrollmentName = invoice.course_id
        ? courseMap.get(invoice.course_id) || 'Course'
        : invoice.pathway_id
          ? pathwayMap.get(invoice.pathway_id) || 'Pathway'
          : 'Enrollment';
      const invoiceNumber = `INV-${studentDisplayId}-${invoice.installment_number}`;

      try {
        const html = generateInvoiceEmailHtml({
          companyName,
          companyEmail,
          studentName,
          studentEmail,
          studentId: studentDisplayId,
          installmentNumber: invoice.installment_number,
          amount: invoice.amount,
          currency,
          dueDate,
          enrollmentName,
          invoiceNumber,
        });

        await sendEmail({
          to: studentEmail,
          subject: `Invoice ${invoiceNumber} - Installment #${invoice.installment_number} for ${enrollmentName} - Due ${dueDate}`,
          html,
          ...(billingCc ? { cc: billingCc } : {}),
        });

        console.log(`[Resend] Sent invoice ${invoiceNumber} to ${studentEmail}, CC: ${billingCc || 'none'}`);
        sentCount++;
      } catch (emailError: any) {
        console.error(`[Resend FAILED] ${studentEmail}: ${emailError.message}`);
        errors.push(`${studentEmail}: ${emailError.message}`);
        failedCount++;
      }
    }

    const noInvoiceCount = students.length - latestPerStudent.size;

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        failed: failedCount,
        no_unpaid_invoice: noInvoiceCount,
        errors: errors.length > 0 ? errors : undefined,
        message: `Resent ${sentCount} invoice(s). ${failedCount} failed. ${noInvoiceCount} student(s) had no unpaid invoices.`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in resend-invoice:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to resend invoices', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
