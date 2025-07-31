import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OnboardingJob {
  id: string;
  student_id: string;
  step: 'EMAIL' | 'INVOICE';
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'RETRY';
  retries: number;
  last_error?: string;
  metadata: any;
}

interface StudentData {
  id: string;
  email: string;
  full_name: string;
  temp_password?: string;
  student_id?: string;
  fees_structure?: string;
}

interface CompanySettings {
  company_name: string;
  lms_from_email: string;
  lms_from_name: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
  smtp_use_tls: boolean;
  original_fee_amount: number;
  invoice_from_email: string;
  invoice_from_name: string;
}

// Exponential backoff delays: 0s, 30s, 2m, 10m, 30m
const RETRY_DELAYS = [0, 30, 120, 600, 1800];
const MAX_RETRIES = 5;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting onboarding job processor...');
    
    // Fetch pending/retry jobs
    const { data: jobs, error: jobsError } = await supabase
      .from('student_onboarding_jobs')
      .select('*')
      .in('status', ['PENDING', 'RETRY'])
      .order('created_at', { ascending: true })
      .limit(10);

    if (jobsError) {
      throw new Error(`Failed to fetch jobs: ${jobsError.message}`);
    }

    if (!jobs || jobs.length === 0) {
      console.log('No pending jobs found');
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing ${jobs.length} jobs`);
    
    // Fetch company settings once
    const { data: settings, error: settingsError } = await supabase
      .from('company_settings')
      .select('*')
      .single();

    if (settingsError || !settings) {
      throw new Error('Company settings not found');
    }

    let processed = 0;
    
    for (const job of jobs) {
      try {
        await processJob(job, settings);
        processed++;
      } catch (error) {
        console.error(`Failed to process job ${job.id}:`, error);
        await markJobFailed(job.id, error.message);
      }
    }

    return new Response(JSON.stringify({ processed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Handler error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

async function processJob(job: OnboardingJob, settings: CompanySettings) {
  console.log(`Processing ${job.step} job for student ${job.student_id}`);
  
  // Check if we should retry (respect exponential backoff)
  if (job.status === 'RETRY' && job.retries > 0) {
    const lastUpdated = new Date(job.metadata?.last_retry || job.created_at);
    const nextRetryTime = new Date(lastUpdated.getTime() + (RETRY_DELAYS[job.retries] * 1000));
    
    if (new Date() < nextRetryTime) {
      console.log(`Job ${job.id} not ready for retry yet`);
      return;
    }
  }

  // Fetch student data
  const { data: student, error: studentError } = await supabase
    .from('users')
    .select('id, email, full_name, temp_password, student_id, fees_structure')
    .eq('id', job.student_id)
    .single();

  if (studentError || !student) {
    throw new Error(`Student not found: ${studentError?.message}`);
  }

  try {
    if (job.step === 'EMAIL') {
      await processEmailJob(job, student, settings);
    } else if (job.step === 'INVOICE') {
      await processInvoiceJob(job, student, settings);
    }
    
    // Mark as success
    await supabase
      .from('student_onboarding_jobs')
      .update({ 
        status: 'SUCCESS', 
        last_error: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', job.id);
      
    console.log(`Job ${job.id} completed successfully`);
    
  } catch (error) {
    console.error(`Job ${job.id} failed:`, error);
    
    const newRetries = job.retries + 1;
    
    if (newRetries >= MAX_RETRIES) {
      // Final failure
      await supabase
        .from('student_onboarding_jobs')
        .update({ 
          status: 'FAILED', 
          last_error: error.message,
          retries: newRetries,
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id);
        
      // TODO: Send Slack/webhook alert here
      console.error(`Job ${job.id} failed permanently after ${MAX_RETRIES} retries`);
    } else {
      // Schedule retry
      await supabase
        .from('student_onboarding_jobs')
        .update({ 
          status: 'RETRY', 
          last_error: error.message,
          retries: newRetries,
          metadata: { 
            ...job.metadata, 
            last_retry: new Date().toISOString() 
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id);
        
      console.log(`Job ${job.id} scheduled for retry ${newRetries}/${MAX_RETRIES}`);
    }
  }
}

async function processEmailJob(job: OnboardingJob, student: StudentData, settings: CompanySettings) {
  // Validate SMTP settings
  if (!settings.smtp_host || !settings.smtp_user || !settings.smtp_password) {
    throw new Error('SMTP settings not configured in company settings');
  }

  if (!student.temp_password) {
    throw new Error('Student has no temporary password');
  }

  // Initialize SMTP client
  const client = new SMTPClient({
    connection: {
      hostname: settings.smtp_host,
      port: settings.smtp_port || 587,
      tls: settings.smtp_use_tls !== false,
      auth: {
        username: settings.smtp_user,
        password: settings.smtp_password,
      },
    },
  });

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333;">Welcome to ${settings.company_name || 'LMS'}!</h1>
      <p>Dear ${student.full_name},</p>
      <p>Your student account has been created successfully. Here are your login credentials:</p>
      <div style="background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Student ID:</strong> ${student.student_id}</p>
        <p><strong>Email:</strong> ${student.email}</p>
        <p><strong>Temporary Password:</strong> ${student.temp_password}</p>
      </div>
      <p>Please log in to the LMS and change your password on your first visit.</p>
      <p>If you have any questions, please don't hesitate to contact us.</p>
      <p>Best regards,<br>The ${settings.company_name || 'LMS'} Team</p>
    </div>
  `;

  try {
    await client.send({
      from: settings.lms_from_email || settings.smtp_user,
      to: student.email,
      subject: `Welcome to ${settings.company_name || 'LMS'} - Your Login Credentials`,
      content: emailHtml,
      html: emailHtml,
    });

    await client.close();
    console.log(`Welcome email sent to ${student.email} via SMTP`);
  } catch (error) {
    await client.close();
    throw new Error(`SMTP email send failed: ${error.message}`);
  }
}

async function processInvoiceJob(job: OnboardingJob, student: StudentData, settings: CompanySettings) {
  // Generate and send invoice
  const { data, error } = await supabase.functions.invoke('send-invoice-email', {
    body: {
      student_id: student.id,
      student_email: student.email,
      student_name: student.full_name,
      student_phone: '', // Add if available
      installment_number: 1,
      amount: settings.original_fee_amount,
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
    }
  });

  if (error || data?.error) {
    throw new Error(`Invoice generation failed: ${data?.error || error?.message}`);
  }

  console.log(`Invoice sent to ${student.email}`);
}

async function markJobFailed(jobId: string, error: string) {
  await supabase
    .from('student_onboarding_jobs')
    .update({ 
      status: 'FAILED', 
      last_error: error,
      updated_at: new Date().toISOString()
    })
    .eq('id', jobId);
}

serve(handler);