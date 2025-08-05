import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { SMTPClient } from '../_shared/smtp-client.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('Installment reminder scheduler triggered');

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get LMS URL from company settings
    const { data: companySettings } = await supabaseAdmin
      .from('company_settings')
      .select('lms_url')
      .eq('id', 1)
      .single();
    
    const loginUrl = companySettings?.lms_url || 'https://growthos.core47.ai';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Check for invoices that should change from 'scheduled' to 'pending' (issue date reached)
    const { data: scheduledInvoices, error: scheduledError } = await supabaseAdmin
      .from('invoices')
      .select('*, students!inner(user_id, users!inner(full_name, email))')
      .eq('status', 'scheduled')
      .lte('created_at', today.toISOString());

    if (scheduledError) {
      console.error('Error fetching scheduled invoices:', scheduledError);
    } else {
      for (const invoice of scheduledInvoices || []) {
        // Update status to pending
        await supabaseAdmin
          .from('invoices')
          .update({ status: 'pending' })
          .eq('id', invoice.id);

        // Send issue email
        await sendInstallmentIssueEmail(invoice, loginUrl);
        
        // Create notification
        await createInstallmentNotification(
          supabaseAdmin,
          invoice.students.user_id,
          'installment_issued',
          'New Installment Issued',
          `Installment #${invoice.installment_number} of $${invoice.amount} has been issued. Due date: ${new Date(invoice.due_date).toLocaleDateString()}`,
          { installment_number: invoice.installment_number, amount: invoice.amount, due_date: invoice.due_date }
        );

        console.log(`Issued installment ${invoice.installment_number} for student ${invoice.students.users.full_name}`);
      }
    }

    // 2. Check for pending invoices that need reminders or are due
    const { data: pendingInvoices, error: pendingError } = await supabaseAdmin
      .from('invoices')
      .select('*, students!inner(user_id, users!inner(full_name, email))')
      .eq('status', 'pending');

    if (pendingError) {
      console.error('Error fetching pending invoices:', pendingError);
    } else {
      for (const invoice of pendingInvoices || []) {
        const issueDate = new Date(invoice.created_at);
        const dueDate = new Date(invoice.due_date);
        const daysDiff = Math.floor((dueDate.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Calculate reminder dates with equal intervals
        const firstReminderDate = new Date(issueDate);
        firstReminderDate.setDate(firstReminderDate.getDate() + Math.floor(daysDiff / 3));
        
        const secondReminderDate = new Date(issueDate);
        secondReminderDate.setDate(secondReminderDate.getDate() + Math.floor(2 * daysDiff / 3));

        // Check if due date has passed
        if (today >= dueDate) {
          await supabaseAdmin
            .from('invoices')
            .update({ status: 'due' })
            .eq('id', invoice.id);

          await sendDueEmail(invoice, loginUrl);
          await createInstallmentNotification(
            supabaseAdmin,
            invoice.students.user_id,
            'installment_due',
            'Payment Overdue',
            `Installment #${invoice.installment_number} of $${invoice.amount} is now overdue. Please make payment immediately.`,
            { installment_number: invoice.installment_number, amount: invoice.amount, due_date: invoice.due_date }
          );

          console.log(`Marked installment ${invoice.installment_number} as due for student ${invoice.students.users.full_name}`);
        }
        // Check for first reminder
        else if (today >= firstReminderDate && !invoice.first_reminder_sent) {
          await supabaseAdmin
            .from('invoices')
            .update({ 
              first_reminder_sent: true,
              first_reminder_sent_at: new Date().toISOString()
            })
            .eq('id', invoice.id);

          await sendFirstReminderEmail(invoice, loginUrl);
          await createInstallmentNotification(
            supabaseAdmin,
            invoice.students.user_id,
            'installment_reminder',
            'Payment Reminder',
            `Reminder: Installment #${invoice.installment_number} of $${invoice.amount} is due on ${new Date(invoice.due_date).toLocaleDateString()}`,
            { installment_number: invoice.installment_number, amount: invoice.amount, due_date: invoice.due_date }
          );

          console.log(`Sent first reminder for installment ${invoice.installment_number} to student ${invoice.students.users.full_name}`);
        }
        // Check for second reminder
        else if (today >= secondReminderDate && !invoice.second_reminder_sent && invoice.first_reminder_sent) {
          await supabaseAdmin
            .from('invoices')
            .update({ 
              second_reminder_sent: true,
              second_reminder_sent_at: new Date().toISOString()
            })
            .eq('id', invoice.id);

          await sendSecondReminderEmail(invoice, loginUrl);
          await createInstallmentNotification(
            supabaseAdmin,
            invoice.students.user_id,
            'installment_reminder',
            'Final Payment Reminder',
            `Final reminder: Installment #${invoice.installment_number} of $${invoice.amount} is due on ${new Date(invoice.due_date).toLocaleDateString()}`,
            { installment_number: invoice.installment_number, amount: invoice.amount, due_date: invoice.due_date }
          );

          console.log(`Sent second reminder for installment ${invoice.installment_number} to student ${invoice.students.users.full_name}`);
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

async function sendInstallmentIssueEmail(invoice: any, loginUrl: string) {
  try {
    const smtpClient = SMTPClient.fromEnv();
    const studentEmail = invoice.students.users.email;
    const studentName = invoice.students.users.full_name;
    const dueDate = new Date(invoice.due_date).toLocaleDateString();
    
    await smtpClient.sendEmail({
      to: studentEmail,
      subject: `Installment #${invoice.installment_number} Issued - Payment Due ${dueDate}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb;">Installment Payment Issued</h2>
          
          <p>Dear ${studentName},</p>
          
          <p>A new installment payment has been issued for your account:</p>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Payment Details</h3>
            <p><strong>Installment Number:</strong> #${invoice.installment_number}</p>
            <p><strong>Amount:</strong> $${invoice.amount}</p>
            <p><strong>Due Date:</strong> ${dueDate}</p>
            <p><strong>Status:</strong> Pending Payment</p>
          </div>
          
          <p>Please ensure payment is made by the due date to avoid any service interruptions.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}" 
               style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
              View Payment Details
            </a>
          </div>
          
          <p>If you have any questions, please contact our support team.</p>
          
          <p>Best regards,<br>The Learning Team</p>
        </div>
      `
    });

    console.log(`Issue email sent to ${studentEmail} for installment ${invoice.installment_number}`);
  } catch (error) {
    console.error('Error sending issue email:', error);
  }
}

async function sendFirstReminderEmail(invoice: any, loginUrl: string) {
  try {
    const smtpClient = SMTPClient.fromEnv();
    const studentEmail = invoice.students.users.email;
    const studentName = invoice.students.users.full_name;
    const dueDate = new Date(invoice.due_date).toLocaleDateString();
    
    await smtpClient.sendEmail({
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
            <p><strong>Amount:</strong> $${invoice.amount}</p>
            <p><strong>Due Date:</strong> ${dueDate}</p>
            <p><strong>Status:</strong> Pending Payment</p>
          </div>
          
          <p>Please make your payment by the due date to continue your learning journey without interruption.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}" 
               style="background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
              Make Payment Now
            </a>
          </div>
          
          <p>If you have any questions or need assistance, please contact our support team.</p>
          
          <p>Best regards,<br>The Learning Team</p>
        </div>
      `
    });

    console.log(`First reminder email sent to ${studentEmail} for installment ${invoice.installment_number}`);
  } catch (error) {
    console.error('Error sending first reminder email:', error);
  }
}

async function sendSecondReminderEmail(invoice: any, loginUrl: string) {
  try {
    const smtpClient = SMTPClient.fromEnv();
    const studentEmail = invoice.students.users.email;
    const studentName = invoice.students.users.full_name;
    const dueDate = new Date(invoice.due_date).toLocaleDateString();
    
    await smtpClient.sendEmail({
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
            <p><strong>Amount:</strong> $${invoice.amount}</p>
            <p><strong>Due Date:</strong> ${dueDate}</p>
            <p><strong>Status:</strong> Payment Required</p>
          </div>
          
          <p><strong>Important:</strong> Failure to make payment by the due date may result in temporary suspension of your learning platform access.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}" 
               style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
              Pay Now to Avoid Suspension
            </a>
          </div>
          
          <p>If you're experiencing financial difficulties, please contact our support team immediately to discuss payment options.</p>
          
          <p>Best regards,<br>The Learning Team</p>
        </div>
      `
    });

    console.log(`Second reminder email sent to ${studentEmail} for installment ${invoice.installment_number}`);
  } catch (error) {
    console.error('Error sending second reminder email:', error);
  }
}

async function sendDueEmail(invoice: any, loginUrl: string) {
  try {
    const smtpClient = SMTPClient.fromEnv();
    const studentEmail = invoice.students.users.email;
    const studentName = invoice.students.users.full_name;
    
    await smtpClient.sendEmail({
      to: studentEmail,
      subject: `URGENT - Payment Overdue for Installment #${invoice.installment_number}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #dc2626;">Payment Overdue Notice</h2>
          
          <p>Dear ${studentName},</p>
          
          <p><strong>Your payment is now overdue.</strong> Immediate action is required to avoid service suspension:</p>
          
          <div style="background-color: #fecaca; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #dc2626;">
            <h3 style="margin-top: 0; color: #dc2626;">Overdue Payment</h3>
            <p><strong>Installment Number:</strong> #${invoice.installment_number}</p>
            <p><strong>Amount:</strong> $${invoice.amount}</p>
            <p><strong>Status:</strong> OVERDUE</p>
          </div>
          
          <p><strong>Action Required:</strong> Your learning platform access may be suspended until payment is received. Please make payment immediately to restore full access.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}" 
               style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
              Pay Now - Restore Access
            </a>
          </div>
          
          <p>If you need assistance or wish to discuss payment arrangements, please contact our support team immediately.</p>
          
          <p>Best regards,<br>The Learning Team</p>
        </div>
      `
    });

    console.log(`Due email sent to ${studentEmail} for installment ${invoice.installment_number}`);
  } catch (error) {
    console.error('Error sending due email:', error);
  }
}

async function createInstallmentNotification(
  supabase: any,
  userId: string,
  type: string,
  title: string,
  message: string,
  metadata: any
) {
  try {
    // Create notification for the student
    await supabase.rpc('create_notification', {
      p_user_id: userId,
      p_type: type,
      p_title: title,
      p_message: message,
      p_metadata: metadata
    });

    // Notify admins and superadmins
    const { data: adminUsers } = await supabase
      .from('users')
      .select('id')
      .in('role', ['admin', 'superadmin']);

    for (const admin of adminUsers || []) {
      await supabase.rpc('create_notification', {
        p_user_id: admin.id,
        p_type: 'financial',
        p_title: `Student ${title}`,
        p_message: `${message} (Student ID: ${userId})`,
        p_metadata: { ...metadata, student_id: userId }
      });
    }

    console.log(`Notifications created for ${type}`);
  } catch (error) {
    console.error('Error creating notifications:', error);
  }
}