import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.55.0";
import { SMTPClient } from "../_shared/smtp-client.ts";

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1) || null;
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v');
      if (v) return v;
      if (u.pathname.startsWith('/embed/')) return u.pathname.split('/')[2] || null;
      if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2] || null;
    }
  } catch { /* noop */ }
  return null;
}

function buildVideoCard(url: string, primary: string): string {
  // Email clients (Gmail, Outlook) strip <iframe>. Use a thumbnail image with a play overlay
  // that links to the video instead — this is the standard pattern for video-in-email.
  const ytId = getYouTubeId(url);
  const thumb = ytId
    ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
    : '';

  const playBadge = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
      <tr>
        <td align="center" style="background:${primary};color:#ffffff;width:64px;height:64px;border-radius:64px;font-size:28px;line-height:64px;font-family:Arial,Helvetica,sans-serif;">
          ▶
        </td>
      </tr>
    </table>`;

  if (thumb) {
    return `
      <a href="${escapeHtml(url)}" target="_blank" style="text-decoration:none;display:block;border-radius:12px;overflow:hidden;background:#000;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
          <tr>
            <td background="${thumb}" style="background-image:url('${thumb}');background-size:cover;background-position:center;background-repeat:no-repeat;height:320px;text-align:center;vertical-align:middle;border-radius:12px;">
              <img src="${thumb}" alt="Watch the welcome video" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;border-radius:12px;" />
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:14px 0 0;">
              <a href="${escapeHtml(url)}" target="_blank" style="display:inline-block;padding:12px 24px;background:${primary};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-family:Arial,Helvetica,sans-serif;font-size:14px;">▶ Watch the Welcome Video</a>
            </td>
          </tr>
        </table>
      </a>`;
  }

  // Generic fallback — branded "play" card linking out
  return `
    <a href="${escapeHtml(url)}" target="_blank" style="text-decoration:none;display:block;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border:1px solid #e5e7eb;border-radius:12px;background:linear-gradient(135deg,#0f172a 0%,${primary} 100%);">
        <tr>
          <td align="center" style="padding:60px 24px;">
            ${playBadge}
            <p style="margin:18px 0 0;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:600;">Watch the Welcome Video</p>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-family:Arial,Helvetica,sans-serif;font-size:13px;">Click to open in a new tab</p>
          </td>
        </tr>
      </table>
    </a>`;
}





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
    console.log("Processing payment request:", JSON.stringify(requestData));

    let invoice: any;
    let invoiceId: string;

    // Find or create invoice
    if (requestData.invoice_id) {
      const { data, error } = await supabase
        .from("invoices").select("*").eq("id", requestData.invoice_id).single();
      if (error || !data) throw new Error(`Invoice not found: ${error?.message || 'No data'}`);
      invoice = data;
      invoiceId = invoice.id;
    } else if (requestData.student_id && requestData.installment_number) {
      const { data: existing, error: findError } = await supabase
        .from("invoices").select("*")
        .eq("student_id", requestData.student_id)
        .eq("installment_number", requestData.installment_number)
        .maybeSingle();
      if (findError) throw new Error(`Failed to find invoice: ${findError.message}`);

      if (existing) {
        invoice = existing;
        invoiceId = existing.id;
      } else {
        const { data: newInvoice, error: createError } = await supabase
          .from("invoices")
          .insert({
            student_id: requestData.student_id,
            installment_number: requestData.installment_number,
            amount: requestData.amount || 100,
            due_date: requestData.due_date || new Date().toISOString(),
            status: "issued"
          })
          .select().single();
        if (createError || !newInvoice) throw new Error(`Failed to create invoice: ${createError?.message}`);
        invoice = newInvoice;
        invoiceId = newInvoice.id;
      }
    } else {
      throw new Error("Must provide either invoice_id or (student_id + installment_number)");
    }

    // Get user_id
    const { data: studentData, error: studentError } = await supabase
      .from("students").select("user_id").eq("id", invoice.student_id).single();
    if (studentError || !studentData) throw new Error(`Student not found: ${studentError?.message}`);
    const userId = studentData.user_id;

    const now = new Date().toISOString();

    // Mark invoice as paid
    const { error: updateErr } = await supabase
      .from("invoices")
      .update({ status: "paid", paid_at: now, updated_at: now })
      .eq("id", invoiceId);
    if (updateErr) throw new Error(`Failed to update invoice: ${updateErr.message}`);
    console.log("Invoice marked as paid");

    // Update enrollment payment status if linked to course/pathway
    if (invoice.course_id || invoice.pathway_id) {
      let enrollmentQuery = supabase.from("invoices").select("id, status, amount").eq("student_id", invoice.student_id);
      if (invoice.course_id) enrollmentQuery = enrollmentQuery.eq("course_id", invoice.course_id);
      else enrollmentQuery = enrollmentQuery.eq("pathway_id", invoice.pathway_id);

      const { data: enrollmentInvoices } = await enrollmentQuery;
      if (enrollmentInvoices) {
        const paidInvoices = enrollmentInvoices.filter(inv => inv.status === "paid").length;
        const totalAmount = enrollmentInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
        const paidAmount = enrollmentInvoices.filter(inv => inv.status === "paid").reduce((sum, inv) => sum + (inv.amount || 0), 0);
        const paymentStatus = paidInvoices === 0 ? "pending" : paidInvoices === enrollmentInvoices.length ? "paid" : "partial";

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
    } else {
      await supabase.from("students").update({ fees_cleared: true, updated_at: now }).eq("id", invoice.student_id);
    }

    // Activate user account
    await supabase.from("users").update({ status: "active", lms_status: "active", last_active_at: now }).eq("id", userId);

    // Log payment to admin_logs with target_user_id
    await supabase.from("admin_logs").insert({
      performed_by: null,
      entity_type: "invoice",
      entity_id: invoiceId,
      action: "invoice_paid",
      description: `Invoice #${invoice.installment_number || ''} marked as paid`,
      data: {
        target_user_id: userId,
        student_id: invoice.student_id,
        amount: invoice.amount,
        installment_number: invoice.installment_number,
        course_id: invoice.course_id || null,
        pathway_id: invoice.pathway_id || null,
      }
    });

    // Notify the student (in-app)
    try {
      await supabase.from("notifications").insert({
        user_id: userId,
        type: "invoice_paid",
        template_key: "invoice_paid",
        channel: "in_app",
        status: "sent",
        sent_at: now,
        payload: {
          title: `Fee payment confirmed${invoice.installment_number ? ` (Installment #${invoice.installment_number})` : ''}`,
          message: `Your payment of ${invoice.amount ?? ''} has been recorded. Thank you!`,
          data: {
            invoice_id: invoiceId,
            amount: invoice.amount,
            installment_number: invoice.installment_number ?? null,
            course_id: invoice.course_id || null,
            pathway_id: invoice.pathway_id || null,
          },
        },
      });
    } catch (notifErr) {
      console.warn("Failed to insert invoice_paid notification:", notifErr);
    }

    // Send onboarding welcome email when this is the student's FIRST paid invoice
    try {
      const { count: paidCount } = await supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("student_id", invoice.student_id)
        .eq("status", "paid");

      if ((paidCount ?? 0) === 1) {
        const { data: userRec } = await supabase
          .from("users")
          .select("email, full_name")
          .eq("id", userId)
          .maybeSingle();

        const { data: settings } = await supabase
          .from("company_settings")
          .select("company_name, onboarding_video_url, onboarding_video_enabled, onboarding_document_url, onboarding_document_name, onboarding_pointers")
          .eq("id", 1)
          .maybeSingle();

        if (userRec?.email) {
          const companyName = settings?.company_name || 'Our Team';
          const videoUrl: string = settings?.onboarding_video_url || '';
          const videoEnabled: boolean = settings?.onboarding_video_enabled ?? true;
          const docUrl: string = settings?.onboarding_document_url || '';
          const docName: string = settings?.onboarding_document_name || 'Onboarding Document';
          const pointers: string[] = Array.isArray(settings?.onboarding_pointers)
            ? (settings!.onboarding_pointers as string[]).filter((p: string) => p && p.trim() !== '')
            : [];

          const videoSection = videoEnabled && videoUrl ? buildVideoSection(videoUrl) : '';
          const docSection = docUrl
            ? `<div style="margin:24px 0;">
                 <h3 style="margin-bottom:8px;">Onboarding Document</h3>
                 <p style="margin:0 0 8px;">Please review the attached document:</p>
                 <p><a href="${escapeHtml(docUrl)}" style="display:inline-block;padding:10px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">📎 ${escapeHtml(docName)}</a></p>
               </div>`
            : '';
          const pointersSection = pointers.length > 0
            ? `<div style="margin:24px 0;">
                 <h3 style="margin-bottom:8px;">Important Points to Note</h3>
                 <ul style="padding-left:20px;line-height:1.7;">
                   ${pointers.map(p => `<li>${escapeHtml(p)}</li>`).join('')}
                 </ul>
               </div>`
            : '';

          const html = `
            <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color:#111;">
              <h2 style="color:#111;">Welcome to ${escapeHtml(companyName)}, ${escapeHtml(userRec.full_name || 'Student')}! 🎉</h2>
              <p>Your payment has been confirmed and your enrollment is now active. We're excited to have you on board!</p>
              ${videoSection}
              ${docSection}
              ${pointersSection}
              <p style="margin-top:32px;">If you have any questions, just reply to this email.</p>
              <p style="color:#666;font-size:13px;margin-top:24px;">— The ${escapeHtml(companyName)} Team</p>
            </div>`;

          try {
            const smtpClient = (SMTPClient as any).fromEnv();
            if (settings?.company_name) smtpClient.setFromName(settings.company_name);
            const notificationCc = Deno.env.get('NOTIFICATION_EMAIL_CC');
            await smtpClient.sendEmail({
              to: userRec.email,
              subject: `Welcome to ${companyName} — Let's Get Started`,
              ...(notificationCc ? { cc: notificationCc } : {}),
              html,
            });
            console.log(`✉️  Onboarding welcome email sent to ${userRec.email}`);
          } catch (mailErr) {
            console.warn("Failed to send onboarding welcome email:", mailErr);
          }
        }
      }
    } catch (welcomeErr) {
      console.warn("Onboarding welcome email block failed:", welcomeErr);
    }

    console.log(`✅ Payment processed - Invoice: ${invoiceId}, User: ${userId}`);


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
