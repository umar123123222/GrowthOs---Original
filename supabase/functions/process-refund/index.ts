import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.55.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RefundRequest {
  invoice_ids: string[];
  reason: string;
  refund_method: string;
  refund_date?: string;
  performed_by?: string;
  suspend_lms?: boolean;
  proof_attachment?: {
    filename: string;
    content_base64: string;
    content_type?: string;
  };
}

function currencySymbol(c: string = "PKR") {
  return ({ USD: "$", EUR: "€", GBP: "£", INR: "₹", PKR: "Rs", CAD: "C$", AUD: "A$" } as Record<string, string>)[c] || c;
}

function sanitizeEmail(value: string): string {
  const trimmed = value.trim();
  const m = trimmed.match(/<([^>]+)>/);
  return m ? m[1].trim() : trimmed;
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  cc?: string,
  fromNameOverride?: string,
  attachments?: Array<{ filename: string; content: string; content_type?: string }>,
) {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("SMTP_FROM_EMAIL");
  const fromName = fromNameOverride || Deno.env.get("SMTP_FROM_NAME") || "IDMPakistan";
  if (!resendApiKey || !fromEmail) {
    console.warn("Email skipped: RESEND_API_KEY or SMTP_FROM_EMAIL missing");
    return;
  }
  const resend = new Resend(resendApiKey);
  const payload: Record<string, unknown> = {
    from: `${fromName} <${sanitizeEmail(fromEmail)}>`,
    to: [to],
    subject,
    html,
  };
  if (cc) payload.cc = [cc];
  if (attachments?.length) {
    payload.attachments = attachments.map(a => ({
      filename: a.filename,
      content: a.content,
      ...(a.content_type ? { content_type: a.content_type } : {}),
    }));
  }
  const { error } = await resend.emails.send(payload as any);
  if (error) console.error("Resend error:", error);
}

function buildEmailHtml(p: {
  studentName: string;
  totalAmount: number;
  currency: string;
  refundDate: string;
  enrollmentName: string;
  refundMethod: string;
  reason: string;
  installmentNumbers: number[];
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  companyPhone2?: string;
  companyAddress: string;
  hasProof?: boolean;
}) {
  const sym = currencySymbol(p.currency);
  const installments = p.installmentNumbers.map(n => `#${n}`).join(", ");
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <div style="background:#1e40af;color:#fff;padding:24px;">
        <h1 style="margin:0;font-size:22px;">Refund Confirmation</h1>
        <p style="margin:8px 0 0;opacity:.9;">${p.companyName}</p>
      </div>
      <div style="padding:24px;">
        <p>Dear ${p.studentName || "Student"},</p>
        <p>This email confirms that a refund has been processed for your enrollment in <strong>${p.enrollmentName}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0;">
          <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>Refund Date</strong></td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${p.refundDate}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>Course / Pathway</strong></td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${p.enrollmentName}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>Installment(s) Refunded</strong></td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${installments}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>Refund Method</strong></td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${p.refundMethod}</td></tr>
          <tr><td style="padding:12px 8px;background:#f3f4f6;font-size:16px;"><strong>Total Refunded</strong></td><td style="padding:12px 8px;background:#f3f4f6;font-size:16px;text-align:right;"><strong>${sym}${p.totalAmount.toLocaleString()}</strong></td></tr>
        </table>
        ${p.reason ? `<p style="background:#fffbeb;border-left:3px solid #f59e0b;padding:10px 14px;margin:16px 0;"><strong>Note:</strong> ${p.reason}</p>` : ""}
        <p>Your LMS access has been suspended as part of this refund.${p.hasProof ? " A copy of the refund proof is attached to this email." : ""} If this was done in error, please reply to this email.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
        <div style="font-size:13px;color:#666;line-height:1.6;">
          <p style="margin:0;"><strong>${p.companyName}</strong></p>
          ${p.companyAddress ? `<p style="margin:0;">${p.companyAddress}</p>` : ""}
          ${p.companyPhone ? `<p style="margin:0;">Phone: ${p.companyPhone}</p>` : ""}
          ${p.companyPhone2 ? `<p style="margin:0;">Alt Phone: ${p.companyPhone2}</p>` : ""}
          ${p.companyEmail ? `<p style="margin:0;">Email: ${p.companyEmail}</p>` : ""}
        </div>
      </div>
    </div>
  </body></html>`;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const body = (await req.json()) as RefundRequest;
    if (!body.invoice_ids?.length) throw new Error("invoice_ids is required");
    if (!body.reason?.trim()) throw new Error("reason is required");
    if (!body.refund_method?.trim()) throw new Error("refund_method is required");

    const refundDate = body.refund_date || new Date().toISOString();
    const suspend = body.suspend_lms !== false;

    // Fetch invoices
    const { data: invoices, error: invErr } = await supabase
      .from("invoices")
      .select("*")
      .in("id", body.invoice_ids);
    if (invErr || !invoices?.length) throw new Error(`Invoices not found: ${invErr?.message}`);

    const studentId = invoices[0].student_id;
    if (!invoices.every(i => i.student_id === studentId)) {
      throw new Error("All invoices must belong to the same student");
    }

    // Mark each invoice refunded
    const totalRefund = invoices.reduce((s, i) => s + Number(i.amount || 0), 0);
    for (const inv of invoices) {
      await supabase
        .from("invoices")
        .update({
          status: "refunded",
          refunded_at: refundDate,
          refund_amount: inv.amount,
          refund_reason: body.reason,
          refund_method: body.refund_method,
          refunded_by: body.performed_by || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", inv.id);
    }

    // Get student + user info
    const { data: student } = await supabase
      .from("students").select("user_id").eq("id", studentId).maybeSingle();
    const userId = student?.user_id;

    let studentName = "";
    let studentEmail = "";
    if (userId) {
      const { data: u } = await supabase
        .from("users").select("full_name, email").eq("id", userId).maybeSingle();
      studentName = u?.full_name || "";
      studentEmail = u?.email || "";
    }

    // Update enrollment payment_status to refunded
    const courseIds = [...new Set(invoices.map(i => i.course_id).filter(Boolean))];
    const pathwayIds = [...new Set(invoices.map(i => i.pathway_id).filter(Boolean))];
    if (courseIds.length) {
      await supabase.from("course_enrollments")
        .update({ payment_status: "refunded", updated_at: new Date().toISOString() })
        .eq("student_id", studentId).in("course_id", courseIds as string[]);
    }
    if (pathwayIds.length) {
      await supabase.from("course_enrollments")
        .update({ payment_status: "refunded", updated_at: new Date().toISOString() })
        .eq("student_id", studentId).in("pathway_id", pathwayIds as string[]);
    }

    // Suspend LMS access
    if (suspend && userId) {
      await supabase.from("users")
        .update({ lms_status: "suspended", status: "suspended", updated_at: new Date().toISOString() })
        .eq("id", userId);
      await supabase.from("students")
        .update({ fees_cleared: false, updated_at: new Date().toISOString() })
        .eq("id", studentId);
    }

    // Resolve enrollment name (course or pathway)
    const names: string[] = [];
    let resolvedCourseIds = [...courseIds];
    let resolvedPathwayIds = [...pathwayIds];

    // Fallback: derive from student's enrollments if invoices lack course/pathway ids
    if (!resolvedCourseIds.length && !resolvedPathwayIds.length) {
      const { data: enrolls } = await supabase
        .from("course_enrollments")
        .select("course_id, pathway_id")
        .eq("student_id", studentId);
      if (enrolls?.length) {
        resolvedCourseIds = [...new Set(enrolls.map(e => e.course_id).filter(Boolean))] as string[];
        resolvedPathwayIds = [...new Set(enrolls.map(e => e.pathway_id).filter(Boolean))] as string[];
      }
    }

    if (resolvedCourseIds.length) {
      const { data: c } = await supabase.from("courses").select("title").in("id", resolvedCourseIds as string[]);
      if (c?.length) names.push(...c.map(x => x.title).filter(Boolean));
    }
    if (resolvedPathwayIds.length) {
      const { data: p } = await supabase.from("learning_pathways").select("name").in("id", resolvedPathwayIds as string[]);
      if (p?.length) names.push(...p.map(x => x.name).filter(Boolean));
    }

    const enrollmentName = names.length ? names.join(", ") : "your enrollment";

    // Company settings
    const { data: company, error: companyErr } = await supabase
      .from("company_settings")
      .select("company_name, company_email, contact_email, primary_phone, secondary_phone, address, currency")
      .limit(1).maybeSingle();

    if (companyErr) console.error('[process-refund] Failed to load company_settings:', companyErr);

    const companyName = company?.company_name || "IDMPakistan";
    const companyEmail = company?.company_email || company?.contact_email || "";
    const companyPhone = company?.primary_phone || "";
    const companyPhone2 = company?.secondary_phone || "";
    const companyAddress = company?.address || "";
    const currency = company?.currency || "PKR";

    // Add note to student record (visible in Student Notes panel)
    if (userId) {
      const installmentList = invoices.map(i => `#${i.installment_number}`).join(", ");
      const noteText = `Refund processed: ${currencySymbol(currency)}${totalRefund.toLocaleString()} for installment(s) ${installmentList}. Method: ${body.refund_method}. Reason: ${body.reason}`;
      await supabase.from("user_activity_logs").insert({
        user_id: userId,
        activity_type: "admin_note",
        occurred_at: new Date().toISOString(),
        metadata: {
          note: noteText,
          created_by: body.performed_by || null,
          source: "refund",
          invoice_ids: body.invoice_ids,
          total_refund: totalRefund,
        },
      });
    }

    // Log to admin_logs
    await supabase.from("admin_logs").insert({
      performed_by: body.performed_by || null,
      entity_type: "invoice",
      entity_id: invoices[0].id,
      action: "invoice_refunded",
      description: `Refunded ${invoices.length} installment(s) totalling ${currencySymbol(currency)}${totalRefund} for ${studentEmail || studentId}`,
      data: {
        target_user_id: userId,
        student_id: studentId,
        invoice_ids: body.invoice_ids,
        installment_numbers: invoices.map(i => i.installment_number),
        total_refund: totalRefund,
        refund_method: body.refund_method,
        reason: body.reason,
        refund_date: refundDate,
        suspended: suspend,
      },
    });

    // Send confirmation email
    if (studentEmail) {
      const html = buildEmailHtml({
        studentName,
        totalAmount: totalRefund,
        currency,
        refundDate: new Date(refundDate).toLocaleDateString(),
        enrollmentName,
        refundMethod: body.refund_method,
        reason: body.reason,
        installmentNumbers: invoices.map(i => i.installment_number).sort((a, b) => a - b),
        companyName,
        companyEmail,
        companyPhone,
        companyPhone2,
        companyAddress,
        hasProof: !!body.proof_attachment,
      });
      const cc = Deno.env.get("BILLING_EMAIL_CC") || undefined;
      const attachments = body.proof_attachment
        ? [{
            filename: body.proof_attachment.filename,
            content: body.proof_attachment.content_base64,
            content_type: body.proof_attachment.content_type,
          }]
        : undefined;
      await sendEmail(studentEmail, `Refund Confirmation — ${companyName}`, html, cc, companyName, attachments);
    }

    return new Response(JSON.stringify({
      success: true,
      refunded_count: invoices.length,
      total_refund: totalRefund,
      student_id: studentId,
      user_id: userId,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  } catch (e) {
    console.error("Refund error:", e);
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
  }
};

serve(handler);
