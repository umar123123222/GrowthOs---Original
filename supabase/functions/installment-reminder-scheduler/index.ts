import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2.55.0'
import { SMTPClient } from '../_shared/smtp-client.ts'
import { generateInvoicePDF, type InvoiceData, type CompanyDetails } from '../_shared/pdf-generator.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Shared currency symbol helper
function getCurrencySymbol(curr: string = 'USD'): string {
  const symbols: Record<string, string> = {
    USD: '$', EUR: '€', GBP: '£', INR: '₹', CAD: 'C$', AUD: 'A$', PKR: '₨'
  };
  return symbols[curr] || curr;
}

// Branded invoice email template (matches resend-invoice template)
function generateBrandedInvoiceHtml(params: {
  companyName: string;
  companyEmail: string;
  companyAddress: string;
  companyPhone: string;
  studentName: string;
  studentEmail: string;
  studentId: string;
  installmentNumber: number;
  amount: number;
  currency: string;
  currencySymbol: string;
  dueDate: string;
  enrollmentName: string;
  invoiceNumber: string;
  loginUrl: string;
  paymentMethodsHtml: string;
}): string {
  const formattedAmount = parseFloat(String(params.amount)).toLocaleString();
  const today = new Date().toLocaleDateString();

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invoice ${params.invoiceNumber}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
      <div style="max-width: 600px; margin: 0 auto; background-color: white; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <div style="background: linear-gradient(135deg, #2563eb, #7c3aed); color: white; padding: 30px 40px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px; font-weight: bold;">INVOICE</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">${params.companyName}</p>
        </div>
        <div style="padding: 40px;">
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">Dear ${params.studentName},</p>
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">Your installment invoice has been generated. Please find the details below:</p>
          <div style="background-color: #f0f9ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 25px; margin: 25px 0;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
              <div>
                <h3 style="margin: 0 0 15px 0; color: #1e40af; font-size: 18px;">Invoice To:</h3>
                <p style="margin: 0; font-weight: bold; color: #111827;">${params.studentName}</p>
                <p style="margin: 5px 0 0 0; color: #6b7280;">${params.studentEmail}</p>
              </div>
              <div style="text-align: right;">
                <p style="margin: 0; color: #6b7280;">Invoice #: <strong>${params.invoiceNumber}</strong></p>
                <p style="margin: 5px 0; color: #6b7280;">Date: <strong>${today}</strong></p>
                <p style="margin: 5px 0; color: #6b7280;">Due Date: <strong>${params.dueDate}</strong></p>
              </div>
            </div>
            <div style="background-color: white; border-radius: 6px; padding: 20px; text-align: center; border: 2px solid #2563eb;">
              <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">AMOUNT DUE</p>
              <p style="margin: 0; font-size: 36px; font-weight: bold; color: #2563eb;">${params.currencySymbol}${formattedAmount}</p>
            </div>
          </div>
          <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h3 style="margin: 0 0 15px 0; color: #374151;">Course Details:</h3>
            <div style="border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; margin-bottom: 10px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #374151;">Course Installment Payment #${params.installmentNumber}</span>
                <span style="font-weight: bold; color: #111827;">${params.currencySymbol}${formattedAmount}</span>
              </div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-weight: bold; color: #2563eb;">
              <span>Total Amount Due:</span>
              <span>${params.currencySymbol}${formattedAmount}</span>
            </div>
          </div>
          ${params.paymentMethodsHtml ? `
          <div style="margin: 25px 0;">
            <h3 style="margin: 0 0 20px 0; color: #374151;">Payment Methods:</h3>
            ${params.paymentMethodsHtml}
          </div>
          ` : ''}
          <div style="text-align: center; margin: 30px 0;">
            <a href="${params.loginUrl}" style="background: linear-gradient(135deg, #2563eb, #7c3aed); color: white; text-decoration: none; padding: 15px 30px; border-radius: 6px; font-weight: bold; display: inline-block;">
              Access Learning Platform
            </a>
          </div>
          <div style="background-color: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h4 style="margin: 0 0 10px 0; color: #92400e;">Important Notes:</h4>
            <ul style="margin: 0; padding-left: 20px; color: #92400e;">
              <li>Payment is due by ${params.dueDate}</li>
              <li>Access to courses may be restricted for overdue payments</li>
              <li>Contact support if you have any payment-related questions</li>
            </ul>
          </div>
          <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">If you have any questions about this invoice or need assistance with payment, please contact our support team.</p>
          <p style="color: #374151; font-size: 16px; margin-top: 30px;">Best regards,<br><strong>${params.companyName} Team</strong></p>
        </div>
        <div style="background-color: #f3f4f6; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; color: #6b7280; font-size: 12px;">${params.companyName}</p>
          <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 12px;">${params.companyAddress}</p>
          <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 12px;">Email: ${params.companyEmail} | Phone: ${params.companyPhone}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Safe PDF generation — returns buffer or null if generation fails
async function safeGeneratePDF(
  invoice: any,
  currency: string,
  companyDetails: CompanyDetails,
  paymentMethods: any[],
  dueDate: string,
  studentName: string,
  studentEmail: string
): Promise<Uint8Array | null> {
  try {
    const invoiceData: InvoiceData = {
      invoice_number: `INV-${invoice.installment_number.toString().padStart(3, '0')}`,
      date: new Date().toLocaleDateString(),
      due_date: dueDate,
      student_name: studentName,
      student_email: studentEmail,
      items: [{
        description: `Course Installment Payment`,
        installment_number: invoice.installment_number,
        price: parseFloat(invoice.amount),
        total: parseFloat(invoice.amount)
      }],
      subtotal: parseFloat(invoice.amount),
      tax: 0,
      total: parseFloat(invoice.amount),
      currency: currency,
      payment_methods: paymentMethods.filter((pm: any) => pm.enabled),
      terms: 'Please send payment within 30 days of receiving this invoice.'
    };

    const pdfBuffer = await generateInvoicePDF(invoiceData, companyDetails);
    console.log(`[PDF] Successfully generated for invoice installment #${invoice.installment_number}`);
    return pdfBuffer;
  } catch (error) {
    console.warn(`[PDF] Generation failed for installment #${invoice.installment_number}, will send email without attachment:`, error.message);
    return null;
  }
}

// Sends billing email with optional PDF attachment. Throws on failure.
async function sendBillingEmail(options: {
  to: string;
  subject: string;
  html: string;
  pdfBuffer: Uint8Array | null;
  installmentNumber: number;
}): Promise<void> {
  const smtpClient = SMTPClient.fromEnv();
  const billingCc = Deno.env.get('BILLING_EMAIL_CC');

  const emailPayload: any = {
    to: options.to,
    subject: options.subject,
    html: options.html,
    ...(billingCc ? { cc: billingCc } : {}),
  };

  if (options.pdfBuffer) {
    emailPayload.attachments = [{
      filename: `Invoice-${options.installmentNumber}.pdf`,
      content: options.pdfBuffer,
      contentType: 'application/pdf'
    }];
  }

  await smtpClient.sendEmail(emailPayload);

  const mode = options.pdfBuffer ? 'with PDF attachment' : 'WITHOUT attachment (PDF generation failed)';
  const ccInfo = billingCc ? `, CC: ${billingCc}` : '';
  console.log(`[Email] Sent ${mode} to ${options.to}${ccInfo}`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('Installment reminder scheduler triggered');

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: companySettings } = await supabaseAdmin
      .from('company_settings')
      .select('lms_url, currency, company_name, address, contact_email, primary_phone, payment_methods, billing_email_cc')
      .eq('id', 1)
      .single();
    
    const loginUrl = companySettings?.lms_url || 'https://growthos.core47.ai';
    const currency = companySettings?.currency || 'USD';
    const currencySymbol = getCurrencySymbol(currency);
    const companyDetails: CompanyDetails = {
      company_name: companySettings?.company_name || 'Your Company',
      address: companySettings?.address || '',
      contact_email: companySettings?.contact_email || '',
      primary_phone: companySettings?.primary_phone || ''
    };
    const paymentMethods = companySettings?.payment_methods || [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Pre-generate payment methods HTML for branded template
    const enabledPaymentMethods = (paymentMethods as any[]).filter((pm: any) => pm.enabled);
    const paymentMethodsHtml = enabledPaymentMethods.map((method: any) => `
      <div style="border-left: 3px solid #2563eb; padding-left: 15px; margin-bottom: 15px;">
        <h4 style="margin: 0 0 10px 0; color: #1e40af;">${method.name}</h4>
        ${Object.entries(method.details || {}).map(([key, value]) => `
          <p style="margin: 5px 0; font-size: 14px;"><strong>${key.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}:</strong> ${value}</p>
        `).join('')}
      </div>
    `).join('');

    const siteUrl = Deno.env.get('SITE_URL') || loginUrl;

    // 1. Check for invoices that should change from 'scheduled' to 'pending'
    const { data: scheduledInvoices, error: scheduledError } = await supabaseAdmin
      .from('invoices')
      .select('*, students!inner(id, user_id, student_id, users!inner(full_name, email))')
      .eq('status', 'scheduled')
      .or(`issue_date.lte.${today.toISOString()},and(issue_date.is.null,created_at.lte.${today.toISOString()})`);

    if (scheduledError) {
      console.error('Error fetching scheduled invoices:', scheduledError);
    } else {
      // Pre-fetch course and pathway names for all scheduled invoices
      const courseIds = [...new Set((scheduledInvoices || []).map((i: any) => i.course_id).filter(Boolean))];
      const pathwayIds = [...new Set((scheduledInvoices || []).map((i: any) => i.pathway_id).filter(Boolean))];
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

      for (const invoice of scheduledInvoices || []) {
        await supabaseAdmin
          .from('invoices')
          .update({ status: 'pending' })
          .eq('id', invoice.id);

        // Send branded issue email
        try {
          const studentEmail = invoice.students.users.email;
          const studentName = invoice.students.users.full_name;
          const studentDisplayId = invoice.students.student_id || invoice.students.id;
          const dueDate = new Date(invoice.extended_due_date || invoice.due_date).toLocaleDateString();
          const enrollmentName = invoice.course_id
            ? courseMap.get(invoice.course_id) || 'Course'
            : invoice.pathway_id
              ? pathwayMap.get(invoice.pathway_id) || 'Pathway'
              : 'Enrollment';
          const invoiceNumber = `INV-${studentDisplayId}-${invoice.installment_number}`;

          const pdfBuffer = await safeGeneratePDF(invoice, currency, companyDetails, paymentMethods, dueDate, studentName, studentEmail);

          const brandedHtml = generateBrandedInvoiceHtml({
            companyName: companyDetails.company_name,
            companyEmail: companyDetails.contact_email,
            companyAddress: companyDetails.address,
            companyPhone: companyDetails.primary_phone,
            studentName,
            studentEmail,
            studentId: studentDisplayId,
            installmentNumber: invoice.installment_number,
            amount: invoice.amount,
            currency,
            currencySymbol,
            dueDate,
            enrollmentName,
            invoiceNumber,
            loginUrl: siteUrl,
            paymentMethodsHtml,
          });

          await sendBillingEmail({
            to: studentEmail,
            subject: `Invoice ${invoiceNumber} - Installment #${invoice.installment_number} for ${enrollmentName} - Due ${dueDate}`,
            html: brandedHtml,
            pdfBuffer,
            installmentNumber: invoice.installment_number,
          });
        } catch (emailError) {
          console.error(`[Email FAILED] Issue email for installment #${invoice.installment_number} to ${invoice.students.users.email}:`, emailError.message);
        }

        await createInstallmentNotification(
          supabaseAdmin,
          invoice.students.user_id,
          'installment_issued',
          'New Installment Issued',
          `Installment #${invoice.installment_number} of ${currencySymbol}${invoice.amount} has been issued. Due date: ${new Date(invoice.due_date).toLocaleDateString()}`,
          { installment_number: invoice.installment_number, amount: invoice.amount, due_date: invoice.due_date },
          studentDisplayId
        );

        console.log(`Issued installment ${invoice.installment_number} for student ${invoice.students.users.full_name}`);
      }
    }

    // 2. Check for pending invoices that need reminders or are due
    const { data: pendingInvoices, error: pendingError } = await supabaseAdmin
      .from('invoices')
      .select('*, students!inner(id, user_id, student_id, users!inner(full_name, email))')
      .eq('status', 'pending');

    if (pendingError) {
      console.error('Error fetching pending invoices:', pendingError);
    } else {
      for (const invoice of pendingInvoices || []) {
        const issueDate = new Date(invoice.issue_date || invoice.created_at);
        const effectiveDueDate = invoice.extended_due_date 
          ? new Date(invoice.extended_due_date) 
          : new Date(invoice.due_date);
        const daysDiff = Math.floor((effectiveDueDate.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24));
        
        const firstReminderDate = new Date(issueDate);
        firstReminderDate.setDate(firstReminderDate.getDate() + Math.floor(daysDiff / 3));
        
        const secondReminderDate = new Date(issueDate);
        secondReminderDate.setDate(secondReminderDate.getDate() + Math.floor(2 * daysDiff / 3));

        const studentEmail = invoice.students.users.email;
        const studentName = invoice.students.users.full_name;
        const studentDisplayId = invoice.students.student_id || invoice.students.id;
        const dueDate = new Date(invoice.extended_due_date || invoice.due_date).toLocaleDateString();

        // Check if effective due date has passed
        if (today >= effectiveDueDate) {
          await supabaseAdmin
            .from('invoices')
            .update({ status: 'due' })
            .eq('id', invoice.id);

          // Send due/overdue email
          try {
            const pdfBuffer = await safeGeneratePDF(invoice, currency, companyDetails, paymentMethods, dueDate, studentName, studentEmail);

            await sendBillingEmail({
              to: studentEmail,
              subject: `URGENT - Payment Overdue for Installment #${invoice.installment_number} - LMS Access Suspended`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h2 style="color: #dc2626;">Payment Overdue - LMS Access Suspended</h2>
                  <p>Dear ${studentName},</p>
                  <p><strong>Your payment is now overdue and your LMS access has been suspended.</strong> Immediate action is required to restore your access:</p>
                  <div style="background-color: #fecaca; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #dc2626;">
                    <h3 style="margin-top: 0; color: #dc2626;">Overdue Payment</h3>
                    <p><strong>Installment Number:</strong> #${invoice.installment_number}</p>
                    <p><strong>Amount:</strong> ${currencySymbol}${invoice.amount}</p>
                    <p><strong>Status:</strong> OVERDUE - LMS SUSPENDED</p>
                  </div>
                  <p><strong>Action Required:</strong> Your learning platform access has been suspended until payment is received. Please make payment immediately to restore full access. ${pdfBuffer ? 'The detailed invoice with payment instructions is attached to this email.' : ''}</p>
                  <p>If you need assistance or wish to discuss payment arrangements, please contact our support team immediately.</p>
                  <p>Best regards,<br>The Learning Team</p>
                </div>
              `,
              pdfBuffer,
              installmentNumber: invoice.installment_number,
            });
          } catch (emailError) {
            console.error(`[Email FAILED] Due email for installment #${invoice.installment_number} to ${studentEmail}:`, emailError.message);
          }

          await createInstallmentNotification(
            supabaseAdmin,
            invoice.students.user_id,
            'installment_due',
            'Payment Overdue',
            `Installment #${invoice.installment_number} of ${currencySymbol}${invoice.amount} is now overdue. Please make payment immediately.`,
            { installment_number: invoice.installment_number, amount: invoice.amount, due_date: invoice.due_date },
            studentDisplayId
          );

          // Suspend LMS access
          const { error: suspendError } = await supabaseAdmin
            .from('users')
            .update({ lms_status: 'suspended' })
            .eq('id', invoice.students.user_id);

          if (suspendError) {
            console.error(`Error suspending LMS for user ${invoice.students.user_id}:`, suspendError);
          } else {
            console.log(`LMS suspended for user ${invoice.students.user_id} due to overdue payment`);
            
            await supabaseAdmin.from('admin_logs').insert({
              entity_type: 'user',
              entity_id: invoice.students.user_id,
              action: 'lms_suspended',
              description: `LMS suspended due to overdue installment #${invoice.installment_number}`,
              data: { 
                target_user_id: invoice.students.user_id,
                invoice_id: invoice.id, 
                installment_number: invoice.installment_number,
                amount: invoice.amount,
                reason: 'Auto-suspended due to non-payment of fees'
              }
            });

            await supabaseAdmin.from('user_activity_logs').insert({
              user_id: invoice.students.user_id,
              activity_type: 'lms_suspended',
              metadata: {
                reason: 'Auto-suspended due to non-payment of fees',
                invoice_id: invoice.id,
                installment_number: invoice.installment_number,
                amount: invoice.amount,
                due_date: invoice.due_date
              },
              occurred_at: new Date().toISOString()
            });

            await createInstallmentNotification(
              supabaseAdmin,
              invoice.students.user_id,
              'lms_suspended',
              'LMS Access Suspended',
              `Your learning platform access has been suspended due to overdue payment for Installment #${invoice.installment_number}. Please make payment to restore access.`,
              { invoice_id: invoice.id, installment_number: invoice.installment_number },
              studentDisplayId
            );
          }

          console.log(`Marked installment ${invoice.installment_number} as due for student ${studentName}`);
        }
        // First reminder — send email BEFORE marking flag (retry-safe)
        else if (today >= firstReminderDate && !invoice.first_reminder_sent) {
          let emailSent = false;
          try {
            const pdfBuffer = await safeGeneratePDF(invoice, currency, companyDetails, paymentMethods, dueDate, studentName, studentEmail);

            await sendBillingEmail({
              to: studentEmail,
              subject: `Payment Reminder - Installment #${invoice.installment_number} Due ${dueDate}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h2 style="color: #f59e0b;">Payment Reminder</h2>
                  <p>Dear ${studentName},</p>
                  <p>This is a friendly reminder that your installment payment is coming due:</p>
                  <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                    <h3 style="margin-top: 0;">Payment Details</h3>
                    <p><strong>Installment Number:</strong> #${invoice.installment_number}</p>
                    <p><strong>Amount:</strong> ${currencySymbol}${invoice.amount}</p>
                    <p><strong>Due Date:</strong> ${dueDate}</p>
                    <p><strong>Status:</strong> Pending Payment</p>
                  </div>
                  <p>Please make your payment by the due date to continue your learning journey without interruption. ${pdfBuffer ? 'The detailed invoice with payment instructions is attached to this email.' : ''}</p>
                  <p>If you have any questions or need assistance, please contact our support team.</p>
                  <p>Best regards,<br>The Learning Team</p>
                </div>
              `,
              pdfBuffer,
              installmentNumber: invoice.installment_number,
            });
            emailSent = true;
          } catch (emailError) {
            console.error(`[Email FAILED] First reminder for installment #${invoice.installment_number} to ${studentEmail}:`, emailError.message);
          }

          // Only mark as sent if email succeeded — allows retry on next run
          if (emailSent) {
            await supabaseAdmin
              .from('invoices')
              .update({ 
                first_reminder_sent: true,
                first_reminder_sent_at: new Date().toISOString()
              })
              .eq('id', invoice.id);
            console.log(`First reminder sent and flagged for installment ${invoice.installment_number} to ${studentName}`);
          } else {
            console.warn(`[Retry] First reminder for installment #${invoice.installment_number} will be retried on next run`);
          }

          await createInstallmentNotification(
            supabaseAdmin,
            invoice.students.user_id,
            'installment_reminder',
            'Payment Reminder',
            `Reminder: Installment #${invoice.installment_number} of ${currencySymbol}${invoice.amount} is due on ${effectiveDueDate.toLocaleDateString()}`,
            { installment_number: invoice.installment_number, amount: invoice.amount, due_date: effectiveDueDate.toISOString() },
            studentDisplayId
          );
        }
        // Second reminder — send email BEFORE marking flag (retry-safe)
        else if (today >= secondReminderDate && !invoice.second_reminder_sent && invoice.first_reminder_sent) {
          let emailSent = false;
          try {
            const pdfBuffer = await safeGeneratePDF(invoice, currency, companyDetails, paymentMethods, dueDate, studentName, studentEmail);

            await sendBillingEmail({
              to: studentEmail,
              subject: `FINAL REMINDER - Installment #${invoice.installment_number} Due ${dueDate}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h2 style="color: #dc2626;">Final Payment Reminder</h2>
                  <p>Dear ${studentName},</p>
                  <p><strong>This is your final reminder</strong> that your installment payment is due soon:</p>
                  <div style="background-color: #fee2e2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
                    <h3 style="margin-top: 0;">Payment Details</h3>
                    <p><strong>Installment Number:</strong> #${invoice.installment_number}</p>
                    <p><strong>Amount:</strong> ${currencySymbol}${invoice.amount}</p>
                    <p><strong>Due Date:</strong> ${dueDate}</p>
                    <p><strong>Status:</strong> Payment Required</p>
                  </div>
                  <p><strong>Important:</strong> Failure to make payment by the due date may result in temporary suspension of your learning platform access. ${pdfBuffer ? 'The detailed invoice with payment instructions is attached to this email.' : ''}</p>
                  <p>If you're experiencing financial difficulties, please contact our support team immediately to discuss payment options.</p>
                  <p>Best regards,<br>The Learning Team</p>
                </div>
              `,
              pdfBuffer,
              installmentNumber: invoice.installment_number,
            });
            emailSent = true;
          } catch (emailError) {
            console.error(`[Email FAILED] Second reminder for installment #${invoice.installment_number} to ${studentEmail}:`, emailError.message);
          }

          if (emailSent) {
            await supabaseAdmin
              .from('invoices')
              .update({ 
                second_reminder_sent: true,
                second_reminder_sent_at: new Date().toISOString()
              })
              .eq('id', invoice.id);
            console.log(`Second reminder sent and flagged for installment ${invoice.installment_number} to ${studentName}`);
          } else {
            console.warn(`[Retry] Second reminder for installment #${invoice.installment_number} will be retried on next run`);
          }

          await createInstallmentNotification(
            supabaseAdmin,
            invoice.students.user_id,
            'installment_reminder',
            'Final Payment Reminder',
            `Final reminder: Installment #${invoice.installment_number} of ${currencySymbol}${invoice.amount} is due on ${effectiveDueDate.toLocaleDateString()}`,
            { installment_number: invoice.installment_number, amount: invoice.amount, due_date: effectiveDueDate.toISOString() },
            studentDisplayId
          );
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Installment reminder scheduler completed successfully'
      }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in installment reminder scheduler:', error);
    return new Response(
      JSON.stringify({ error: 'Scheduler error', details: error.message }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function createInstallmentNotification(
  supabase: any,
  userId: string,
  type: string,
  title: string,
  message: string,
  metadata: any,
  studentRecordId?: string
) {
  try {
    await supabase.rpc('create_notification', {
      p_user_id: userId,
      p_type: type,
      p_title: title,
      p_message: message,
      p_metadata: metadata
    });

    const displayId = studentRecordId || userId;
    const { data: adminUsers } = await supabase
      .from('users')
      .select('id')
      .in('role', ['admin', 'superadmin']);

    for (const admin of adminUsers || []) {
      await supabase.rpc('create_notification', {
        p_user_id: admin.id,
        p_type: 'financial',
        p_title: `Student ${title}`,
        p_message: `${message} (Student ID: ${displayId})`,
        p_metadata: { ...metadata, student_id: displayId }
      });
    }

    console.log(`Notifications created for ${type}`);
  } catch (error) {
    console.error('Error creating notifications:', error);
  }
}
