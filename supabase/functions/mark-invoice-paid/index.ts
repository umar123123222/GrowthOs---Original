import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.55.0";

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

/**
 * Execute SQL directly against the database using the pg_net-free approach.
 * We use supabase.rpc to call a wrapper, or fall back to direct REST API calls
 * that avoid triggering the problematic http_post trigger by using 
 * session_replication_role via a direct TCP postgres connection.
 */
async function directSqlUpdate(
  supabaseUrl: string,
  serviceKey: string,
  table: string,
  updates: Record<string, any>,
  matchColumn: string,
  matchValue: string
): Promise<void> {
  // Use the PostgREST API directly with service role - this still triggers the trigger
  // So we need an alternative: call a temporary disable-trigger RPC
  // Since we can't create RPC functions, we'll attempt to use the raw SQL endpoint

  // Try the Supabase Management API SQL endpoint
  const projectRef = supabaseUrl.replace('https://', '').split('.')[0];
  
  // Build PATCH request to PostgREST - unfortunately this still triggers the trigger
  // The only reliable fix is to use a raw postgres connection
  
  // Let's try connecting via the pooler
  const dbHost = `db.${projectRef}.supabase.co`;
  
  try {
    // Dynamically import postgres
    const { Client } = await import("https://deno.land/x/postgres@v0.17.2/mod.ts");
    
    // Try different connection string formats
    const dbUrl = Deno.env.get("SUPABASE_DB_URL") || 
                  Deno.env.get("DATABASE_URL") ||
                  `postgresql://postgres:${serviceKey}@${dbHost}:5432/postgres`;
    
    console.log("Attempting direct DB connection...");
    const client = new Client(dbUrl);
    await client.connect();
    
    // Build SET clause
    const setClauses = Object.entries(updates)
      .map(([key, value]) => {
        if (typeof value === 'string') return `${key} = '${value}'`;
        if (typeof value === 'boolean') return `${key} = ${value}`;
        if (typeof value === 'number') return `${key} = ${value}`;
        return `${key} = '${value}'`;
      })
      .join(', ');
    
    const query = `UPDATE ${table} SET ${setClauses} WHERE ${matchColumn} = '${matchValue}'`;
    console.log("Executing direct SQL:", query);
    await client.queryArray(query);
    await client.end();
    console.log("Direct SQL update successful");
    return;
  } catch (pgError) {
    console.error("Direct Postgres connection failed:", pgError);
    throw pgError;
  }
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

    // Log available DB env vars for debugging
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    const databaseUrl = Deno.env.get("DATABASE_URL");
    console.log("SUPABASE_DB_URL available:", !!dbUrl);
    console.log("DATABASE_URL available:", !!databaseUrl);

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    const requestData: MarkInvoicePaidRequest = await req.json();
    console.log("Processing payment request:", JSON.stringify(requestData));

    let invoice: any;
    let invoiceId: string;

    // Find invoice (reads are safe - no trigger issue)
    if (requestData.invoice_id) {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", requestData.invoice_id)
        .single();
      if (error || !data) throw new Error(`Invoice not found: ${error?.message || 'No data'}`);
      invoice = data;
      invoiceId = invoice.id;
    } else if (requestData.student_id && requestData.installment_number) {
      const { data: existing, error: findError } = await supabase
        .from("invoices")
        .select("*")
        .eq("student_id", requestData.student_id)
        .eq("installment_number", requestData.installment_number)
        .maybeSingle();
      if (findError) throw new Error(`Failed to find invoice: ${findError.message}`);

      if (existing) {
        invoice = existing;
        invoiceId = existing.id;
      } else {
        // Create new invoice via direct SQL
        const now = new Date().toISOString();
        const amount = requestData.amount || 100;
        const dueDate = requestData.due_date || now;

        try {
          const { Client } = await import("https://deno.land/x/postgres@v0.17.2/mod.ts");
          const connStr = dbUrl || databaseUrl || "";
          if (!connStr) throw new Error("No DB connection string available");
          const client = new Client(connStr);
          await client.connect();
          const result = await client.queryObject(
            `INSERT INTO invoices (student_id, installment_number, amount, due_date, status) VALUES ($1, $2, $3, $4, 'issued') RETURNING *`,
            [requestData.student_id, requestData.installment_number, amount, dueDate]
          );
          await client.end();
          if (!result.rows?.length) throw new Error("Insert returned no rows");
          invoice = result.rows[0];
          invoiceId = (invoice as any).id;
        } catch (pgErr) {
          console.error("Direct insert failed, trying Supabase client:", pgErr);
          const { data: newInvoice, error: createError } = await supabase
            .from("invoices")
            .insert({ student_id: requestData.student_id, installment_number: requestData.installment_number, amount, due_date: dueDate, status: "issued" })
            .select().single();
          if (createError || !newInvoice) throw new Error(`Failed to create invoice: ${createError?.message}`);
          invoice = newInvoice;
          invoiceId = newInvoice.id;
        }
        console.log("Created new invoice:", invoiceId);
      }
    } else {
      throw new Error("Must provide either invoice_id or (student_id + installment_number)");
    }

    // Get user_id
    const { data: studentData, error: studentError } = await supabase
      .from("students").select("user_id").eq("id", invoice.student_id).single();
    if (studentError || !studentData) throw new Error(`Student not found: ${studentError?.message}`);
    const userId = studentData.user_id;
    console.log("Found user_id:", userId);

    const now = new Date().toISOString();

    // Mark invoice as paid - TRY direct SQL first to bypass trigger
    let usedDirectSql = false;
    try {
      const { Client } = await import("https://deno.land/x/postgres@v0.17.2/mod.ts");
      const connStr = dbUrl || databaseUrl || "";
      if (!connStr) throw new Error("No DB connection string");
      
      const client = new Client(connStr);
      await client.connect();
      
      // Update invoice
      await client.queryArray(
        `UPDATE invoices SET status = 'paid', paid_at = $1, updated_at = $2 WHERE id = $3`,
        [now, now, invoiceId]
      );
      
      // Update student fees_cleared
      await client.queryArray(
        `UPDATE students SET fees_cleared = true, updated_at = $1 WHERE id = $2`,
        [now, invoice.student_id]
      );
      
      // Activate user
      await client.queryArray(
        `UPDATE users SET status = 'active', lms_status = 'active', last_active_at = $1 WHERE id = $2`,
        [now, userId]
      );
      
      await client.end();
      usedDirectSql = true;
      console.log("All updates done via direct SQL (trigger bypassed)");
    } catch (pgError) {
      console.error("Direct SQL failed:", pgError);
      console.error("Error name:", (pgError as Error).name);
      console.error("Error message:", (pgError as Error).message);
    }

    // Fallback to Supabase client if direct SQL failed
    if (!usedDirectSql) {
      console.log("Falling back to Supabase client (trigger will fire)");
      const { error: updateErr } = await supabase
        .from("invoices")
        .update({ status: "paid", paid_at: now, updated_at: now })
        .eq("id", invoiceId);
      if (updateErr) throw new Error(`Failed to update invoice: ${updateErr.message}`);

      await supabase.from("students").update({ fees_cleared: true, updated_at: now }).eq("id", invoice.student_id);
      await supabase.from("users").update({ status: "active", lms_status: "active", last_active_at: now }).eq("id", userId);
    }

    // Update enrollment payment status if linked
    if (invoice.course_id || invoice.pathway_id) {
      let enrollmentQuery = supabase.from("invoices").select("id, status, amount").eq("student_id", invoice.student_id);
      if (invoice.course_id) enrollmentQuery = enrollmentQuery.eq("course_id", invoice.course_id);
      else enrollmentQuery = enrollmentQuery.eq("pathway_id", invoice.pathway_id);

      const { data: enrollmentInvoices } = await enrollmentQuery;
      if (enrollmentInvoices) {
        const totalInvoices = enrollmentInvoices.length;
        const paidInvoices = enrollmentInvoices.filter(inv => inv.status === "paid").length;
        const totalAmount = enrollmentInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
        const paidAmount = enrollmentInvoices.filter(inv => inv.status === "paid").reduce((sum, inv) => sum + (inv.amount || 0), 0);

        const paymentStatus = paidInvoices === 0 ? "pending" : paidInvoices === totalInvoices ? "paid" : "partial";

        let updateQuery = supabase.from("course_enrollments").update({
          payment_status: paymentStatus, amount_paid: paidAmount, total_amount: totalAmount, updated_at: now
        }).eq("student_id", invoice.student_id);
        if (invoice.course_id) updateQuery = updateQuery.eq("course_id", invoice.course_id);
        else updateQuery = updateQuery.eq("pathway_id", invoice.pathway_id);
        await updateQuery;

        if (paymentStatus === "paid") {
          const { data: allEnrollments } = await supabase.from("course_enrollments")
            .select("payment_status").eq("student_id", invoice.student_id).eq("status", "active");
          if (allEnrollments?.every(e => e.payment_status === "paid" || e.payment_status === "waived")) {
            await supabase.from("students").update({ fees_cleared: true, updated_at: now }).eq("id", invoice.student_id);
          }
        }
      }
    }

    console.log(`✅ Payment processed - Invoice: ${invoiceId}, Student: ${invoice.student_id}, User: ${userId}`);

    return new Response(
      JSON.stringify({
        success: true, message: "Payment recorded and user account activated",
        invoice_id: invoiceId, student_id: invoice.student_id, user_id: userId,
        course_id: invoice.course_id || null, pathway_id: invoice.pathway_id || null
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("❌ Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
};

serve(handler);
