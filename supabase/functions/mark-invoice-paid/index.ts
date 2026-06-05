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

interface PaymentProof {
  filename: string;
  content_base64: string;
  content_type: string;
}

interface MarkInvoicePaidRequest {
  invoice_id?: string;
  student_id?: string;
  installment_number?: number;
  amount?: number;
  due_date?: string;
  payment_date?: string;
  payment_method?: string;
  payment_notes?: string;
  payment_proof?: PaymentProof;
}

function base64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', INR: '₹', PKR: 'Rs ', CAD: 'C$', AUD: 'A$' };
const currencySymbol = (c?: string) => CURRENCY_SYMBOLS[(c || 'PKR').toUpperCase()] || `${c || ''} `;

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

    // Send payment receipt to the student (every paid invoice)
    try {
      const { data: userRec } = await supabase
        .from("users").select("email, full_name").eq("id", userId).maybeSingle();

      const { data: rs } = await supabase
        .from("company_settings")
        .select("company_name, company_logo, currency, contact_email, company_email, primary_phone, secondary_phone, lms_url, billing_email_cc, notification_email_cc")
        .eq("id", 1).maybeSingle();

      if (userRec?.email) {
        const companyName = rs?.company_name || 'Our Team';
        const logoUrl: string = rs?.company_logo || '';
        const supportEmail: string = rs?.contact_email || rs?.company_email || '';
        const supportPhone: string = rs?.primary_phone || rs?.secondary_phone || '';
        const currencyCode = rs?.currency || 'PKR';
        const cSym = currencySymbol(currencyCode);
        const firstName = (userRec.full_name || 'there').split(' ')[0];

        const primary = '#4f46e5';
        const primaryDark = '#3730a3';
        const text = '#0f172a';
        const subtext = '#475569';
        const border = '#e5e7eb';
        const bg = '#f4f6fb';
        const surface = '#ffffff';

        const paidAtDisplay = new Date(requestData.payment_date || now).toLocaleDateString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric'
        });
        const methodLabels: Record<string, string> = {
          bank_transfer: 'Bank Transfer', card: 'Card', cash: 'Cash', cheque: 'Cheque',
          online: 'Online Gateway', other: 'Other',
        };
        const methodLabel = requestData.payment_method ? (methodLabels[requestData.payment_method] || requestData.payment_method) : '—';
        const amountDisplay = `${cSym}${Number(invoice.amount || 0).toLocaleString()}`;
        const receiptNo = `RCPT-${String(invoiceId).slice(0, 8).toUpperCase()}`;
        const notesHtml = requestData.payment_notes ? escapeHtml(requestData.payment_notes) : '';
        const hasProof = !!requestData.payment_proof?.content_base64;

        const safeLogo = logoUrl && !logoUrl.startsWith('data:') ? logoUrl : '';
        const headerLogo = safeLogo
          ? `<img src="${escapeHtml(safeLogo)}" alt="${escapeHtml(companyName)}" height="40" style="display:block;height:40px;width:auto;border:0;outline:none;text-decoration:none;" />`
          : `<div style="color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;">${escapeHtml(companyName)}</div>`;

        const rowHtml = (label: string, value: string) => `
          <tr>
            <td style="padding:12px 0;border-bottom:1px solid ${border};font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${subtext};width:45%;">${escapeHtml(label)}</td>
            <td style="padding:12px 0;border-bottom:1px solid ${border};font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${text};font-weight:600;text-align:right;">${value}</td>
          </tr>`;

        const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Payment Receipt — ${escapeHtml(companyName)}</title></head>
<body style="margin:0;padding:0;background:${bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Receipt for your payment of ${amountDisplay} to ${escapeHtml(companyName)}.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${bg};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:${surface};border-radius:16px;overflow:hidden;box-shadow:0 6px 24px rgba(15,23,42,0.06);">
      <tr><td style="background:linear-gradient(135deg,${primaryDark} 0%,${primary} 100%);padding:24px 32px;">${headerLogo}</td></tr>
      <tr><td style="padding:36px 32px 8px;">
        <div style="display:inline-block;padding:6px 12px;background:#ecfdf5;color:#047857;border-radius:999px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:600;margin-bottom:14px;">✓ Payment Received</div>
        <h1 style="margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:1.25;color:${text};">Thank you, ${escapeHtml(firstName)}!</h1>
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:${subtext};">
          We've received your payment. This email is your official receipt — please keep it for your records.
        </p>
      </td></tr>
      <tr><td style="padding:24px 32px 8px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid ${border};border-radius:12px;background:#fafbff;">
          <tr><td style="padding:8px 22px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              ${rowHtml('Receipt No.', escapeHtml(receiptNo))}
              ${invoice.installment_number ? rowHtml('Installment', `#${invoice.installment_number}`) : ''}
              ${rowHtml('Payment Date', escapeHtml(paidAtDisplay))}
              ${rowHtml('Payment Method', escapeHtml(methodLabel))}
              ${notesHtml ? rowHtml('Notes', notesHtml) : ''}
              <tr>
                <td style="padding:16px 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${text};font-weight:700;">Amount Paid</td>
                <td style="padding:16px 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:20px;color:${primary};font-weight:800;text-align:right;">${escapeHtml(amountDisplay)}</td>
              </tr>
            </table>
          </td></tr>
        </table>
      </td></tr>
      ${hasProof ? `<tr><td style="padding:8px 32px 0;">
        <div style="padding:12px 16px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1e3a8a;">
          📎 A copy of your payment proof is attached to this email.
        </div>
      </td></tr>` : ''}
      ${(supportEmail || supportPhone) ? `<tr><td style="padding:20px 32px 28px;">
        <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${subtext};">Questions about this receipt?</p>
        ${supportEmail ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${text};">📧 <a href="mailto:${escapeHtml(supportEmail)}" style="color:${primary};text-decoration:none;">${escapeHtml(supportEmail)}</a></div>` : ''}
        ${supportPhone ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${text};">📞 <a href="tel:${escapeHtml(supportPhone.replace(/\\s+/g,''))}" style="color:${primary};text-decoration:none;">${escapeHtml(supportPhone)}</a></div>` : ''}
      </td></tr>` : ''}
      <tr><td style="padding:20px 32px 28px;border-top:1px solid ${border};background:#fafbff;">
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#94a3b8;">© ${new Date().getFullYear()} ${escapeHtml(companyName)}. All rights reserved.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

        try {
          const smtpClient = (SMTPClient as any).fromEnv();
          if (rs?.company_name) smtpClient.setFromName(rs.company_name);
          const billingCc = (rs as any)?.billing_email_cc || Deno.env.get('BILLING_EMAIL_CC') || (rs as any)?.notification_email_cc || Deno.env.get('NOTIFICATION_EMAIL_CC');
          const attachments = requestData.payment_proof ? [{
            filename: requestData.payment_proof.filename,
            content: base64ToUint8(requestData.payment_proof.content_base64),
            contentType: requestData.payment_proof.content_type || 'application/octet-stream',
          }] : undefined;
          await smtpClient.sendEmail({
            to: userRec.email,
            subject: `Payment Receipt ${receiptNo} — ${companyName}`,
            ...(billingCc ? { cc: billingCc } : {}),
            html,
            ...(attachments ? { attachments } : {}),
          });
          console.log(`✉️  Payment receipt sent to ${userRec.email}${attachments ? ' with proof attached' : ''}`);
        } catch (mailErr) {
          console.warn("Failed to send payment receipt:", mailErr);
        }
      }
    } catch (receiptErr) {
      console.warn("Payment receipt block failed:", receiptErr);
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
          const supportPhone: string = settings?.primary_phone || '';
          const supportPhone2: string = settings?.secondary_phone || '';
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

          const safeLogo = logoUrl && !logoUrl.startsWith('data:') ? logoUrl : '';
          const headerLogo = safeLogo
            ? `<img src="${escapeHtml(safeLogo)}" alt="${escapeHtml(companyName)}" height="40" style="display:block;height:40px;width:auto;border:0;outline:none;text-decoration:none;" />`
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

          const row = (label: string, value: string) => `
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid ${border};font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${subtext};width:40%;vertical-align:top;">${escapeHtml(label)}</td>
              <td style="padding:10px 0;border-bottom:1px solid ${border};font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${text};vertical-align:top;">${value}</td>
            </tr>`;

          const batchBlock = `<tr>
              <td style="padding:0 32px 8px;">
                <h2 style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:18px;color:${text};">🎓 Your Batch Details</h2>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 28px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid ${border};border-radius:12px;background:#fafbff;">
                  <tr><td style="padding:6px 20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      ${row('Batch', batchName ? escapeHtml(batchName) : naContact)}
                      ${row('Orientation Date', orientationDate ? escapeHtml(orientationDate) : naContact)}
                      ${row('WhatsApp Group', whatsappLink ? `<a href="${escapeHtml(whatsappLink)}" target="_blank" style="color:#16a34a;text-decoration:none;font-weight:600;">Join WhatsApp Group →</a>` : naContact)}
                      <tr>
                        <td style="padding:10px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${subtext};width:40%;vertical-align:top;">Facebook Community</td>
                        <td style="padding:10px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${text};vertical-align:top;">${facebookLink ? `<a href="${escapeHtml(facebookLink)}" target="_blank" style="color:#1d4ed8;text-decoration:none;font-weight:600;">Join Facebook Community →</a>` : naContact}</td>
                      </tr>
                    </table>
                  </td></tr>
                </table>
              </td>
            </tr>`;

          const supportBlock = (supportEmail || supportPhone || supportPhone2) ? `<tr>
              <td style="padding:0 32px 8px;">
                <h2 style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:18px;color:${text};">💬 Need Help? Contact Support</h2>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 28px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border:1px solid ${border};border-radius:12px;background:#fff7ed;">
                  <tr><td style="padding:18px 22px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${text};line-height:1.7;">
                    ${supportEmail ? `<div>📧 <strong>Email:</strong> <a href="mailto:${escapeHtml(supportEmail)}" style="color:${primary};text-decoration:none;">${escapeHtml(supportEmail)}</a></div>` : ''}
                    ${supportPhone ? `<div>📞 <strong>Phone:</strong> <a href="tel:${escapeHtml(supportPhone.replace(/\s+/g,''))}" style="color:${primary};text-decoration:none;">${escapeHtml(supportPhone)}</a></div>` : ''}
                    ${supportPhone2 ? `<div>📱 <strong>Alternate:</strong> <a href="tel:${escapeHtml(supportPhone2.replace(/\s+/g,''))}" style="color:${primary};text-decoration:none;">${escapeHtml(supportPhone2)}</a></div>` : ''}
                  </td></tr>
                </table>
              </td>
            </tr>` : '';

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

          ${batchBlock}
          ${videoBlock}
          ${docBlock}
          ${pointersBlock}
          ${supportBlock}
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
