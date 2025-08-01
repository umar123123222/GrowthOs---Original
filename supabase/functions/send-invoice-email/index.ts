import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface InvoiceEmailRequest {
  student_data: {
    full_name: string;
    email: string;
    student_id: string;
  };
  installment_number: number;
  amount: number;
  due_date: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request body
    const requestData: InvoiceEmailRequest = await req.json();
    console.log('Invoice email request:', requestData);

    const { student_data, installment_number, amount, due_date } = requestData;

    // Get student data from database if not provided directly
    let studentInfo = student_data;
    if (!studentInfo && requestData.student_data?.student_id) {
      const { data: student, error: studentError } = await supabaseClient
        .from('users')
        .select('full_name, email, student_id')
        .eq('student_id', requestData.student_data.student_id)
        .single();

      if (studentError) {
        throw new Error(`Failed to fetch student data: ${studentError.message}`);
      }

      studentInfo = student;
    }

    // Get company settings for branding
    const { data: companySettings } = await supabaseClient
      .from('company_settings')
      .select('company_name, company_email, currency')
      .single();

    // Generate invoice HTML content
    const invoiceHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
            .invoice-header { text-align: center; margin-bottom: 30px; }
            .invoice-details { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
            .amount { font-size: 24px; font-weight: bold; color: #2563eb; }
            .footer { margin-top: 30px; text-align: center; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="invoice-header">
            <h1>${companySettings?.company_name || 'Company'}</h1>
            <h2>Invoice #INV-${studentInfo.student_id}-${installment_number}</h2>
          </div>
          
          <div class="invoice-details">
            <h3>Student Information</h3>
            <p><strong>Name:</strong> ${studentInfo.full_name}</p>
            <p><strong>Student ID:</strong> ${studentInfo.student_id}</p>
            <p><strong>Email:</strong> ${studentInfo.email}</p>
          </div>
          
          <div class="invoice-details">
            <h3>Payment Details</h3>
            <p><strong>Installment:</strong> ${installment_number}</p>
            <p><strong>Amount Due:</strong> <span class="amount">${companySettings?.currency || 'USD'} ${amount}</span></p>
            <p><strong>Due Date:</strong> ${new Date(due_date).toLocaleDateString()}</p>
          </div>
          
          <div class="footer">
            <p>Please make your payment by the due date to avoid any late fees.</p>
            <p>For any questions, contact us at ${companySettings?.company_email || 'support@company.com'}</p>
          </div>
        </body>
      </html>
    `;

    // Use Supabase's built-in auth email sending (note: this is a placeholder - 
    // in production you would use a proper email service like Resend)
    console.log('Invoice email would be sent to:', studentInfo.email);
    console.log('Email content generated successfully');

    // For now, we'll return success since the SMTP removal means 
    // emails should be handled by external services like Resend
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Invoice email prepared successfully',
        recipient: studentInfo.email,
        invoice_number: `INV-${studentInfo.student_id}-${installment_number}`
      }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in send-invoice-email function:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Failed to process invoice email', 
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