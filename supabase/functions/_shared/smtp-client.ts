interface SMTPConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
}

interface EmailAttachment {
  filename: string;
  content: Uint8Array;
  contentType: string;
}

export class SMTPClient {
  private config: SMTPConfig;

  constructor(config: SMTPConfig) {
    this.config = config;
  }

  static async fromDatabase(): Promise<SMTPClient> {
    try {
      // Import Supabase client with service role
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (!supabaseUrl || !supabaseServiceKey) {
        console.warn('Missing Supabase configuration, falling back to environment variables');
        return SMTPClient.fromEnv();
      }
      
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      // Fetch active SMTP configuration from database
      const { data, error } = await supabase
        .from('smtp_configs')
        .select('*')
        .eq('is_active', true)
        .single();
      
      if (error || !data) {
        console.warn('No active SMTP configuration found in database, falling back to environment variables');
        return SMTPClient.fromEnv();
      }
      
      console.log('Using SMTP configuration from database');
      return new SMTPClient({
        host: data.host,
        port: data.port,
        username: data.username,
        password: data.password, // Note: In production, this should be decrypted
        fromEmail: data.from_email,
        fromName: data.from_name,
      });
      
    } catch (error) {
      console.warn('Failed to load SMTP config from database:', error.message);
      console.warn('Falling back to environment variables');
      return SMTPClient.fromEnv();
    }
  }

  static fromEnv(): SMTPClient {
    const host = Deno.env.get('SMTP_HOST');
    const port = parseInt(Deno.env.get('SMTP_PORT') || '587');
    const username = Deno.env.get('SMTP_USER');
    const password = Deno.env.get('SMTP_PASSWORD');
    const fromEmail = Deno.env.get('SMTP_FROM_EMAIL');
    const fromName = Deno.env.get('SMTP_FROM_NAME') || 'Growth OS';

    if (!host || !username || !password || !fromEmail) {
      throw new Error('Missing required SMTP configuration');
    }

    return new SMTPClient({
      host,
      port,
      username,
      password,
      fromEmail,
      fromName,
    });
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    const { to, subject, html, text, attachments } = options;
    let conn: Deno.TcpConn | null = null;
    let tlsConn: Deno.TlsConn | null = null;

    try {
      console.log(`Attempting to send email to: ${to}`);
      
      // Create SMTP connection with timeout
      conn = await Promise.race([
        Deno.connect({
          hostname: this.config.host,
          port: this.config.port,
        }),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 10000)
        )
      ]);

      console.log('SMTP connection established');

      // Convert connection to TLS if needed
      if (this.config.port === 587 || this.config.port === 465) {
        tlsConn = await Deno.startTls(conn, { hostname: this.config.host });
        console.log('TLS connection established');
      } else {
        tlsConn = conn as any;
      }

      const reader = tlsConn.readable.getReader();
      const writer = tlsConn.writable.getWriter();

      // Helper function to read SMTP response with timeout
      const readResponse = async (): Promise<string> => {
        const decoder = new TextDecoder();
        const timeout = setTimeout(() => {
          throw new Error('SMTP response timeout');
        }, 5000);

        try {
          const chunk = await reader.read();
          clearTimeout(timeout);
          if (chunk.value) {
            const response = decoder.decode(chunk.value);
            console.log('SMTP Response:', response.trim());
            return response;
          }
          return '';
        } catch (error) {
          clearTimeout(timeout);
          throw error;
        }
      };

      // Helper function to send SMTP command
      const sendCommand = async (command: string) => {
        const encoder = new TextEncoder();
        console.log('SMTP Command:', command.replace(/^AUTH LOGIN$|^[A-Za-z0-9+/=]+$/, '[REDACTED]'));
        await writer.write(encoder.encode(command + '\r\n'));
      };

      // SMTP conversation with error checking
      const welcomeResponse = await readResponse();
      if (!welcomeResponse.startsWith('220')) {
        throw new Error(`SMTP server rejected connection: ${welcomeResponse}`);
      }

      await sendCommand(`EHLO ${this.config.host}`);
      const ehloResponse = await readResponse();
      if (!ehloResponse.startsWith('250')) {
        throw new Error(`EHLO failed: ${ehloResponse}`);
      }

      // Start TLS if on port 587
      if (this.config.port === 587) {
        await sendCommand('STARTTLS');
        const tlsResponse = await readResponse();
        if (!tlsResponse.startsWith('220')) {
          throw new Error(`STARTTLS failed: ${tlsResponse}`);
        }
      }

      // Authentication
      await sendCommand('AUTH LOGIN');
      const authResponse = await readResponse();
      if (!authResponse.startsWith('334')) {
        throw new Error(`AUTH LOGIN failed: ${authResponse}`);
      }

      await sendCommand(btoa(this.config.username));
      const userResponse = await readResponse();
      if (!userResponse.startsWith('334')) {
        throw new Error(`Username authentication failed: ${userResponse}`);
      }

      await sendCommand(btoa(this.config.password));
      const passResponse = await readResponse();
      if (!passResponse.startsWith('235')) {
        throw new Error(`Password authentication failed: ${passResponse}`);
      }

      // Send email
      await sendCommand(`MAIL FROM:<${this.config.fromEmail}>`);
      const mailResponse = await readResponse();
      if (!mailResponse.startsWith('250')) {
        throw new Error(`MAIL FROM failed: ${mailResponse}`);
      }

      await sendCommand(`RCPT TO:<${to}>`);
      const rcptResponse = await readResponse();
      if (!rcptResponse.startsWith('250')) {
        throw new Error(`RCPT TO failed: ${rcptResponse}`);
      }

      await sendCommand('DATA');
      const dataResponse = await readResponse();
      if (!dataResponse.startsWith('354')) {
        throw new Error(`DATA command failed: ${dataResponse}`);
      }

      // Email headers and body
      const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      const messageId = `<${Date.now()}.${Math.random().toString(36).substring(2)}@${this.config.fromEmail.split('@')[1]}>`;
      
      let emailContent: string;
      
      if (attachments && attachments.length > 0) {
        console.log(`Preparing email with ${attachments.length} attachments`);
        // Multipart email with attachments
        const emailParts = [
          `From: ${this.config.fromName} <${this.config.fromEmail}>`,
          `To: ${to}`,
          `Subject: ${subject}`,
          `Message-ID: ${messageId}`,
          `Date: ${new Date().toUTCString()}`,
          'MIME-Version: 1.0',
          `Content-Type: multipart/mixed; boundary="${boundary}"`,
          `X-Mailer: Growth OS`,
          `X-Priority: 3`,
          '',
          `--${boundary}`,
          'Content-Type: text/html; charset=utf-8',
          'Content-Transfer-Encoding: 8bit',
          '',
          html,
          ''
        ];

        // Add attachments
        for (const attachment of attachments) {
          const base64Content = btoa(String.fromCharCode(...attachment.content));
          emailParts.push(
            `--${boundary}`,
            `Content-Type: ${attachment.contentType}`,
            'Content-Transfer-Encoding: base64',
            `Content-Disposition: attachment; filename="${attachment.filename}"`,
            '',
            base64Content,
            ''
          );
        }

        emailParts.push(`--${boundary}--`);
        emailContent = emailParts.join('\r\n');
      } else {
        // Simple HTML email
        emailContent = [
          `From: ${this.config.fromName} <${this.config.fromEmail}>`,
          `To: ${to}`,
          `Subject: ${subject}`,
          `Message-ID: ${messageId}`,
          `Date: ${new Date().toUTCString()}`,
          'MIME-Version: 1.0',
          'Content-Type: text/html; charset=utf-8',
          'Content-Transfer-Encoding: 8bit',
          `X-Mailer: Growth OS`,
          `X-Priority: 3`,
          '',
          html,
        ].join('\r\n');
      }

      await sendCommand(emailContent);
      await sendCommand('.');
      const sendResponse = await readResponse();
      if (!sendResponse.startsWith('250')) {
        throw new Error(`Email sending failed: ${sendResponse}`);
      }

      await sendCommand('QUIT');
      await readResponse();

      console.log(`Email sent successfully via SMTP to: ${to}`);

    } catch (error) {
      console.error('SMTP Error:', error);
      throw new Error(`Failed to send email to ${to}: ${error.message}`);
    } finally {
      // Clean up connections in reverse order
      try {
        if (tlsConn && tlsConn !== conn) {
          tlsConn.close();
        }
      } catch (e) {
        console.warn('Error closing TLS connection:', e.message);
      }
      
      try {
        if (conn) {
          conn.close();
        }
      } catch (e) {
        console.warn('Error closing TCP connection:', e.message);
      }
    }
  }
}