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
    
    // Validate required fields
    if (!body.smtp_host || !body.smtp_username || !body.smtp_password || !body.test_email) {
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

    console.log(`Testing SMTP connection to ${body.smtp_host}:${body.smtp_port}...`);

    // Create SMTP client
    const client = new SMTPClient({
      connection: {
        hostname: body.smtp_host,
        port: body.smtp_port,
        tls: body.smtp_secure,
        auth: {
          username: body.smtp_username,
          password: body.smtp_password,
        },
      },
    });

    // Test connection by sending a test email
    const testEmail = {
      from: `SMTP Test <${body.test_email}>`,
      to: body.test_email, // Send to the same email for testing
      subject: "SMTP Configuration Test - Success!",
      content: `
        SMTP Configuration Test
        
        This email confirms that your SMTP settings are configured correctly.
        
        Configuration Details:
        - Host: ${body.smtp_host}
        - Port: ${body.smtp_port}
        - Secure: ${body.smtp_secure ? 'Yes' : 'No'}
        - Username: ${body.smtp_username}
        
        Test completed at: ${new Date().toISOString()}
        
        Your email system is ready to send welcome emails and invoices!
      `,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1>✅ SMTP Test Successful!</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p>This email confirms that your SMTP settings are configured correctly and working as expected.</p>
            
            <div style="background: white; border: 1px solid #e1e5e9; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3>📋 Configuration Details</h3>
              <ul style="list-style: none; padding: 0;">
                <li><strong>Host:</strong> ${body.smtp_host}</li>
                <li><strong>Port:</strong> ${body.smtp_port}</li>
                <li><strong>Secure:</strong> ${body.smtp_secure ? 'Yes (TLS/SSL)' : 'No'}</li>
                <li><strong>Username:</strong> ${body.smtp_username}</li>
              </ul>
            </div>
            
            <p style="background: #d1fae5; border: 1px solid #10b981; border-radius: 5px; padding: 15px; margin: 20px 0;">
              <strong>🎉 Success!</strong> Your email system is ready to send welcome emails and invoices to your users.
            </p>
            
            <p style="color: #666; font-size: 14px; text-align: center; margin-top: 30px;">
              Test completed at: ${new Date().toISOString()}
            </p>
          </div>
        </div>
      `,
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