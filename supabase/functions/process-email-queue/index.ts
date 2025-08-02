import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "npm:resend@4.0.0";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailQueueItem {
  id: string;
  user_id: string;
  email_type: 'welcome_student' | 'welcome_staff' | 'invoice';
  recipient_email: string;
  recipient_name: string;
  template_data: any;
  retry_count: number;
  max_retries: number;
}

interface CompanySettings {
  company_name: string;
  original_fee_amount: number;
  lms_from_email: string;
  lms_from_name: string;
  invoice_from_email: string;
  invoice_from_name: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_username?: string;
  smtp_password?: string;
  smtp_secure?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("Starting email queue processing...");

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get pending emails from queue
    const { data: queuedEmails, error: queueError } = await supabase
      .from("email_queue")
      .select("*")
      .eq("status", "pending")
      .lte("retry_count", 3)
      .order("created_at", { ascending: true })
      .limit(10);

    if (queueError) {
      console.error("Error fetching email queue:", queueError);
      throw queueError;
    }

    if (!queuedEmails || queuedEmails.length === 0) {
      console.log("No pending emails found");
      return new Response(
        JSON.stringify({ message: "No emails to process" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${queuedEmails.length} emails...`);

    // Get company settings for SMTP and email configuration
    const { data: settings, error: settingsError } = await supabase
      .from("company_settings")
      .select("*")
      .single();

    if (settingsError) {
      console.error("Error fetching company settings:", settingsError);
      throw settingsError;
    }

    let processedCount = 0;
    const errors: string[] = [];

    for (const email of queuedEmails) {
      try {
        console.log(`Processing email ${email.id} for ${email.recipient_email}...`);

        // Mark as sending
        await supabase
          .from("email_queue")
          .update({ status: "sending" })
          .eq("id", email.id);

        // Send email based on type
        await sendEmail(email, settings);

        // Mark as sent
        await supabase
          .from("email_queue")
          .update({ 
            status: "sent", 
            sent_at: new Date().toISOString(),
            error_message: null
          })
          .eq("id", email.id);

        processedCount++;
        console.log(`Successfully sent email to ${email.recipient_email}`);

      } catch (error) {
        console.error(`Error processing email ${email.id}:`, error);
        errors.push(`Email ${email.id}: ${error.message}`);
        
        // Update retry count and status
        const newRetryCount = email.retry_count + 1;
        const isFinalFailure = newRetryCount >= email.max_retries;
        
        await supabase
          .from("email_queue")
          .update({ 
            status: isFinalFailure ? "failed" : "pending",
            retry_count: newRetryCount,
            error_message: error.message.substring(0, 500),
            scheduled_at: isFinalFailure ? null : new Date(Date.now() + (60000 * Math.pow(2, newRetryCount))).toISOString() // Exponential backoff
          })
          .eq("id", email.id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        errors: errors.length,
        errorDetails: errors
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in process-email-queue function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

async function sendEmail(email: EmailQueueItem, settings: CompanySettings): Promise<void> {
  // Prefer SMTP if configured, fallback to Resend
  if (settings.smtp_host && settings.smtp_username && settings.smtp_password) {
    await sendViaSMTP(email, settings);
  } else if (Deno.env.get("RESEND_API_KEY")) {
    await sendViaResend(email, settings);
  } else {
    throw new Error("No email service configured. Please configure SMTP in company settings or set RESEND_API_KEY.");
  }
}

async function sendViaResend(email: EmailQueueItem, settings: CompanySettings): Promise<void> {
  const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
  const { subject, html, fromName, fromEmail } = generateEmailContent(email, settings);

  const response = await resend.emails.send({
    from: `${fromName} <${fromEmail}>`,
    to: [email.recipient_email],
    subject,
    html,
  });

  if (response.error) {
    throw new Error(`Resend error: ${response.error.message}`);
  }
}

async function sendViaSMTP(email: EmailQueueItem, settings: CompanySettings): Promise<void> {
  const { subject, html, fromName, fromEmail } = generateEmailContent(email, settings);

  const client = new SMTPClient({
    connection: {
      hostname: settings.smtp_host!,
      port: settings.smtp_port || 587,
      tls: settings.smtp_secure !== false,
      auth: {
        username: settings.smtp_username!,
        password: settings.smtp_password!,
      },
    },
  });

  await client.send({
    from: `${fromName} <${fromEmail}>`,
    to: email.recipient_email,
    subject,
    content: html,
    html: html,
  });

  await client.close();
}

function generateEmailContent(email: EmailQueueItem, settings: CompanySettings) {
  const data = email.template_data;
  const loginUrl = `${Deno.env.get("SUPABASE_URL")?.replace("supabase.co", "lovable.app") || "https://your-app.com"}/login`;

  switch (email.email_type) {
    case 'welcome_student':
      return {
        subject: `Welcome to ${settings.company_name}!`,
        fromName: settings.lms_from_name || settings.company_name,
        fromEmail: settings.lms_from_email,
        html: generateStudentWelcomeHTML(data, settings, loginUrl)
      };

    case 'welcome_staff':
      return {
        subject: `Welcome to the ${settings.company_name} team!`,
        fromName: settings.lms_from_name || settings.company_name,
        fromEmail: settings.lms_from_email,
        html: generateStaffWelcomeHTML(data, settings, loginUrl)
      };

    case 'invoice':
      const invoiceNumber = `INV-${new Date().getFullYear()}-${data.user_id.substring(0, 8)}`;
      return {
        subject: `Your invoice is ready - ${settings.company_name}`,
        fromName: settings.invoice_from_name || `${settings.company_name} Billing`,
        fromEmail: settings.invoice_from_email,
        html: generateInvoiceHTML(data, settings, invoiceNumber)
      };

    default:
      throw new Error(`Unknown email type: ${email.email_type}`);
  }
}

function generateStudentWelcomeHTML(data: any, settings: CompanySettings, loginUrl: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Welcome to ${settings.company_name}</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .credentials { background: white; border: 1px solid #e1e5e9; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Welcome to ${settings.company_name}, ${data.full_name}!</h1>
            <p>Your learning journey starts here</p>
        </div>
        <div class="content">
            <p>Congratulations! Your student account has been successfully created. We're excited to have you join our learning community.</p>
            
            <div class="credentials">
                <h3>🔑 Your Login Credentials</h3>
                <p><strong>Login URL:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
                <p><strong>Email:</strong> ${data.email}</p>
                <p><strong>Temporary Password:</strong> <code style="background: #f1f1f1; padding: 4px 8px; border-radius: 4px;">${data.temp_password}</code></p>
                ${data.student_id ? `<p><strong>Student ID:</strong> ${data.student_id}</p>` : ''}
            </div>
            
            <p style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 20px 0;">
                <strong>⚠️ Important:</strong> Please change your password after your first login for security. You can do this in your profile settings.
            </p>
            
            <div style="text-align: center;">
                <a href="${loginUrl}" class="button">Login to Your Account</a>
            </div>
            
            <h3>🚀 Getting Started</h3>
            <ul>
                <li>Log in to your account using the credentials above</li>
                <li>Complete your profile setup</li>
                <li>Explore your course materials</li>
                <li>Connect with your mentor and fellow students</li>
            </ul>
            
            <p>If you have any questions or need assistance, don't hesitate to contact our support team. We're here to help you succeed!</p>
        </div>
        <div class="footer">
            <p>Best regards,<br>The ${settings.company_name} Team</p>
            <p style="font-size: 12px; color: #999;">This email was sent to ${data.email}</p>
        </div>
    </body>
    </html>
  `;
}

function generateStaffWelcomeHTML(data: any, settings: CompanySettings, loginUrl: string): string {
  const roleDisplay = data.role === 'enrollment_manager' ? 'Enrollment Manager' : 
                     data.role.charAt(0).toUpperCase() + data.role.slice(1);
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Welcome to the ${settings.company_name} Team</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .credentials { background: white; border: 1px solid #e1e5e9; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .button { display: inline-block; background: #3498db; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Welcome to the ${settings.company_name} Team, ${data.full_name}!</h1>
            <p>Your ${roleDisplay} account is ready</p>
        </div>
        <div class="content">
            <p>Welcome aboard! We're thrilled to have you join our team. Your ${roleDisplay} account has been created and you're ready to start making an impact.</p>
            
            <div class="credentials">
                <h3>🔑 Your Login Credentials</h3>
                <p><strong>Admin Portal:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
                <p><strong>Email:</strong> ${data.email}</p>
                <p><strong>Temporary Password:</strong> <code style="background: #f1f1f1; padding: 4px 8px; border-radius: 4px;">${data.temp_password}</code></p>
                <p><strong>Role:</strong> ${roleDisplay}</p>
                ${data.lms_user_id ? `<p><strong>LMS User ID:</strong> ${data.lms_user_id}</p>` : ''}
            </div>
            
            <p style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 20px 0;">
                <strong>⚠️ Security:</strong> Please change your password immediately after your first login. This is crucial for maintaining system security.
            </p>
            
            <div style="text-align: center;">
                <a href="${loginUrl}" class="button">Access Admin Portal</a>
            </div>
            
            <h3>🎯 Your Responsibilities</h3>
            <ul>
                ${data.role === 'admin' ? `
                    <li>Manage system settings and configurations</li>
                    <li>Oversee user accounts and permissions</li>
                    <li>Monitor system performance and analytics</li>
                    <li>Handle escalated support issues</li>
                ` : data.role === 'mentor' ? `
                    <li>Guide and support assigned students</li>
                    <li>Review and provide feedback on assignments</li>
                    <li>Track student progress and engagement</li>
                    <li>Conduct mentorship sessions</li>
                ` : data.role === 'enrollment_manager' ? `
                    <li>Manage student enrollment processes</li>
                    <li>Handle enrollment-related inquiries</li>
                    <li>Track enrollment metrics and reporting</li>
                    <li>Coordinate with admissions team</li>
                ` : `
                    <li>Fulfill your designated role responsibilities</li>
                    <li>Collaborate with team members effectively</li>
                    <li>Maintain high standards of service</li>
                `}
            </ul>
            
            <p>If you have any questions about your role or need assistance getting started, please don't hesitate to reach out to your supervisor or our IT team.</p>
        </div>
        <div class="footer">
            <p>Welcome to the team!<br>The ${settings.company_name} Leadership</p>
            <p style="font-size: 12px; color: #999;">This email was sent to ${data.email}</p>
        </div>
    </body>
    </html>
  `;
}

function generateInvoiceHTML(data: any, settings: CompanySettings, invoiceNumber: string): string {
  const amount = settings.original_fee_amount;
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString();
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Invoice - ${settings.company_name}</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .invoice-details { background: white; border: 1px solid #e1e5e9; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .button { display: inline-block; background: #e74c3c; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            .amount { font-size: 24px; font-weight: bold; color: #e74c3c; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Invoice Ready</h1>
            <p>Your payment is now due</p>
        </div>
        <div class="content">
            <p>Dear ${data.full_name},</p>
            <p>Your invoice has been generated and is ready for payment. Please review the details below and submit your payment by the due date.</p>
            
            <div class="invoice-details">
                <h3>📄 Invoice Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Invoice Number:</strong></td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${invoiceNumber}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Student ID:</strong></td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${data.student_id || 'N/A'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Due Date:</strong></td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${dueDate}</td>
                    </tr>
                    <tr>
                        <td style="padding: 15px 0 8px 0;"><strong>Amount Due:</strong></td>
                        <td style="padding: 15px 0 8px 0; text-align: right;"><span class="amount">$${amount.toLocaleString()}</span></td>
                    </tr>
                </table>
            </div>
            
            <div style="text-align: center;">
                <a href="https://payments.yourdomain.com/invoice/${invoiceNumber}" class="button">Pay Now</a>
            </div>
            
            <div style="background: #e8f4f8; border: 1px solid #bee5eb; border-radius: 5px; padding: 15px; margin: 20px 0;">
                <h4 style="margin-top: 0;">💡 Payment Information</h4>
                <ul style="margin-bottom: 0;">
                    <li>Multiple payment methods accepted</li>
                    <li>Secure payment processing</li>
                    <li>Automatic receipt generation</li>
                    <li>Payment confirmation via email</li>
                </ul>
            </div>
            
            <p style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 20px 0;">
                <strong>⏰ Important:</strong> Please ensure payment is made by the due date to avoid any interruption in your learning journey.
            </p>
            
            <p>If you have any questions about this invoice or need assistance with payment, please contact our billing team. We're here to help!</p>
        </div>
        <div class="footer">
            <p>Thank you for your business!<br>The ${settings.company_name} Billing Team</p>
            <p style="font-size: 12px; color: #999;">This email was sent to ${data.email}</p>
        </div>
    </body>
    </html>
  `;
}

serve(handler);