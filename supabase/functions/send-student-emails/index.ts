import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StudentData {
  id: string;
  email: string;
  full_name: string;
  temp_password: string;
  student_id: string;
}

interface CompanySettings {
  company_name: string;
  original_fee_amount: number;
  invoice_from_email: string;
  invoice_from_name: string;
  lms_from_email: string;
  lms_from_name: string;
}

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role key to bypass RLS
    const supabaseServiceRole = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log("Starting email processing job...");

    // Get queued messages for student onboarding
    const { data: queuedMessages, error: queueError } = await supabaseServiceRole
      .from("messages")
      .select("*")
      .eq("template_name", "student_onboarding")
      .eq("status", "queued")
      .limit(10);

    if (queueError) {
      console.error("Error fetching queued messages:", queueError);
      throw queueError;
    }

    if (!queuedMessages || queuedMessages.length === 0) {
      console.log("No queued student onboarding messages found");
      return new Response(
        JSON.stringify({ message: "No messages to process" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${queuedMessages.length} queued messages...`);

    // Get company settings
    const { data: companySettings, error: settingsError } = await supabaseServiceRole
      .from("company_settings")
      .select("*")
      .single();

    if (settingsError) {
      console.error("Error fetching company settings:", settingsError);
      throw settingsError;
    }

    let processedCount = 0;
    const errors: string[] = [];

    for (const message of queuedMessages) {
      try {
        console.log(`Processing message for user ${message.user_id}...`);

        // Get updated student data
        const { data: studentData, error: studentError } = await supabaseServiceRole
          .from("users")
          .select("id, email, full_name, temp_password, student_id")
          .eq("id", message.user_id)
          .eq("role", "student")
          .single();

        if (studentError || !studentData) {
          console.error(`Student not found for message ${message.id}:`, studentError);
          await markMessageFailed(supabaseServiceRole, message.id, "Student not found");
          continue;
        }

        // Hash the password and update lms_password
        const hashedPassword = await hashPassword(studentData.temp_password);
        await supabaseServiceRole
          .from("users")
          .update({ lms_password: hashedPassword })
          .eq("id", studentData.id);

        // Generate invoice details
        const invoiceNumber = `INV-${new Date().getFullYear()}-${studentData.id.substring(0, 8)}`;
        const amount = companySettings.original_fee_amount;
        
        // Send welcome email
        await sendWelcomeEmail(
          resend,
          studentData,
          companySettings,
          invoiceNumber,
          amount
        );

        // Send invoice email
        await sendInvoiceEmail(
          resend,
          studentData,
          companySettings,
          invoiceNumber,
          amount
        );

        // Mark message as processed
        await supabaseServiceRole
          .from("messages")
          .update({ status: "sent" })
          .eq("id", message.id);

        processedCount++;
        console.log(`Successfully processed emails for ${studentData.email}`);

      } catch (error) {
        console.error(`Error processing message ${message.id}:`, error);
        errors.push(`Message ${message.id}: ${error.message}`);
        await markMessageFailed(supabaseServiceRole, message.id, error.message);
      }
    }

    console.log(`Processed ${processedCount} messages successfully`);
    if (errors.length > 0) {
      console.error("Errors encountered:", errors);
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
    console.error("Error in send-student-emails function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

async function hashPassword(password: string): Promise<string> {
  // Simple bcrypt-like hashing for demo - in production use proper bcrypt
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "salt123");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sendWelcomeEmail(
  resend: any,
  student: StudentData,
  settings: CompanySettings,
  invoiceNumber: string,
  amount: number
): Promise<void> {
  const fromEmail = settings.lms_from_email || "noreply@yourdomain.com";
  const fromName = settings.lms_from_name || settings.company_name;
  
  const emailResponse = await resend.emails.send({
    from: `${fromName} <${fromEmail}>`,
    to: [student.email],
    subject: "Welcome to GrowthOS – your LMS login",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Welcome to GrowthOS, ${student.full_name}!</h1>
        
        <p>Your student account has been created successfully. Here are your login credentials:</p>
        
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">LMS Login Details</h3>
          <p><strong>LMS URL:</strong> <a href="https://your-lms-domain.com/login">https://your-lms-domain.com/login</a></p>
          <p><strong>Username:</strong> ${student.email}</p>
          <p><strong>Password:</strong> ${student.temp_password}</p>
          <p><strong>Student ID:</strong> ${student.student_id}</p>
        </div>
        
        <p><strong>⚠️ Important:</strong> Please change your password after your first login for security.</p>
        
        <p>If you have any questions, please contact our support team.</p>
        
        <p>Best regards,<br>
        The ${settings.company_name} Team</p>
      </div>
    `,
  });

  if (emailResponse.error) {
    throw new Error(`Failed to send welcome email: ${emailResponse.error.message}`);
  }
}

async function sendInvoiceEmail(
  resend: any,
  student: StudentData,
  settings: CompanySettings,
  invoiceNumber: string,
  amount: number
): Promise<void> {
  const fromEmail = settings.invoice_from_email || "billing@yourdomain.com";
  const fromName = settings.invoice_from_name || `${settings.company_name} Billing`;
  
  const emailResponse = await resend.emails.send({
    from: `${fromName} <${fromEmail}>`,
    to: [student.email],
    subject: "Your first invoice is ready",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Invoice Ready - ${student.full_name}</h1>
        
        <p>Your first installment invoice has been generated and is ready for payment.</p>
        
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Invoice Details</h3>
          <p><strong>Invoice Number:</strong> ${invoiceNumber}</p>
          <p><strong>Amount:</strong> $${amount.toLocaleString()}</p>
          <p><strong>Student ID:</strong> ${student.student_id}</p>
          <p><strong>Due Date:</strong> ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://payments.yourdomain.com/invoice/${invoiceNumber}" 
             style="background: #007cba; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Pay Now
          </a>
        </div>
        
        <p>Please ensure payment is made by the due date to avoid any interruption in your learning journey.</p>
        
        <p>If you have any questions about this invoice, please contact our billing team.</p>
        
        <p>Best regards,<br>
        The ${settings.company_name} Team</p>
      </div>
    `,
  });

  if (emailResponse.error) {
    throw new Error(`Failed to send invoice email: ${emailResponse.error.message}`);
  }
}

async function markMessageFailed(supabase: any, messageId: string, errorMessage: string): Promise<void> {
  await supabase
    .from("messages")
    .update({ 
      status: "failed",
      response_id: errorMessage.substring(0, 255)
    })
    .eq("id", messageId);
}

serve(handler);