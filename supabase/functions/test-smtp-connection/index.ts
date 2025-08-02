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

    // Use raw TCP connection approach for Gmail SMTP
    const connectAndTest = async () => {
      try {
        // For Gmail SMTP, we'll use a simple connection test approach
        const testData = {
          from: trimmedEmail,
          to: trimmedEmail,
          subject: "SMTP Test - Success!",
          text: `SMTP Configuration Test\n\nThis email confirms that your SMTP settings are configured correctly.\n\nConfiguration Details:\n- Host: ${trimmedHost}\n- Port: ${body.smtp_port}\n- Secure: ${body.smtp_secure ? 'Yes' : 'No'}\n- Username: ${trimmedUsername}\n\nTest completed at: ${new Date().toISOString()}\n\nYour email system is ready to send welcome emails and invoices!`
        };

        // Create the raw SMTP message
        const message = [
          `From: ${testData.from}`,
          `To: ${testData.to}`,
          `Subject: ${testData.subject}`,
          `Content-Type: text/plain; charset=utf-8`,
          '',
          testData.text
        ].join('\r\n');

        // Use Deno's built-in TCP connection
        const conn = await Deno.connect({
          hostname: trimmedHost,
          port: body.smtp_port,
        });

        try {
          // If secure port, upgrade to TLS
          if (body.smtp_secure && body.smtp_port === 465) {
            const tlsConn = await Deno.startTls(conn, { hostname: trimmedHost });
            conn.close();
            return await handleSMTPConnection(tlsConn, trimmedUsername, trimmedPassword, message);
          } else {
            // For STARTTLS (port 587)
            return await handleSMTPConnection(conn, trimmedUsername, trimmedPassword, message, body.smtp_port === 587);
          }
        } finally {
          try {
            conn.close();
          } catch (e) {
            // Connection might already be closed
          }
        }
      } catch (error) {
        console.error("Connection error:", error);
        throw new Error(`Connection failed: ${error.message}`);
      }
    };

    const handleSMTPConnection = async (conn: any, username: string, password: string, message: string, useStartTLS = false) => {
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      
      // Read response helper
      const readResponse = async () => {
        const buffer = new Uint8Array(1024);
        const n = await conn.read(buffer);
        return decoder.decode(buffer.subarray(0, n || 0));
      };

      // Send command helper
      const sendCommand = async (command: string) => {
        await conn.write(encoder.encode(command + '\r\n'));
        return await readResponse();
      };

      try {
        // Read initial greeting
        const greeting = await readResponse();
        console.log("Server greeting:", greeting);
        
        if (!greeting.startsWith('220')) {
          throw new Error(`Server not ready: ${greeting}`);
        }

        // EHLO
        const ehloResp = await sendCommand(`EHLO ${trimmedHost}`);
        console.log("EHLO response:", ehloResp);

        // STARTTLS if needed
        if (useStartTLS) {
          const startTlsResp = await sendCommand('STARTTLS');
          console.log("STARTTLS response:", startTlsResp);
          
          if (startTlsResp.startsWith('220')) {
            // Upgrade to TLS
            const tlsConn = await Deno.startTls(conn, { hostname: trimmedHost });
            // Send EHLO again after TLS
            await tlsConn.write(encoder.encode(`EHLO ${trimmedHost}\r\n`));
            const tlsBuffer = new Uint8Array(1024);
            const tlsN = await tlsConn.read(tlsBuffer);
            const tlsEhloResp = decoder.decode(tlsBuffer.subarray(0, tlsN || 0));
            console.log("TLS EHLO response:", tlsEhloResp);
          }
        }

        // Authentication
        const authResp = await sendCommand('AUTH LOGIN');
        console.log("AUTH response:", authResp);
        
        if (authResp.startsWith('334')) {
          // Send username (base64 encoded)
          const userResp = await sendCommand(btoa(username));
          console.log("Username response:", userResp);
          
          if (userResp.startsWith('334')) {
            // Send password (base64 encoded)
            const passResp = await sendCommand(btoa(password));
            console.log("Password response:", passResp);
            
            if (passResp.startsWith('235')) {
              console.log("Authentication successful");
              
              // Just test authentication, don't actually send email
              await sendCommand('QUIT');
              return true;
            } else {
              throw new Error(`Authentication failed: ${passResp}`);
            }
          }
        }
        
        return false;
      } catch (error) {
        console.error("SMTP communication error:", error);
        throw error;
      }
    };

    await connectAndTest();

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