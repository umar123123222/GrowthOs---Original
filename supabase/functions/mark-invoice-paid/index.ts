import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.55.0";
import { Client } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

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

  let pgClient: Client | null = null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    const requestData: MarkInvoicePaidRequest = await req.json();
    console.log("Processing payment request:", JSON.stringify(requestData));

    let invoice: any;
    let invoiceId: string;

    // Find or create invoice using Supabase client (reads are fine)
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
        // Need to create - will use direct SQL below
        invoice = null;
        invoiceId = "";
      }
    } else {
      throw new Error("Must provide either invoice_id or (student_id + installment_number)");
    }

    // Connect to Postgres directly to bypass the http_post trigger
    if (dbUrl) {
      pgClient = new Client(dbUrl);
      await pgClient.connect();
      console.log("Connected to Postgres directly");
    } else {
      console.warn("SUPABASE_DB_URL not available, falling back to Supabase client");
    }

    const now = new Date().toISOString();

    // Create invoice if it doesn't exist
    if (!invoice && requestData.student_id && requestData.installment_number) {
      const amount = requestData.amount || 100;
      const dueDate = requestData.due_date || now;

      if (pgClient) {
        const result = await pgClient.queryObject`
          INSERT INTO invoices (student_id, installment_number, amount, due_date, status)
          VALUES (${requestData.student_id}, ${requestData.installment_number}, ${amount}, ${dueDate}, 'issued')
          RETURNING *
        `;
        if (!result.rows || result.rows.length === 0) {
          throw new Error("Failed to create invoice");
        }
        invoice = result.rows[0];
        invoiceId = (invoice as any).id;
      } else {
        const { data: newInvoice, error: createError } = await supabase
          .from("invoices")
          .insert({
            student_id: requestData.student_id,
            installment_number: requestData.installment_number,
            amount: requestData.amount || 100,
            due_date: requestData.due_date || now,
            status: "issued"
          })
          .select()
          .single();
        if (createError || !newInvoice) throw new Error(`Failed to create invoice: ${createError?.message}`);
        invoice = newInvoice;
        invoiceId = newInvoice.id;
      }
      console.log("Created new invoice:", invoiceId);
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

    // Mark invoice as paid - use direct SQL to bypass http_post trigger
    if (pgClient) {
      await pgClient.queryObject`
        UPDATE invoices SET status = 'paid', paid_at = ${now}, updated_at = ${now}
        WHERE id = ${invoiceId}
      `;
      console.log("Invoice marked as paid (direct SQL)");
    } else {
      const { error: updateErr } = await supabase
        .from("invoices")
        .update({ status: "paid", paid_at: now, updated_at: now })
        .eq("id", invoiceId);
      if (updateErr) throw new Error(`Failed to update invoice: ${updateErr.message}`);
    }

    // Update enrollment payment status if linked to course/pathway
    if (invoice.course_id || invoice.pathway_id) {
      let enrollmentQuery = supabase
        .from("invoices")
        .select("id, status, amount")
        .eq("student_id", invoice.student_id);

      if (invoice.course_id) {
        enrollmentQuery = enrollmentQuery.eq("course_id", invoice.course_id);
      } else if (invoice.pathway_id) {
        enrollmentQuery = enrollmentQuery.eq("pathway_id", invoice.pathway_id);
      }

      const { data: enrollmentInvoices, error: fetchError } = await enrollmentQuery;

      if (!fetchError && enrollmentInvoices) {
        const totalInvoices = enrollmentInvoices.length;
        const paidInvoices = enrollmentInvoices.filter(inv => inv.status === "paid").length;
        const totalAmount = enrollmentInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
        const paidAmount = enrollmentInvoices
          .filter(inv => inv.status === "paid")
          .reduce((sum, inv) => sum + (inv.amount || 0), 0);

        let paymentStatus: string;
        if (paidInvoices === 0) paymentStatus = "pending";
        else if (paidInvoices === totalInvoices) paymentStatus = "paid";
        else paymentStatus = "partial";

        // Update enrollment - use direct SQL
        if (pgClient) {
          if (invoice.course_id) {
            await pgClient.queryObject`
              UPDATE course_enrollments 
              SET payment_status = ${paymentStatus}, amount_paid = ${paidAmount}, total_amount = ${totalAmount}, updated_at = ${now}
              WHERE student_id = ${invoice.student_id} AND course_id = ${invoice.course_id}
            `;
          } else {
            await pgClient.queryObject`
              UPDATE course_enrollments 
              SET payment_status = ${paymentStatus}, amount_paid = ${paidAmount}, total_amount = ${totalAmount}, updated_at = ${now}
              WHERE student_id = ${invoice.student_id} AND pathway_id = ${invoice.pathway_id}
            `;
          }
        } else {
          let updateQuery = supabase.from("course_enrollments").update({
            payment_status: paymentStatus, amount_paid: paidAmount, total_amount: totalAmount, updated_at: now
          }).eq("student_id", invoice.student_id);
          if (invoice.course_id) updateQuery = updateQuery.eq("course_id", invoice.course_id);
          else updateQuery = updateQuery.eq("pathway_id", invoice.pathway_id);
          await updateQuery;
        }
        console.log(`Enrollment payment status updated to ${paymentStatus}`);

        if (paymentStatus === "paid") {
          const { data: allEnrollments } = await supabase
            .from("course_enrollments")
            .select("payment_status")
            .eq("student_id", invoice.student_id)
            .eq("status", "active");

          const allPaid = allEnrollments?.every(e => e.payment_status === "paid" || e.payment_status === "waived");
          if (allPaid) {
            if (pgClient) {
              await pgClient.queryObject`UPDATE students SET fees_cleared = true, updated_at = ${now} WHERE id = ${invoice.student_id}`;
            } else {
              await supabase.from("students").update({ fees_cleared: true, updated_at: now }).eq("id", invoice.student_id);
            }
          }
        }
      }
    } else {
      // Legacy behavior
      if (pgClient) {
        await pgClient.queryObject`UPDATE students SET fees_cleared = true, updated_at = ${now} WHERE id = ${invoice.student_id}`;
      } else {
        await supabase.from("students").update({ fees_cleared: true, updated_at: now }).eq("id", invoice.student_id);
      }
      console.log("Student fees_cleared updated");
    }

    // Activate user account
    if (pgClient) {
      await pgClient.queryObject`
        UPDATE users SET status = 'active', lms_status = 'active', last_active_at = ${now}
        WHERE id = ${userId}
      `;
    } else {
      await supabase.from("users").update({ status: "active", lms_status: "active", last_active_at: now }).eq("id", userId);
    }
    console.log("User activated successfully");

    console.log(`✅ Payment processed - Invoice: ${invoiceId}, Student: ${invoice.student_id}, User: ${userId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Payment recorded and user account activated",
        invoice_id: invoiceId,
        student_id: invoice.student_id,
        user_id: userId,
        course_id: invoice.course_id || null,
        pathway_id: invoice.pathway_id || null
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("❌ Error processing payment:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  } finally {
    if (pgClient) {
      try { await pgClient.end(); } catch (_) { /* ignore */ }
    }
  }
};

serve(handler);
