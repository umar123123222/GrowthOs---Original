import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.55.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function sanitizeEmail(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/<([^>]+)>/);
  return match ? match[1].trim() : trimmed;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return iso;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { student_id, invoice_id, new_due_date, previous_due_date, reason, lms_reactivated } = await req.json();

    if (!student_id || !new_due_date) {
      return new Response(JSON.stringify({ error: "student_id and new_due_date are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: student, error: studentErr } = await supabase
      .from("users")
      .select("id, full_name, email")
      .eq("id", student_id)
      .maybeSingle();

    if (studentErr) throw studentErr;
    if (!student?.email) {
      return new Response(JSON.stringify({ error: "Student email not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let invoiceNumber: string | null = null;
    let installmentNumber: number | null = null;
    if (invoice_id) {
      const { data: inv } = await supabase
        .from("invoices")
        .select("invoice_number, installment_number")
        .eq("id", invoice_id)
        .maybeSingle();
      invoiceNumber = inv?.invoice_number ?? null;
      installmentNumber = inv?.installment_number ?? null;
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const rawFromEmail = Deno.env.get("SMTP_FROM_EMAIL");
    const fromEmail = rawFromEmail ? sanitizeEmail(rawFromEmail) : "";
    const fromName = Deno.env.get("SMTP_FROM_NAME") || "IDMPakistan";
    const ccEmail = Deno.env.get("BILLING_EMAIL_CC") || Deno.env.get("NOTIFICATION_EMAIL_CC") || "";

    if (!resendApiKey) throw new Error("RESEND_API_KEY is not configured");
    if (!fromEmail) throw new Error("SMTP_FROM_EMAIL is required");

    const newDateStr = formatDate(new_due_date);
    const prevDateStr = previous_due_date ? formatDate(previous_due_date) : null;

    const html = `
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8"></head>
    <body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f8fafc;">
      <div style="max-width:600px;margin:0 auto;background-color:#fff;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
        <div style="background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;padding:30px 40px;text-align:center;">
          <h1 style="margin:0;font-size:26px;font-weight:bold;">Payment Extension Granted</h1>
          <p style="margin:8px 0 0;opacity:0.9;">${fromName}</p>
        </div>
        <div style="padding:40px;">
          <p style="color:#374151;font-size:16px;line-height:1.6;">Dear ${student.full_name || "Student"},</p>
          <p style="color:#374151;font-size:16px;line-height:1.6;">
            Good news — your payment due date has been extended. Please find the updated details below.
          </p>
          <div style="background-color:#f0f9ff;border:1px solid #bfdbfe;border-radius:8px;padding:20px;margin:20px 0;">
            ${invoiceNumber ? `<p style="margin:4px 0;color:#374151;"><strong>Invoice #:</strong> ${invoiceNumber}</p>` : ""}
            ${installmentNumber ? `<p style="margin:4px 0;color:#374151;"><strong>Installment:</strong> ${installmentNumber}</p>` : ""}
            ${prevDateStr ? `<p style="margin:4px 0;color:#6b7280;"><strong>Previous due date:</strong> ${prevDateStr}</p>` : ""}
            <p style="margin:8px 0 4px;color:#1e40af;font-size:18px;"><strong>New due date:</strong> ${newDateStr}</p>
          </div>
          ${reason ? `<div style="background-color:#f9fafb;border-radius:8px;padding:16px;margin:20px 0;">
            <p style="margin:0;color:#374151;"><strong>Note from the team:</strong></p>
            <p style="margin:6px 0 0;color:#4b5563;">${String(reason).replace(/</g, "&lt;")}</p>
          </div>` : ""}
          ${lms_reactivated ? `<div style="background-color:#ecfdf5;border:1px solid #6ee7b7;border-radius:8px;padding:16px;margin:20px 0;color:#065f46;">
            Your learning platform access has been reactivated.
          </div>` : ""}
          <p style="color:#374151;font-size:15px;line-height:1.6;">
            Please make sure your payment is completed on or before <strong>${newDateStr}</strong> to avoid any interruption in your access.
          </p>
          <p style="color:#374151;font-size:15px;margin-top:24px;">Best regards,<br><strong>${fromName} Team</strong></p>
        </div>
        <div style="background-color:#f3f4f6;padding:16px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#6b7280;font-size:12px;">This is an automated notification regarding your payment schedule.</p>
        </div>
      </div>
    </body></html>`;

    const resend = new Resend(resendApiKey);
    const payload: Record<string, unknown> = {
      from: `${fromName} <${fromEmail}>`,
      to: [student.email],
      subject: `Payment Due Date Extended to ${newDateStr}`,
      html,
    };
    if (ccEmail) payload.cc = [ccEmail];

    const { error } = await resend.emails.send(payload as any);
    if (error) throw new Error(`Resend API error: ${(error as any).message}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[send-extension-email] error", e);
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
