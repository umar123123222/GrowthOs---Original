import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendInvoiceRequest {
  student_id: string;
  installment_number: number;
  amount: number;
  due_date: string;
  invoice_number?: string;
}

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Generate invoice HTML template
function generateInvoiceHTML(
  studentData: any,
  companyData: any,
  invoiceData: any
): string {
  const currentDate = new Date().toLocaleDateString();
  const invoiceNumber = invoiceData.invoice_number || `INV-${Date.now()}`;
  
  return `
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
                <span style="font-size: 14px; color: #666;">Date: </span>
                <span>${currentDate}</span>
              </div>
              <div>
                <span style="font-size: 14px; color: #666;">Invoice No: </span>
                <span>${invoiceNumber}</span>
              </div>
            </div>
            
            <div class="total-due">
              <h3>TOTAL DUE:</h3>
              <div style="font-size: 24px; font-weight: bold;">${companyData.currency || 'USD'}: $${invoiceData.amount.toLocaleString()}</div>
            </div>
          </div>
          
          <div class="table-container">
            <div class="table-header">
              <div>Description</div>
              <div style="text-align: center;">Installment Number</div>
              <div style="text-align: center;">Price</div>
              <div style="text-align: center;">Total</div>
            </div>
            <div class="table-row">
              <div>Course Fee - Installment ${invoiceData.installment_number}</div>
              <div style="text-align: center;">${invoiceData.installment_number}</div>
              <div style="text-align: center;">$${invoiceData.amount}</div>
              <div style="text-align: center; font-weight: bold;">$${invoiceData.amount}</div>
            </div>
          </div>
          
          <div class="footer-grid">
            <div>
              <h3 style="font-size: 18px; margin-bottom: 16px;">Payment Method</h3>
              <div style="font-size: 14px; color: #666; font-style: italic;">
                Please contact billing team for payment instructions:<br>
                Email: ${companyData.contact_email}<br>
                Phone: ${companyData.primary_phone}
              </div>
            </div>
            
            <div class="totals">
              <div class="total-line">
                <span>Sub-total:</span>
                <span>$${invoiceData.amount.toLocaleString()}</span>
              </div>
              <div class="total-line">
                <span>Tax:</span>
                <span>$0</span>
              </div>
              <div class="total-final">
                <div class="total-line" style="margin: 0;">
                  <span>Total:</span>
                  <span>$${invoiceData.amount.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div class="terms">
            <h3 style="font-size: 18px; margin-bottom: 16px;">Terms and Conditions</h3>
            <p style="font-size: 14px; color: #666; font-style: italic; line-height: 1.5;">
              ${companyData.invoice_notes || 'Please send payment within 30 days of receiving this invoice. There will be 10% interest charge per month on late invoice.'}
            </p>
          </div>
          
          <div class="signature-section">
            <div style="display: inline-block;">
              <div style="font-size: 18px; font-weight: bold; margin-bottom: 8px;">
                ${companyData.company_name}
              </div>
              <div style="font-size: 14px; color: #666;">Administrator</div>
            </div>
          </div>
          
          <div class="company-footer">
            <div>${companyData.company_name}</div>
            <div>${companyData.address}</div>
            <div>${companyData.contact_email} | ${companyData.primary_phone}</div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    const requestData: SendInvoiceRequest = await req.json();
    console.log("Sending invoice email:", requestData);

    // Get student details
    const { data: student, error: studentError } = await supabase
      .from("users")
      .select("id, full_name, email, fees_structure")
      .eq("id", requestData.student_id)
      .eq("role", "student")
      .single();

    if (studentError || !student) {
      throw new Error(`Student not found: ${studentError?.message}`);
    }

    // Get company settings
    const { data: company, error: companyError } = await supabase
      .from("company_settings")
      .select("*")
      .limit(1)
      .single();

    if (companyError || !company) {
      throw new Error(`Company settings not found: ${companyError?.message}`);
    }

    // Create invoice record in installment_payments if not exists
    const { data: existingPayment } = await supabase
      .from("installment_payments")
      .select("id, invoice_id")
      .eq("user_id", requestData.student_id)
      .eq("installment_number", requestData.installment_number)
      .single();

    let invoiceNumber = requestData.invoice_number;
    
    if (!existingPayment) {
      // Create new installment payment record
      invoiceNumber = `INV-${student.id.slice(0, 8)}-${requestData.installment_number}-${Date.now()}`;
      
      const { error: paymentError } = await supabase
        .from("installment_payments")
        .insert({
          user_id: requestData.student_id,
          installment_number: requestData.installment_number,
          total_installments: parseInt(student.fees_structure?.split('_')[0] || '1'),
          amount: requestData.amount,
          status: 'pending',
          invoice_id: invoiceNumber
        });

      if (paymentError) {
        console.error("Error creating payment record:", paymentError);
      }
    } else {
      invoiceNumber = existingPayment.invoice_id || invoiceNumber;
    }

    // Generate invoice HTML
    const invoiceHTML = generateInvoiceHTML(
      student,
      company,
      {
        invoice_number: invoiceNumber,
        installment_number: requestData.installment_number,
        amount: requestData.amount,
        due_date: requestData.due_date
      }
    );

    // Send email
    const emailResponse = await resend.emails.send({
      from: `${company.company_name} <${company.contact_email}>`,
      to: [student.email],
      subject: `Invoice ${invoiceNumber} - Installment ${requestData.installment_number} Due`,
      html: invoiceHTML,
    });

    console.log("Email sent successfully:", emailResponse);

    // Update last invoice sent date
    await supabase
      .from("users")
      .update({ 
        last_invoice_date: new Date().toISOString(),
        last_invoice_sent: true 
      })
      .eq("id", requestData.student_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        invoice_number: invoiceNumber,
        email_id: emailResponse.data?.id 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );

  } catch (error) {
    console.error("Error sending invoice email:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error occurred" 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
};

serve(handler);