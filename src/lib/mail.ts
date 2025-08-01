import { supabase } from '@/integrations/supabase/client';

export class MissingSMTPConfigError extends Error {
  constructor(purpose: string) {
    super(`SMTP configuration missing for purpose: ${purpose}`);
    this.name = 'MissingSMTPConfigError';
  }
}

interface SMTPConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  secure: boolean;
  from_address: string;
}

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
}

// In-memory cache for SMTP configurations
const smtpConfigCache = new Map<string, SMTPConfig>();

async function fetchSMTPConfig(purpose: 'lms' | 'billing'): Promise<SMTPConfig> {
  // Check cache first
  if (smtpConfigCache.has(purpose)) {
    return smtpConfigCache.get(purpose)!;
  }

  // Temporary: Always throw error until migration is applied and types regenerated
  // Once the smtp_configs table exists and types are updated, this will be replaced with:
  // const { data, error } = await supabase.from('smtp_configs').select('*').eq('purpose', purpose).single();
  throw new MissingSMTPConfigError(purpose);
}

export async function sendWithPurpose(
  purpose: 'lms' | 'billing',
  options: EmailOptions
): Promise<void> {
  try {
    const config = await fetchSMTPConfig(purpose);

    // Use the SMTP config's from_address unless explicitly overridden
    const emailData = {
      ...options,
      from: options.from || config.from_address,
    };

    // Call the send-test-email edge function with SMTP config and email data
    const { data, error } = await supabase.functions.invoke('send-test-email', {
      body: {
        smtp_config: config,
        email_data: emailData,
      },
    });

    if (error) {
      throw new Error(`Failed to send email: ${error.message}`);
    }

    if (!data?.success) {
      throw new Error(data?.error || 'Failed to send email');
    }
  } catch (error) {
    console.error(`Error sending email with purpose ${purpose}:`, error);
    throw error;
  }
}

// Clear cache when SMTP config is updated
export function clearSMTPConfigCache(purpose?: string) {
  if (purpose) {
    smtpConfigCache.delete(purpose);
  } else {
    smtpConfigCache.clear();
  }
}