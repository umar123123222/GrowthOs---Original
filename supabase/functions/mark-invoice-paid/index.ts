import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase configuration");
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    const requestData: MarkInvoicePaidRequest = await req.json();
    console.log("Processing payment request:", JSON.stringify(requestData));

    let invoice: any;
    let invoiceId: string;

    // Find or create invoice
    if (requestData.invoice_id) {
      console.log("Finding invoice by ID:", requestData.invoice_id);
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", requestData.invoice_id)
        .single();

      if (error || !data) {
        console.error("Invoice not found:", error?.message);
        throw new Error(`Invoice not found: ${error?.message || 'No data returned'}`);
      }
      invoice = data;
      invoiceId = invoice.id;
    } else if (requestData.student_id && requestData.installment_number) {
      console.log(`Finding invoice for student ${requestData.student_id}, installment ${requestData.installment_number}`);
      
      // Try to find existing invoice
      const { data: existing, error: findError } = await supabase
        .from("invoices")
        .select("*")
        .eq("student_id", requestData.student_id)
        .eq("installment_number", requestData.installment_number)
        .maybeSingle();

      if (findError) {
        console.error("Error finding invoice:", findError.message);
        throw new Error(`Failed to find invoice: ${findError.message}`);
      }

      if (existing) {
        console.log("Found existing invoice:", existing.id);
        invoice = existing;
        invoiceId = existing.id;
      } else {
        console.log("Creating new invoice");
        // Create new invoice
        const { data: newInvoice, error: createError } = await supabase
          .from("invoices")
          .insert({
            student_id: requestData.student_id,
            installment_number: requestData.installment_number,
            amount: requestData.amount || 100,
            due_date: requestData.due_date || new Date().toISOString(),
            status: "issued"
          })
          .select()
          .single();

        if (createError || !newInvoice) {
          console.error("Failed to create invoice:", createError?.message);
          throw new Error(`Failed to create invoice: ${createError?.message || 'No data returned'}`);
        }
        invoice = newInvoice;
        invoiceId = newInvoice.id;
        console.log("Created new invoice:", invoiceId);
      }
    } else {
      throw new Error("Must provide either invoice_id or (student_id + installment_number)");
    }

    // Get user_id from students table
    console.log("Fetching user_id for student:", invoice.student_id);
    const { data: studentData, error: studentError } = await supabase
      .from("students")
      .select("user_id")
      .eq("id", invoice.student_id)
      .single();

    if (studentError || !studentData) {
      console.error("Student record not found:", studentError?.message);
      throw new Error(`Student record not found: ${studentError?.message || 'No data returned'}`);
    }

    const userId = studentData.user_id;
    console.log("Found user_id:", userId);

    // Mark invoice as paid
    console.log("Updating invoice status to paid:", invoiceId);
    const { error: updateInvoiceError } = await supabase
      .from("invoices")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", invoiceId);

    if (updateInvoiceError) {
      console.error("Failed to update invoice:", updateInvoiceError.message);
      throw new Error(`Failed to update invoice: ${updateInvoiceError.message}`);
    }
    console.log("Invoice marked as paid successfully");

    // Update enrollment payment status if invoice is linked to a course/pathway
    if (invoice.course_id || invoice.pathway_id) {
      console.log("Updating enrollment payment status for course/pathway");
      
      // Get all invoices for this specific enrollment
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
        if (paidInvoices === 0) {
          paymentStatus = "pending";
        } else if (paidInvoices === totalInvoices) {
          paymentStatus = "paid";
        } else {
          paymentStatus = "partial";
        }
        
        // Update course enrollment
        let updateEnrollmentQuery = supabase
          .from("course_enrollments")
          .update({
            payment_status: paymentStatus,
            amount_paid: paidAmount,
            total_amount: totalAmount,
            updated_at: new Date().toISOString()
          })
          .eq("student_id", invoice.student_id);
        
        if (invoice.course_id) {
          updateEnrollmentQuery = updateEnrollmentQuery.eq("course_id", invoice.course_id);
        } else if (invoice.pathway_id) {
          updateEnrollmentQuery = updateEnrollmentQuery.eq("pathway_id", invoice.pathway_id);
        }
        
        const { error: enrollUpdateError } = await updateEnrollmentQuery;
        
        if (enrollUpdateError) {
          console.error("Failed to update enrollment payment status:", enrollUpdateError.message);
        } else {
          console.log(`Enrollment payment status updated to ${paymentStatus}`);
        }
        
        // Only update global fees_cleared if ALL enrollments are fully paid
        if (paymentStatus === "paid") {
          // Check if all other enrollments are also fully paid
          const { data: allEnrollments } = await supabase
            .from("course_enrollments")
            .select("payment_status")
            .eq("student_id", invoice.student_id)
            .eq("status", "active");
          
          const allPaid = allEnrollments?.every(e => e.payment_status === "paid" || e.payment_status === "waived");
          
          if (allPaid) {
            console.log("All enrollments paid - updating global fees_cleared");
            await supabase
              .from("students")
              .update({
                fees_cleared: true,
                updated_at: new Date().toISOString()
              })
              .eq("id", invoice.student_id);
          }
        }
      }
    } else {
      // Legacy behavior for invoices without course/pathway link
      console.log("Updating fees_cleared for student (legacy):", invoice.student_id);
      const { error: updateStudentError } = await supabase
        .from("students")
        .update({
          fees_cleared: true,
          updated_at: new Date().toISOString()
        })
        .eq("id", invoice.student_id);

      if (updateStudentError) {
        console.error("Failed to update student fees_cleared:", updateStudentError.message);
        throw new Error(`Failed to update student: ${updateStudentError.message}`);
      }
      console.log("Student fees_cleared updated successfully");
    }

    // Activate user account
    console.log("Activating user account:", userId);
    const { error: updateUserError } = await supabase
      .from("users")
      .update({
        status: "active",
        lms_status: "active",
        last_active_at: new Date().toISOString()
      })
      .eq("id", userId);

    if (updateUserError) {
      console.error("Failed to activate user:", updateUserError.message);
      throw new Error(`Failed to activate user: ${updateUserError.message}`);
    }
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
  }
};

serve(handler);
