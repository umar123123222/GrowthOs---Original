import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InvoiceEmailRequest {
  student_id: string;
  installment_number: number;
  amount: number;
  due_date: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { student_id, installment_number, amount, due_date }: InvoiceEmailRequest = await req.json();

    // Get student data
    const { data: studentData, error: studentError } = await supabase
      .from('users')
      .select('full_name, email, student_id')
      .eq('id', student_id)
      .single();

    if (studentError || !studentData) {
      throw new Error('Student not found');
    }

    // Use Supabase environment variables for SMTP configuration
    const smtpHost = Deno.env.get('SMTP_HOST');
    const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '587');
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPassword = Deno.env.get('SMTP_PASSWORD');
    const smtpFromEmail = Deno.env.get('SMTP_FROM_EMAIL');
    const smtpFromName = Deno.env.get('SMTP_FROM_NAME') || 'System';

    if (!smtpHost || !smtpUser || !smtpPassword || !smtpFromEmail) {
      throw new Error('SMTP configuration is incomplete');
    }

    // Initialize SMTP client
    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: smtpPort === 465, // Use TLS for port 465 (SSL)
        auth: {
          username: smtpUser,
          password: smtpPassword,
        },
      },
    });

    await client.send({
      from: smtpFromEmail,
      fromName: smtpFromName,
      to: studentData.email,
      subject: `Invoice for Installment ${installment_number} - ${studentData.student_id}`,
      content: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
            .invoice-container { max-width: 800px; margin: 0 auto; background: white; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #3b82f6, #8b5cf6, #a855f7); padding: 40px; color: white; position: relative; }
            .logo { position: absolute; left: 40px; top: 50%; transform: translateY(-50%); display: flex; gap: -8px; }
            .circle { width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.25); }
            .invoice-title { text-align: right; font-size: 32px; font-weight: bold; letter-spacing: 2px; }
            .invoice-details { padding: 40px; }
            .details-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 40px; margin-bottom: 40px; }
            .invoice-to h3, .total-due h3 { font-size: 12px; color: #666; margin-bottom: 8px; }
            .student-name { font-size: 20px; font-weight: bold; margin-bottom: 4px; }
            .divider { height: 2px; width: 40px; background: #333; margin-bottom: 8px; }
            .table-container { margin-bottom: 40px; border: 1px solid #ddd; }
            .table-header { background: linear-gradient(135deg, #3b82f6, #8b5cf6, #a855f7); color: white; padding: 16px; display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; font-weight: bold; }
            .table-row { padding: 16px; display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; border-bottom: 1px solid #eee; }
            .table-row:nth-child(even) { background: #f9f9f9; }
            .footer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
            .totals { text-align: right; }
            .total-line { display: flex; justify-content: space-between; margin-bottom: 8px; }
            .total-final { background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; padding: 12px; border-radius: 4px; font-weight: bold; }
            .terms { margin-top: 60px; }
            .signature-section { text-align: right; margin-top: 60px; }
            .company-footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="invoice-container">
            <div class="header">
              <div class="logo">
                <div class="circle"></div>
                <div class="circle"></div>
                <div class="circle"></div>
              </div>
              <div class="invoice-title">INVOICE</div>
            </div>
            
            <div class="invoice-details">
              <div class="details-grid">
                <div class="invoice-to">
                  <h3>INVOICE TO:</h3>
                  <div class="student-name">${studentData.full_name}</div>
                  <div class="divider"></div>
                  <div style="font-size: 14px; color: #666;">${studentData.email}</div>
                </div>
                
                <div style="text-align: center;">
                  <div style="margin-bottom: 8px;">
                    <strong>Invoice #</strong><br>
                    INV-${studentData.student_id}-${installment_number.toString().padStart(2, '0')}
                  </div>
                  <div style="margin-bottom: 8px;">
                    <strong>Date:</strong><br>
                    ${new Date().toLocaleDateString()}
                  </div>
                </div>
                
                <div class="total-due" style="text-align: right;">
                  <h3>TOTAL DUE</h3>
                  <div style="font-size: 32px; font-weight: bold; color: #333;">$${amount.toFixed(2)}</div>
                  <div style="color: #666; font-size: 14px;">Due: ${new Date(due_date).toLocaleDateString()}</div>
                </div>
              </div>
              
              <div class="table-container">
                <div class="table-header">
                  <div>DESCRIPTION</div>
                  <div>QTY</div>
                  <div>RATE</div>
                  <div>AMOUNT</div>
                </div>
                <div class="table-row">
                  <div>Course Fee - Installment ${installment_number}</div>
                  <div>1</div>
                  <div>$${amount.toFixed(2)}</div>
                  <div>$${amount.toFixed(2)}</div>
                </div>
              </div>
              
              <div class="footer-grid">
                <div class="terms">
                  <h4 style="margin-bottom: 16px; color: #333;">Terms & Conditions</h4>
                  <ul style="margin: 0; padding-left: 20px; color: #666; font-size: 14px; line-height: 1.6;">
                    <li>Payment is due within 30 days of invoice date</li>
                    <li>Late payments may incur additional charges</li>
                    <li>All payments are non-refundable</li>
                    <li>Please retain this invoice for your records</li>
                  </ul>
                </div>
                
                <div class="totals">
                  <div class="total-line">
                    <span>Subtotal:</span>
                    <span>$${amount.toFixed(2)}</span>
                  </div>
                  <div class="total-line">
                    <span>Tax (0%):</span>
                    <span>$0.00</span>
                  </div>
                  <div class="total-final">
                    <div style="display: flex; justify-content: space-between;">
                      <span>TOTAL:</span>
                      <span>$${amount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="signature-section">
                <div style="margin-bottom: 40px;">
                  <div style="width: 200px; border-bottom: 1px solid #333; margin-left: auto; margin-bottom: 8px;"></div>
                  <div style="font-size: 14px; color: #666;">Authorized Signature</div>
                </div>
              </div>
            </div>
            
            <div class="company-footer">
              <p>Thank you for your business!</p>
              <p>This is an automated invoice. Please contact us if you have any questions.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      html: true,
    });

    await client.close();

    return new Response(
      JSON.stringify({ success: true, message: 'Invoice email sent successfully' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );

  } catch (error) {
    console.error('Error in send-invoice-email:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);