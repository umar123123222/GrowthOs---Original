import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ManualInvoiceRequest {
  student_ids: string[];
  installment_number?: number;
  custom_amount?: number;
  custom_due_date?: string;
  send_to_all_students?: boolean;
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

    // Verify admin/superadmin access
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check user role
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (userError || !userData || !['admin', 'superadmin'].includes(userData.role)) {
      return new Response(
        JSON.stringify({ error: "Insufficient permissions" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const requestData: ManualInvoiceRequest = await req.json();
    console.log("Manual invoice request:", requestData);

    let targetStudents: string[] = [];

    if (requestData.send_to_all_students) {
      // Get all active students
      const { data: allStudents, error: studentsError } = await supabase
        .from("users")
        .select("id")
        .eq("role", "student")
        .eq("status", "Active");

      if (studentsError) {
        throw new Error(`Error fetching students: ${studentsError.message}`);
      }

      targetStudents = allStudents?.map(s => s.id) || [];
    } else {
      targetStudents = requestData.student_ids;
    }

    if (targetStudents.length === 0) {
      return new Response(
        JSON.stringify({ error: "No students specified" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get company settings for default values
    const { data: company, error: companyError } = await supabase
      .from("company_settings")
      .select("*")
      .limit(1)
      .single();

    if (companyError) {
      throw new Error(`Company settings not found: ${companyError.message}`);
    }

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const studentId of targetStudents) {
      try {
        // Get student details
        const { data: student, error: studentError } = await supabase
          .from("users")
          .select("fees_structure")
          .eq("id", studentId)
          .single();

        if (studentError) {
          console.error(`Student ${studentId} not found:`, studentError);
          errorCount++;
          continue;
        }

        // Calculate installment details
        const totalInstallments = parseInt(student.fees_structure?.split('_')[0] || '1');
        const defaultAmount = company.original_fee_amount / totalInstallments;
        
        let installmentNumber = requestData.installment_number;
        if (!installmentNumber) {
          // Find next pending installment
          const { data: payments } = await supabase
            .from("installment_payments")
            .select("installment_number, status")
            .eq("user_id", studentId)
            .order("installment_number");

          const nextPending = payments?.find(p => p.status === 'pending');
          installmentNumber = nextPending?.installment_number || 1;
        }

        const amount = requestData.custom_amount || defaultAmount;
        const dueDate = requestData.custom_due_date || 
                       new Date(Date.now() + (company.invoice_overdue_days || 30) * 24 * 60 * 60 * 1000).toISOString();

        // Send invoice
        const response = await fetch(`${supabaseUrl}/functions/v1/send-invoice-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({
            student_id: studentId,
            installment_number: installmentNumber,
            amount: amount,
            due_date: dueDate
          })
        });

        if (response.ok) {
          const result = await response.json();
          results.push({
            student_id: studentId,
            success: true,
            invoice_number: result.invoice_number
          });
          successCount++;
        } else {
          const error = await response.json();
          results.push({
            student_id: studentId,
            success: false,
            error: error.error
          });
          errorCount++;
        }

      } catch (error) {
        console.error(`Error processing student ${studentId}:`, error);
        results.push({
          student_id: studentId,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error"
        });
        errorCount++;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        total_processed: targetStudents.length,
        success_count: successCount,
        error_count: errorCount,
        results: results
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );

  } catch (error) {
    console.error("Error in manual invoice sender:", error);
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