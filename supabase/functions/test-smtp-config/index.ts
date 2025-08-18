import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { SMTPClient } from "../_shared/smtp-client.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('Test SMTP configuration triggered');

  try {
    const { smtp_config, test_email } = await req.json();
    
    if (!smtp_config || !test_email) {
      return new Response(
        JSON.stringify({ error: 'Missing smtp_config or test_email' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Create SMTP client with provided configuration
    const smtpClient = new SMTPClient({
      host: smtp_config.host,
      port: smtp_config.port,
      username: smtp_config.username,
      password: smtp_config.password,
      fromEmail: smtp_config.from_email,
      fromName: smtp_config.from_name,
    });

    // Send test email
    await smtpClient.sendEmail({
      to: test_email,
      subject: 'SMTP Configuration Test',
      html: `
        <h1>SMTP Test Successful!</h1>
        <p>Your SMTP configuration is working correctly.</p>
        <p><strong>Server:</strong> ${smtp_config.host}:${smtp_config.port}</p>
        <p><strong>From:</strong> ${smtp_config.from_name} &lt;${smtp_config.from_email}&gt;</p>
        <p><strong>Test sent at:</strong> ${new Date().toISOString()}</p>
        <hr>
        <p><small>This is an automated test email from your Growth OS system.</small></p>
      `,
    });

    console.log(`Test email sent successfully to: ${test_email}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Test email sent successfully',
        sent_to: test_email
      }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in test-smtp-config:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to send test email', 
        details: error.message 
      }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});