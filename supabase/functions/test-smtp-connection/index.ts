import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestSMTPRequest {
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password: string;
  smtp_secure: boolean;
  test_email: string;
}

const handler = async (req: Request): Promise<Response> => {
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
    const body: TestSMTPRequest = await req.json();
    
    // Validate required fields and trim whitespace
    const trimmedHost = body.smtp_host?.trim();
    const trimmedUsername = body.smtp_username?.trim();
    const trimmedPassword = body.smtp_password?.trim();
    const trimmedEmail = body.test_email?.trim();
    
    if (!trimmedHost || !trimmedUsername || !trimmedPassword || !trimmedEmail) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Missing required SMTP configuration fields" 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    console.log(`Testing SMTP connection to ${trimmedHost}:${body.smtp_port}...`);

    // Create SMTP client
    const client = new SMTPClient({
      connection: {
        hostname: trimmedHost,
        port: body.smtp_port,
        tls: body.smtp_secure,
        auth: {
          username: trimmedUsername,
          password: trimmedPassword,
        },
      },
    });

    // Test connection by sending a test email
    const testEmail = {
      from: trimmedEmail,
      to: trimmedEmail,
      subject: "SMTP Configuration Test - Success!",
      content: `SMTP Configuration Test

This email confirms that your SMTP settings are configured correctly.

Configuration Details:
- Host: ${trimmedHost}
- Port: ${body.smtp_port}
- Secure: ${body.smtp_secure ? 'Yes' : 'No'}
- Username: ${trimmedUsername}

Test completed at: ${new Date().toISOString()}

Your email system is ready to send welcome emails and invoices!`,
    };

    await client.send(testEmail);
    await client.close();

    console.log("SMTP test email sent successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "SMTP connection successful! Test email sent." 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("SMTP test failed:", error);
    
    // Provide helpful error messages
    let errorMessage = error.message;
    
    if (error.message.includes("authentication failed")) {
      errorMessage = "Authentication failed. Please check your username and password.";
    } else if (error.message.includes("connection refused")) {
      errorMessage = "Connection refused. Please check the host and port settings.";
    } else if (error.message.includes("timeout")) {
      errorMessage = "Connection timeout. Please check your network and firewall settings.";
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
};

serve(handler);