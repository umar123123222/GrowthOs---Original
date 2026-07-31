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

/**
 * Manual-only warning email. Triggered by an admin clicking "Send warning email"
 * in the security signals dashboard. Nothing in this system sends automatically
 * and nothing here changes the student's account state.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const actorId = claimsData.claims.sub as string;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: actor } = await admin
      .from("users")
      .select("id, role, full_name, email")
      .eq("id", actorId)
      .maybeSingle();

    if (!actor || !["admin", "superadmin"].includes(String(actor.role))) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const studentId = String(body?.student_id || "");
    const note = body?.note ? String(body.note) : "";
    const signalSummary = body?.signal_summary ? String(body.signal_summary) : "";

    if (!studentId) {
      return new Response(JSON.stringify({ error: "student_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: student } = await admin
      .from("users")
      .select("id, full_name, email, student_id")
      .eq("id", studentId)
      .maybeSingle();

    if (!student?.email) {
      return new Response(JSON.stringify({ error: "Student email not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: settings } = await admin
      .from("company_settings")
      .select("company_name, notification_email_cc")
      .maybeSingle();

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const rawFrom = Deno.env.get("SMTP_FROM_EMAIL");
    const fromEmail = rawFrom ? sanitizeEmail(rawFrom) : "";
    const fromName = Deno.env.get("SMTP_FROM_NAME") || settings?.company_name || "LMS";

    if (!resendApiKey || !fromEmail) {
      return new Response(JSON.stringify({ error: "Email is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111">
        <p>Hi ${student.full_name || "there"},</p>
        <p>We noticed unusual activity on your account during recent lesson playback.
        Recording, capturing or downloading course content is a violation of our terms of use.</p>
        ${signalSummary ? `<p style="color:#555"><b>What we observed:</b> ${signalSummary}</p>` : ""}
        ${note ? `<p>${note}</p>` : ""}
        <p>If this was a misunderstanding, please reply to this email and we will review it with you.</p>
        <p>— ${settings?.company_name || fromName}</p>
      </div>`;

    const cc = (settings?.notification_email_cc || "")
      .split(",")
      .map((e: string) => sanitizeEmail(e))
      .filter(Boolean);

    const resend = new Resend(resendApiKey);
    const sent = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [student.email],
      cc: cc.length ? cc : undefined,
      subject: "Notice about course content usage",
      html,
    });

    await admin.from("admin_logs").insert([{
      performed_by: actorId,
      entity_type: "security",
      entity_id: studentId,
      action: "security_warning_email_sent",
      description: `Manual content-usage warning email sent to ${student.email}`,
      data: {
        target_user_id: studentId,
        signal_summary: signalSummary,
        note,
        timestamp: new Date().toISOString(),
      },
    }]);

    return new Response(JSON.stringify({ ok: true, id: (sent as { data?: { id?: string } })?.data?.id ?? null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-capture-warning-email failed", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
