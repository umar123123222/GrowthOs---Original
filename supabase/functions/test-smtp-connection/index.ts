import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

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

    // Simple connection test - just try to connect to the SMTP server
    try {
      const conn = await Deno.connect({
        hostname: trimmedHost,
        port: body.smtp_port,
      });

      // Read initial server response
      const buffer = new Uint8Array(1024);
      const n = await conn.read(buffer);
      const response = new TextDecoder().decode(buffer.subarray(0, n || 0));
      
      console.log("Server response:", response);
      
      conn.close();

      // Check if we got a valid SMTP greeting
      if (response.startsWith('220')) {
        console.log("SMTP connection test successful");
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "SMTP connection successful! Server is reachable and responding." 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        throw new Error(`Invalid SMTP response: ${response}`);
      }
    } catch (error) {
      console.error("Connection test failed:", error);
      throw new Error(`Cannot connect to ${trimmedHost}:${body.smtp_port} - ${error.message}`);
    }

  } catch (error: any) {
    console.error("SMTP test failed:", error);
    
    // Provide helpful error messages
    let errorMessage = error.message;
    
    if (error.message.includes("connection refused")) {
      errorMessage = "Connection refused. Please check the host and port settings.";
    } else if (error.message.includes("timeout")) {
      errorMessage = "Connection timeout. Please check your network and firewall settings.";
    } else if (error.message.includes("DNS")) {
      errorMessage = "DNS resolution failed. Please check the SMTP host address.";
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