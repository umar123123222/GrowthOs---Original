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

    // Create SMTP connection
    const conn = await Deno.connect({
      hostname: this.config.host,
      port: this.config.port,
    });

    try {
      // Convert connection to TLS if needed
      let tlsConn = conn;
      if (this.config.port === 587 || this.config.port === 465) {
        tlsConn = await Deno.startTls(conn, { hostname: this.config.host });
      }

      const reader = tlsConn.readable.getReader();
      const writer = tlsConn.writable.getWriter();

      // Helper function to read SMTP response
      const readResponse = async () => {
        const decoder = new TextDecoder();
        const chunk = await reader.read();
        if (chunk.value) {
          return decoder.decode(chunk.value);
        }
        return '';
      };

      // Helper function to send SMTP command
      const sendCommand = async (command: string) => {
        const encoder = new TextEncoder();
        await writer.write(encoder.encode(command + '\r\n'));
      };

      // SMTP conversation
      await readResponse(); // Welcome message

      await sendCommand(`EHLO ${this.config.host}`);
      await readResponse();

      // Start TLS if on port 587
      if (this.config.port === 587) {
        await sendCommand('STARTTLS');
        await readResponse();
      }

      // Authentication
      await sendCommand('AUTH LOGIN');
      await readResponse();

      await sendCommand(btoa(this.config.username));
      await readResponse();

      await sendCommand(btoa(this.config.password));
      await readResponse();

      // Send email
      await sendCommand(`MAIL FROM:<${this.config.fromEmail}>`);
      await readResponse();

      await sendCommand(`RCPT TO:<${to}>`);
      await readResponse();

      await sendCommand('DATA');
      await readResponse();

      // Email headers and body
      const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      
      let emailContent: string;
      
      if (attachments && attachments.length > 0) {
        // Multipart email with attachments
        const emailParts = [
          `From: ${this.config.fromName} <${this.config.fromEmail}>`,
          `To: ${to}`,
          `Subject: ${subject}`,
          'MIME-Version: 1.0',
          `Content-Type: multipart/mixed; boundary="${boundary}"`,
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

        emailParts.push(`--${boundary}--`, '.');
        emailContent = emailParts.join('\r\n');
      } else {
        // Simple HTML email
        emailContent = [
          `From: ${this.config.fromName} <${this.config.fromEmail}>`,
          `To: ${to}`,
          `Subject: ${subject}`,
          'MIME-Version: 1.0',
          'Content-Type: text/html; charset=utf-8',
          '',
          html,
          '.',
        ].join('\r\n');
      }

      await sendCommand(emailContent);
      await readResponse();

      await sendCommand('QUIT');
      await readResponse();

    } finally {
      try {
        conn.close();
      } catch (e) {
        console.warn('Error closing SMTP connection:', e);
      }
    }
  }
}