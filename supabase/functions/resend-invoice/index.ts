import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2.55.0'
import { SMTPClient } from '../_shared/smtp-client.ts'

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
      .select('currency, company_name')
      .eq('id', 1)
      .single();

    const currency = companySettings?.currency || 'USD';
    const currencySymbol = getCurrencySymbol(currency);
    const companyName = companySettings?.company_name || 'The Learning Team';

    // Get student records for the user IDs
    const { data: students, error: studentsErr } = await supabaseAdmin
      .from('students')
      .select('id, user_id, users!inner(full_name, email)')
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

    const smtpClient = SMTPClient.fromEnv();
    const billingCc = Deno.env.get('BILLING_EMAIL_CC');
    let sentCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const [studentId, invoice] of latestPerStudent) {
      const student = studentMap.get(studentId);
      if (!student) continue;

      const studentEmail = (student as any).users.email;
      const studentName = (student as any).users.full_name;
      const dueDate = new Date(invoice.extended_due_date || invoice.due_date).toLocaleDateString();
      const enrollmentName = invoice.course_id
        ? courseMap.get(invoice.course_id) || 'Course'
        : invoice.pathway_id
          ? pathwayMap.get(invoice.pathway_id) || 'Pathway'
          : 'Enrollment';

      try {
        await smtpClient.sendEmail({
          to: studentEmail,
          subject: `Payment Reminder - Installment #${invoice.installment_number} for ${enrollmentName} - Due ${dueDate}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #2563eb;">Payment Reminder</h2>
              <p>Dear ${studentName},</p>
              <p>This is a reminder regarding your outstanding payment:</p>
              <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
                <h3 style="margin-top: 0;">Payment Details</h3>
                <p><strong>Enrollment:</strong> ${enrollmentName}</p>
                <p><strong>Installment Number:</strong> #${invoice.installment_number}</p>
                <p><strong>Amount:</strong> ${currencySymbol}${invoice.amount}</p>
                <p><strong>Due Date:</strong> ${dueDate}</p>
                <p><strong>Status:</strong> ${invoice.status === 'due' || invoice.status === 'overdue' ? 'OVERDUE' : 'Pending Payment'}</p>
              </div>
              <p>Please ensure payment is made as soon as possible to avoid any service interruptions.</p>
              <p>If you have any questions, please contact our support team.</p>
              <p>Best regards,<br>${companyName}</p>
            </div>
          `,
          ...(billingCc ? { cc: billingCc } : {}),
        });

        console.log(`[Resend] Sent invoice reminder to ${studentEmail} for installment #${invoice.installment_number}, CC: ${billingCc || 'none'}`);
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
