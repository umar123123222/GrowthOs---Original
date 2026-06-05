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
          .select("company_name, company_logo, lms_url, contact_email, company_email, primary_phone, secondary_phone, onboarding_video_url, onboarding_video_enabled, onboarding_document_url, onboarding_document_name, onboarding_pointers")
          .eq("id", 1)
          .maybeSingle();

        // Find the student's batch via their most recent course enrollment with a batch
        let batchInfo: { name?: string; start_date?: string | null; whatsapp_group_link?: string | null; facebook_community_link?: string | null } | null = null;
        try {
          const { data: enrol } = await supabase
            .from("course_enrollments")
            .select("batch_id, batches:batch_id(name, start_date, whatsapp_group_link, facebook_community_link)")
            .eq("student_id", invoice.student_id)
            .not("batch_id", "is", null)
            .order("enrolled_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (enrol && (enrol as any).batches) batchInfo = (enrol as any).batches;
        } catch (_e) { /* ignore */ }

        if (userRec?.email) {
          const companyName = settings?.company_name || 'Our Team';
          const logoUrl: string = settings?.company_logo || '';
          const lmsUrl: string = settings?.lms_url || '';
          const supportEmail: string = settings?.contact_email || settings?.company_email || '';
          const supportPhone: string = settings?.primary_phone || settings?.secondary_phone || '';
          const videoUrl: string = settings?.onboarding_video_url || '';
          const videoEnabled: boolean = settings?.onboarding_video_enabled ?? true;
          const docUrl: string = settings?.onboarding_document_url || '';
          const docName: string = settings?.onboarding_document_name || 'Onboarding Document';
          const pointers: string[] = Array.isArray(settings?.onboarding_pointers)
            ? (settings!.onboarding_pointers as string[]).filter((p: string) => p && p.trim() !== '')
            : [];

          const naContact = `Not available — please contact support${supportEmail ? ` at <a href="mailto:${escapeHtml(supportEmail)}" style="color:#4f46e5;text-decoration:none;">${escapeHtml(supportEmail)}</a>` : ''}.`;
          const batchName = batchInfo?.name || '';
          const orientationDate = batchInfo?.start_date
            ? new Date(batchInfo.start_date as string).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
            : '';
          const whatsappLink = batchInfo?.whatsapp_group_link || '';
          const facebookLink = batchInfo?.facebook_community_link || '';

          // Brand tokens
          const primary = '#4f46e5';      // indigo-600
          const primaryDark = '#3730a3';  // indigo-800
          const bg = '#f4f6fb';
          const surface = '#ffffff';
          const text = '#0f172a';
          const subtext = '#475569';
          const border = '#e5e7eb';

          const firstName = (userRec.full_name || 'there').split(' ')[0];

          const headerLogo = logoUrl
            ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(companyName)}" height="40" style="display:block;height:40px;width:auto;border:0;outline:none;text-decoration:none;" />`
            : `<div style="color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;letter-spacing:0.3px;">${escapeHtml(companyName)}</div>`;

          const videoBlock = videoEnabled && videoUrl
            ? `<tr>
                 <td style="padding:0 32px 8px;">
                   <h2 style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:18px;color:${text};">🎬 Welcome Video</h2>
                   <p style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${subtext};line-height:1.55;">A quick intro to get you up and running.</p>
                 </td>
               </tr>
               <tr>
                 <td style="padding:0 32px 28px;">
                   ${buildVideoCard(videoUrl, primary)}
                 </td>
               </tr>`
            : '';

          const docBlock = docUrl
            ? `<tr>
                 <td style="padding:0 32px 28px;">
                   <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border:1px solid ${border};border-radius:12px;background:#fafbff;">
                     <tr>
                       <td style="padding:20px 22px;" valign="middle">
                         <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                           <tr>
                             <td width="48" valign="top" style="padding-right:14px;">
                               <div style="width:44px;height:44px;border-radius:10px;background:${primary};color:#ffffff;text-align:center;line-height:44px;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:700;">📄</div>
                             </td>
                             <td valign="middle">
                               <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:0.6px;text-transform:uppercase;color:${subtext};margin-bottom:2px;">Onboarding Document</div>
                               <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:${text};font-weight:600;word-break:break-word;">${escapeHtml(docName)}</div>
                             </td>
                             <td align="right" valign="middle" style="padding-left:12px;">
                               <a href="${escapeHtml(docUrl)}" target="_blank" style="display:inline-block;padding:10px 18px;background:${primary};color:#ffffff;text-decoration:none;border-radius:8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:600;white-space:nowrap;">Download</a>
                             </td>
                           </tr>
                         </table>
                       </td>
                     </tr>
                   </table>
                 </td>
               </tr>`
            : '';

          const pointersBlock = pointers.length > 0
            ? `<tr>
                 <td style="padding:0 32px 8px;">
                   <h2 style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:18px;color:${text};">📌 Important Points to Note</h2>
                 </td>
               </tr>
               <tr>
                 <td style="padding:0 32px 28px;">
                   <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
                     ${pointers.map((p, i) => `
                       <tr>
                         <td style="padding:0 0 10px;">
                           <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f8fafc;border:1px solid ${border};border-radius:10px;">
                             <tr>
                               <td width="36" valign="top" style="padding:14px 0 14px 16px;">
                                 <div style="width:26px;height:26px;border-radius:26px;background:${primary};color:#ffffff;text-align:center;line-height:26px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;">${i + 1}</div>
                               </td>
                               <td valign="middle" style="padding:14px 16px 14px 12px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${text};line-height:1.55;">
                                 ${escapeHtml(p)}
                               </td>
                             </tr>
                           </table>
                         </td>
                       </tr>`).join('')}
                   </table>
                 </td>
               </tr>`
            : '';

          const ctaBlock = lmsUrl
            ? `<tr>
                 <td align="center" style="padding:0 32px 32px;">
                   <a href="${escapeHtml(lmsUrl)}" target="_blank" style="display:inline-block;padding:14px 32px;background:${primary};color:#ffffff;text-decoration:none;border-radius:10px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;box-shadow:0 4px 14px rgba(79,70,229,0.35);">Go to Your Dashboard →</a>
                 </td>
               </tr>`
            : '';

          const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light" />
  <title>Welcome to ${escapeHtml(companyName)}</title>
</head>
<body style="margin:0;padding:0;background:${bg};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Your enrollment is confirmed — here's everything you need to get started.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${bg};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:${surface};border-radius:16px;overflow:hidden;box-shadow:0 6px 24px rgba(15,23,42,0.06);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,${primaryDark} 0%,${primary} 100%);padding:24px 32px;">
              ${headerLogo}
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td style="padding:36px 32px 8px;">
              <div style="display:inline-block;padding:6px 12px;background:#ecfdf5;color:#047857;border-radius:999px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:600;letter-spacing:0.3px;margin-bottom:14px;">✓ Payment Confirmed</div>
              <h1 style="margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:26px;line-height:1.25;color:${text};">Welcome aboard, ${escapeHtml(firstName)}! 🎉</h1>
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:${subtext};">
                Your enrollment with <strong style="color:${text};">${escapeHtml(companyName)}</strong> is now active. Here's everything you need to get started.
              </p>
            </td>
          </tr>

          <tr><td style="padding:24px 32px 8px;"><div style="height:1px;background:${border};line-height:1px;font-size:0;">&nbsp;</div></td></tr>

          ${videoBlock}
          ${docBlock}
          ${pointersBlock}
          ${ctaBlock}

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid ${border};background:#fafbff;">
              <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${subtext};line-height:1.6;">
                Need help? Just reply to this email — we're here for you.
              </p>
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#94a3b8;">
                © ${new Date().getFullYear()} ${escapeHtml(companyName)}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;


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
