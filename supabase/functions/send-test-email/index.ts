import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TestEmailRequest {
  to_email: string;
  subject: string;
  message: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    const requestData: TestEmailRequest = await req.json();
    console.log('Test email request:', requestData);

    const { to_email, subject, message } = requestData;

    // Log the email details (in production, integrate with email service like Resend)
    console.log(`Test email would be sent to: ${to_email}`);
    console.log(`Subject: ${subject}`);
    console.log(`Message: ${message}`);

    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Test email prepared successfully',
        recipient: to_email
      }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in send-test-email function:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Failed to process test email', 
        details: error.message 
      }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
};

serve(handler);