import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    console.log("Running invoice scheduler...");

    // Get company settings
    const { data: company, error: companyError } = await supabase
      .from("company_settings")
      .select("*")
      .limit(1)
      .single();

    if (companyError || !company) {
      throw new Error(`Company settings not found: ${companyError?.message}`);
    }

    const today = new Date();
    const invoiceSendGapDays = company.invoice_send_gap_days || 7;
    const invoiceOverdueDays = company.invoice_overdue_days || 30;

    // Get all active students with their payment status
    const { data: students, error: studentsError } = await supabase
      .from("users")
      .select(`
        id,
        full_name,
        email,
        fees_structure,
        last_invoice_date,
        last_invoice_sent,
        fees_due_date,
        fees_overdue,
        created_at
      `)
      .eq("role", "student")
      .eq("status", "Active");

    if (studentsError) {
      throw new Error(`Error fetching students: ${studentsError.message}`);
    }

    console.log(`Found ${students?.length || 0} active students`);

    let invoicesSent = 0;
    let overdueUpdates = 0;

    for (const student of students || []) {
      try {
        // Parse fees structure to get total installments
        const totalInstallments = parseInt(student.fees_structure?.split('_')[0] || '1');
        const installmentAmount = company.original_fee_amount / totalInstallments;

        // Get all installment payments for this student
        const { data: payments, error: paymentsError } = await supabase
          .from("installment_payments")
          .select("*")
          .eq("user_id", student.id)
          .order("installment_number");

        if (paymentsError) {
          console.error(`Error fetching payments for student ${student.id}:`, paymentsError);
          continue;
        }

        // Check if we need to create initial installment records
        if (!payments || payments.length === 0) {
          console.log(`Creating initial installment records for student ${student.full_name}`);
          
          // Create all installment payment records
          const installmentRecords = [];
          for (let i = 1; i <= totalInstallments; i++) {
            installmentRecords.push({
              user_id: student.id,
              installment_number: i,
              total_installments: totalInstallments,
              amount: installmentAmount,
              status: 'pending'
            });
          }

          const { error: insertError } = await supabase
            .from("installment_payments")
            .insert(installmentRecords);

          if (insertError) {
            console.error(`Error creating installment records for ${student.id}:`, insertError);
            continue;
          }

          // Refetch payments after creation
          const { data: newPayments } = await supabase
            .from("installment_payments")
            .select("*")
            .eq("user_id", student.id)
            .order("installment_number");

          if (newPayments) {
            // Send invoice for first installment immediately
            await sendInvoiceEmail(supabase, student.id, 1, installmentAmount);
            invoicesSent++;
          }
          continue;
        }

        // Find next pending installment
        const nextPendingInstallment = payments.find(p => p.status === 'pending');
        
        if (!nextPendingInstallment) {
          console.log(`No pending installments for student ${student.full_name}`);
          continue;
        }

        // Check if it's time to send invoice
        const lastInvoiceDate = student.last_invoice_date ? new Date(student.last_invoice_date) : null;
        const daysSinceLastInvoice = lastInvoiceDate 
          ? Math.floor((today.getTime() - lastInvoiceDate.getTime()) / (1000 * 60 * 60 * 24))
          : 999; // If no invoice sent yet, consider it as many days

        // Send invoice if:
        // 1. No invoice sent yet, OR
        // 2. It's been more than invoice_send_gap_days since last invoice, OR
        // 3. First installment and student created more than 1 day ago
        const shouldSendInvoice = 
          !lastInvoiceDate || 
          daysSinceLastInvoice >= invoiceSendGapDays ||
          (nextPendingInstallment.installment_number === 1 && 
           Math.floor((today.getTime() - new Date(student.created_at).getTime()) / (1000 * 60 * 60 * 24)) >= 1);

        if (shouldSendInvoice) {
          console.log(`Sending invoice for student ${student.full_name}, installment ${nextPendingInstallment.installment_number}`);
          
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + invoiceOverdueDays);
          
          await sendInvoiceEmail(
            supabase, 
            student.id, 
            nextPendingInstallment.installment_number, 
            nextPendingInstallment.amount,
            dueDate.toISOString()
          );
          invoicesSent++;
        }

        // Check for overdue payments
        if (student.fees_due_date) {
          const dueDate = new Date(student.fees_due_date);
          const isOverdue = today > dueDate;
          
          if (isOverdue && !student.fees_overdue) {
            await supabase
              .from("users")
              .update({ fees_overdue: true })
              .eq("id", student.id);
            
            overdueUpdates++;
            console.log(`Marked student ${student.full_name} as overdue`);
          }
        }

      } catch (studentError) {
        console.error(`Error processing student ${student.id}:`, studentError);
        continue;
      }
    }

    console.log(`Invoice scheduler completed: ${invoicesSent} invoices sent, ${overdueUpdates} overdue updates`);

    return new Response(
      JSON.stringify({ 
        success: true,
        invoices_sent: invoicesSent,
        overdue_updates: overdueUpdates,
        message: "Invoice scheduler completed successfully"
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );

  } catch (error) {
    console.error("Error in invoice scheduler:", error);
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

// Helper function to send invoice email
async function sendInvoiceEmail(
  supabase: any, 
  studentId: string, 
  installmentNumber: number, 
  amount: number,
  dueDate?: string
) {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    
    const response = await fetch(`${supabaseUrl}/functions/v1/send-invoice-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
      },
      body: JSON.stringify({
        student_id: studentId,
        installment_number: installmentNumber,
        amount: amount,
        due_date: dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to send invoice email: ${errorData.error}`);
    }

    const result = await response.json();
    console.log(`Invoice email sent successfully: ${result.invoice_number}`);
    
  } catch (error) {
    console.error(`Failed to send invoice email for student ${studentId}:`, error);
    throw error;
  }
}

serve(handler);