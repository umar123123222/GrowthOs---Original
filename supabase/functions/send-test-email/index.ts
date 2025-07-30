import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestEmailRequest {
  to_email: string;
  subject?: string;
  message?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    const requestData: TestEmailRequest = await req.json();
    console.log("Sending test email to:", requestData.to_email);

    // Get company settings for email configuration
    const { data: companySettings } = await supabase
      .from("company_settings")
      .select("company_name, company_email")
      .single();

    const companyName = companySettings?.company_name || "Your Company";
    const subject = requestData.subject || `Test Email from ${companyName}`;
    const message = requestData.message || "This is a test email to verify email functionality.";

    // Get SMTP configuration from environment variables
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPassword = Deno.env.get("SMTP_PASSWORD");
    const smtpFromEmail = Deno.env.get("SMTP_FROM_EMAIL") || Deno.env.get("SMTP_LMS_FROM_EMAIL");
    const smtpFromName = Deno.env.get("SMTP_FROM_NAME") || Deno.env.get("SMTP_LMS_FROM_NAME") || companyName;

    console.log("SMTP configuration check:", {
      host: !!smtpHost,
      port: !!smtpPort,
      user: !!smtpUser,
      password: !!smtpPassword,
      fromEmail: !!smtpFromEmail,
      fromName: !!smtpFromName
    });

    if (!smtpHost || !smtpUser || !smtpPassword || !smtpFromEmail) {
      throw new Error("SMTP configuration is incomplete. Please check environment variables.");
    }

    console.log("Attempting to send test email via SMTP to:", requestData.to_email);

    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: smtpPort === 465, // Use TLS for port 465 (SSL)
        auth: {
          username: smtpUser,
          password: smtpPassword,
        },
      },
    });

    await client.send({
      from: smtpFromEmail,
      fromName: smtpFromName,
      to: requestData.to_email,
      subject: subject,
      content: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
            .content { background: #ffffff; padding: 20px; border-radius: 8px; border: 1px solid #e9ecef; }
            .success { background: #d4edda; color: #155724; padding: 15px; border-radius: 6px; border-left: 4px solid #28a745; margin: 20px 0; }
            .footer { margin-top: 30px; font-size: 14px; color: #666; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Test Email Success!</h1>
              <p>Congratulations! Your email system is working correctly.</p>
            </div>
            
            <div class="content">
              <div class="success">
                <h3>✅ Email Delivery Confirmed</h3>
                <p>This test email was successfully delivered to <strong>${requestData.to_email}</strong></p>
              </div>
              
              <h3>📧 Email Details</h3>
              <ul>
                <li><strong>From:</strong> ${smtpFromName} &lt;${smtpFromEmail}&gt;</li>
                <li><strong>To:</strong> ${requestData.to_email}</li>
                <li><strong>Subject:</strong> ${subject}</li>
                <li><strong>Sent via:</strong> ${smtpHost}:${smtpPort}</li>
                <li><strong>Timestamp:</strong> ${new Date().toISOString()}</li>
              </ul>
              
              <h3>💬 Message</h3>
              <p>${message}</p>
            </div>
            
            <div class="footer">
              <p>Sent from ${companyName}<br>
              <small>This is an automated test email from your system.</small></p>
            </div>
          </div>
        </body>
        </html>
      `,
      html: true,
    });

    await client.close();
    console.log("Test email sent successfully via SMTP to:", requestData.to_email);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Test email sent successfully to ${requestData.to_email}`,
        details: {
          to: requestData.to_email,
          subject: subject,
          from: `${smtpFromName} <${smtpFromEmail}>`,
          timestamp: new Date().toISOString()
        }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      }
    );

  } catch (error) {
    console.error("Error sending test email:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
        details: "Please check your SMTP configuration and try again."
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      }
    );
  }
};

serve(handler);