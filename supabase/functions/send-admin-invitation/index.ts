import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvitationRequest {
  email: string;
  full_name: string;
  role: string;
  temp_password: string;
  login_url: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Admin invitation function called");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    const { email, full_name, role, temp_password, login_url }: InvitationRequest = await req.json();

    console.log(`Sending invitation to ${email} for role ${role}`);

    // Configure SMTP client
    const client = new SMTPClient({
      connection: {
        hostname: "smtp.hostinger.com",
        port: 465,
        tls: true,
        auth: {
          username: "notifications@core47.ai",
          password: "@IDMisnai8n@@12",
        },
      },
    });

    // Send email
    await client.send({
      from: "notifications@core47.ai",
      to: email,
      subject: `Welcome to the team - Your ${role} account is ready`,
      content: "auto",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
            Welcome to the Team, ${full_name}!
          </h1>
          
          <p style="font-size: 16px; line-height: 1.6; color: #555;">
            You have been added as a <strong>${role}</strong> to our system. 
            Your account has been created and is ready for you to access.
          </p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">Your Login Credentials:</h3>
            <p style="margin: 10px 0;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 10px 0;"><strong>Temporary Password:</strong> <code style="background-color: #e9ecef; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${temp_password}</code></p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${login_url}" 
               style="display: inline-block; background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Sign In to Your Account
            </a>
          </div>
          
          <div style="border-left: 4px solid #ffc107; padding-left: 15px; margin: 20px 0; background-color: #fff8e1;">
            <p style="margin: 0; color: #856404;">
              <strong>Important:</strong> Please change your password after your first login for security purposes.
            </p>
          </div>
          
          <p style="font-size: 14px; color: #777; margin-top: 30px;">
            If you have any questions or need assistance, please contact the system administrator.
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="font-size: 12px; color: #999; text-align: center;">
            This is an automated message. Please do not reply to this email.
          </p>
        </div>
      `,
    });

    await client.close();

    console.log("Email sent successfully via SMTP");

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Invitation sent successfully"
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-admin-invitation function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);