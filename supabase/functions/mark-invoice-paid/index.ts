import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MarkInvoicePaidRequest {
  invoice_id: string;
  user_id?: string; // Optional, will be derived from invoice if not provided
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

    const requestData: MarkInvoicePaidRequest = await req.json();
    console.log("Marking invoice as paid:", requestData);

    // Get invoice details first
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("*, user_id")
      .eq("id", requestData.invoice_id)
      .single();

    if (invoiceError || !invoice) {
      throw new Error(`Invoice not found: ${invoiceError?.message}`);
    }

    const userId = requestData.user_id || invoice.user_id;
    if (!userId) {
      throw new Error("User ID could not be determined");
    }

    // Mark invoice as paid
    const { error: updateInvoiceError } = await supabase
      .from("invoices")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", requestData.invoice_id);

    if (updateInvoiceError) {
      throw new Error(`Failed to update invoice: ${updateInvoiceError.message}`);
    }

    // Activate user account
    const { error: updateUserError } = await supabase
      .from("users")
      .update({
        status: "active",
        last_active_at: new Date().toISOString()
      })
      .eq("id", userId);

    if (updateUserError) {
      throw new Error(`Failed to activate user: ${updateUserError.message}`);
    }

    console.log(`Successfully activated user ${userId} and marked invoice ${requestData.invoice_id} as paid`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Invoice marked as paid and user account activated",
        user_id: userId,
        invoice_id: requestData.invoice_id
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );

  } catch (error) {
    console.error("Error marking invoice as paid:", error);
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