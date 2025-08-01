import { sendWithPurpose, MissingSMTPConfigError } from './mail';
import { supabase } from '@/integrations/supabase/client';

interface EmailEvent {
  type: string;
  data: any;
}

interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  smtpConfigRetryDelay: number;
}

const RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 300000, // 5 minutes
  smtpConfigRetryDelay: 3600000, // 1 hour
};

export class EmailAutomation {
  static async handleEvent(event: EmailEvent): Promise<void> {
    switch (event.type) {
      case 'student.created':
        await this.handleStudentCreated(event.data);
        break;
      case 'staff.created':
        await this.handleStaffCreated(event.data);
        break;
      case 'invoice.created':
        if (event.data.recipient_type === 'student') {
          await this.handleInvoiceCreated(event.data);
        }
        break;
    }
  }

  private static async handleStudentCreated(data: any): Promise<void> {
    await this.sendEmailWithRetry({
      purpose: 'lms',
      to: data.email,
      subject: 'Welcome to the LMS',
      template: 'student-welcome',
      data,
      eventType: 'student.created'
    });
  }

  private static async handleStaffCreated(data: any): Promise<void> {
    await this.sendEmailWithRetry({
      purpose: 'lms',
      to: data.email,
      subject: 'Your LMS Login Details',
      template: 'staff-welcome',
      data,
      eventType: 'staff.created'
    });
  }

  private static async handleInvoiceCreated(data: any): Promise<void> {
    await this.sendEmailWithRetry({
      purpose: 'billing',
      to: data.recipient_email,
      subject: `Invoice #${data.invoice_number}`,
      template: 'student-invoice',
      data,
      eventType: 'invoice.created'
    });
  }

  private static async sendEmailWithRetry(params: {
    purpose: 'lms' | 'billing';
    to: string;
    subject: string;
    template: string;
    data: any;
    eventType: string;
    attempt?: number;
  }): Promise<void> {
    const attempt = params.attempt || 1;

    try {
      await sendWithPurpose(params.purpose, {
        to: params.to,
        subject: params.subject,
        html: await this.renderTemplate(params.template, params.data)
      });

      await this.logAuditEvent({
        event_type: 'mail.sent',
        purpose: params.purpose,
        to: params.to,
        template: params.template,
        status: 'success',
        attempt,
        trigger_event: params.eventType
      });

    } catch (error) {
      await this.logAuditEvent({
        event_type: 'mail.failed',
        purpose: params.purpose,
        to: params.to,
        template: params.template,
        status: 'failed',
        attempt,
        error_type: error instanceof MissingSMTPConfigError ? 'missing_config' : 'smtp_error',
        error_message: error.message,
        trigger_event: params.eventType
      });

      if (attempt < RETRY_CONFIG.maxAttempts) {
        const delay = error instanceof MissingSMTPConfigError 
          ? RETRY_CONFIG.smtpConfigRetryDelay
          : RETRY_CONFIG.initialDelay * Math.pow(3, attempt - 1); // exponential backoff

        setTimeout(() => {
          this.sendEmailWithRetry({ ...params, attempt: attempt + 1 });
        }, delay);

        await this.logAuditEvent({
          event_type: 'mail.retry',
          purpose: params.purpose,
          to: params.to,
          template: params.template,
          status: 'retry_scheduled',
          attempt: attempt + 1,
          delay_ms: delay,
          trigger_event: params.eventType
        });
      }
    }
  }

  private static async renderTemplate(template: string, data: any): Promise<string> {
    // Simple template rendering - replace {{variable}} with data.variable
    try {
      const response = await fetch(`/src/templates/email/${template}.html`);
      let html = await response.text();
      
      // Replace placeholders
      Object.keys(data).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        html = html.replace(regex, data[key] || '');
      });
      
      return html;
    } catch (error) {
      // Fallback basic template
      return `
        <h1>Notification</h1>
        <p>Email content for ${template}</p>
        <pre>${JSON.stringify(data, null, 2)}</pre>
      `;
    }
  }

  private static async logAuditEvent(params: {
    event_type: string;
    purpose: string;
    to: string;
    template: string;
    status: string;
    attempt: number;
    trigger_event: string;
    error_type?: string;
    error_message?: string;
    delay_ms?: number;
  }): Promise<void> {
    try {
      await supabase.from('admin_logs').insert({
        entity_type: 'email_automation',
        action: params.event_type,
        description: `Email ${params.status}: ${params.template} to ${params.to}`,
        data: {
          purpose: params.purpose,
          to: params.to,
          template: params.template,
          status: params.status,
          attempt: params.attempt,
          trigger_event: params.trigger_event,
          error_type: params.error_type,
          error_message: params.error_message,
          delay_ms: params.delay_ms
        }
      });
    } catch (error) {
      console.error('Failed to log audit event:', error);
    }
  }
}