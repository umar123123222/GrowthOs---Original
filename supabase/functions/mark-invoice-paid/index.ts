import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.55.0";
import postgres from "npm:postgres@3.4.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface MarkInvoicePaidRequest {
  invoice_id?: string;
  student_id?: string;
  installment_number?: number;
  amount?: number;
  due_date?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Use direct Postgres connection to bypass triggers
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  let sql: ReturnType<typeof postgres> | null = null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    if (!dbUrl) {
      throw new Error("Missing SUPABASE_DB_URL");
    }

    sql = postgres(dbUrl, { prepare: false });

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    const requestData: MarkInvoicePaidRequest = await req.json();
    console.log("Processing payment request:", JSON.stringify(requestData));

    let invoice: any;
    let invoiceId: string;

    // Find or create invoice using Supabase client (reads don't trigger the issue)
    if (requestData.invoice_id) {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", requestData.invoice_id)
        .single();

      if (error || !data) {
        throw new Error(`Invoice not found: ${error?.message || 'No data returned'}`);
      }
      invoice = data;
      invoiceId = invoice.id;
    } else if (requestData.student_id && requestData.installment_number) {
      const { data: existing, error: findError } = await supabase
        .from("invoices")
        .select("*")
        .eq("student_id", requestData.student_id)
        .eq("installment_number", requestData.installment_number)
        .maybeSingle();

      if (findError) {
        throw new Error(`Failed to find invoice: ${findError.message}`);
      }

      if (existing) {
        invoice = existing;
        invoiceId = existing.id;
      } else {
        // Insert new invoice using direct SQL to bypass trigger
        const now = new Date().toISOString();
        const amount = requestData.amount || 100;
        const dueDate = requestData.due_date || now;
        
        const result = await sql`
          INSERT INTO invoices (student_id, installment_number, amount, due_date, status)
          VALUES (${requestData.student_id}, ${requestData.installment_number}, ${amount}, ${dueDate}, 'issued')
          RETURNING *
        `;
        
        if (!result || result.length === 0) {
          throw new Error("Failed to create invoice");
        }
        invoice = result[0];
        invoiceId = invoice.id;
        console.log("Created new invoice:", invoiceId);
      }
    } else {
      throw new Error("Must provide either invoice_id or (student_id + installment_number)");
    }

    // Get user_id from students table
    const { data: studentData, error: studentError } = await supabase
      .from("students")
      .select("user_id")
      .eq("id", invoice.student_id)
      .single();

    if (studentError || !studentData) {
      throw new Error(`Student record not found: ${studentError?.message || 'No data returned'}`);
    }

    const userId = studentData.user_id;
    console.log("Found user_id:", userId);

    // Mark invoice as paid using DIRECT SQL to bypass the http_post trigger
    const now = new Date().toISOString();
    await sql`
      UPDATE invoices 
      SET status = 'paid', paid_at = ${now}, updated_at = ${now}
      WHERE id = ${invoiceId}
    `;
    console.log("Invoice marked as paid successfully (direct SQL, trigger bypassed)");

    // Update enrollment payment status if invoice is linked to a course/pathway
    if (invoice.course_id || invoice.pathway_id) {
      let enrollmentInvoices;
      if (invoice.course_id) {
        enrollmentInvoices = await sql`
          SELECT id, status, amount FROM invoices 
          WHERE student_id = ${invoice.student_id} AND course_id = ${invoice.course_id}
        `;
      } else {
        enrollmentInvoices = await sql`
          SELECT id, status, amount FROM invoices 
          WHERE student_id = ${invoice.student_id} AND pathway_id = ${invoice.pathway_id}
        `;
      }

      if (enrollmentInvoices && enrollmentInvoices.length > 0) {
        const totalInvoices = enrollmentInvoices.length;
        const paidInvoices = enrollmentInvoices.filter((inv: any) => inv.status === "paid").length;
        const totalAmount = enrollmentInvoices.reduce((sum: number, inv: any) => sum + (Number(inv.amount) || 0), 0);
        const paidAmount = enrollmentInvoices
          .filter((inv: any) => inv.status === "paid")
          .reduce((sum: number, inv: any) => sum + (Number(inv.amount) || 0), 0);

        let paymentStatus: string;
        if (paidInvoices === 0) {
          paymentStatus = "pending";
        } else if (paidInvoices === totalInvoices) {
          paymentStatus = "paid";
        } else {
          paymentStatus = "partial";
        }

        // Update course enrollment
        if (invoice.course_id) {
          await sql`
            UPDATE course_enrollments 
            SET payment_status = ${paymentStatus}, amount_paid = ${paidAmount}, total_amount = ${totalAmount}, updated_at = ${now}
            WHERE student_id = ${invoice.student_id} AND course_id = ${invoice.course_id}
          `;
        } else {
          await sql`
            UPDATE course_enrollments 
            SET payment_status = ${paymentStatus}, amount_paid = ${paidAmount}, total_amount = ${totalAmount}, updated_at = ${now}
            WHERE student_id = ${invoice.student_id} AND pathway_id = ${invoice.pathway_id}
          `;
        }
        console.log(`Enrollment payment status updated to ${paymentStatus}`);

        if (paymentStatus === "paid") {
          const allEnrollments = await sql`
            SELECT payment_status FROM course_enrollments 
            WHERE student_id = ${invoice.student_id} AND status = 'active'
          `;
          const allPaid = allEnrollments?.every((e: any) => e.payment_status === "paid" || e.payment_status === "waived");

          if (allPaid) {
            await sql`
              UPDATE students SET fees_cleared = true, updated_at = ${now}
              WHERE id = ${invoice.student_id}
            `;
          }
        }
      }
    } else {
      // Legacy behavior
      await sql`
        UPDATE students SET fees_cleared = true, updated_at = ${now}
        WHERE id = ${invoice.student_id}
      `;
      console.log("Student fees_cleared updated successfully");
    }

    // Activate user account
    await sql`
      UPDATE users SET status = 'active', lms_status = 'active', last_active_at = ${now}
      WHERE id = ${userId}
    `;
    console.log("User activated successfully");

    console.log(`✅ Payment processed successfully - Invoice: ${invoiceId}, Student: ${invoice.student_id}, User: ${userId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Payment recorded, enrollment payment status updated, and user account activated",
        invoice_id: invoiceId,
        student_id: invoice.student_id,
        user_id: userId,
        course_id: invoice.course_id || null,
        pathway_id: invoice.pathway_id || null
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      }
    );

  } catch (error) {
    console.error("❌ Error processing payment:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      }
    );
  } finally {
    if (sql) {
      await sql.end();
    }
  }
};

serve(handler);
