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

function parseIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip");
}

const SIGNAL_LABELS: Record<string, string> = {
  screen_capture: "Screen capture / recording API active",
  extension: "Known downloader / recorder extension detected",
  devtools: "Developer tools opened",
  screenshot_key: "Screenshot / capture keyboard shortcut used",
  picture_in_picture: "Picture-in-Picture capture",
};

// Signals that count as a real offence (2 offences => suspend).
const HARD_SIGNALS = new Set(["screen_capture", "extension", "picture_in_picture"]);

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
    const userId = claimsData.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const signal = String(body?.signal || "unknown");
    const phase = body?.phase === "expired" ? "expired" : "detected"; // 'detected' = countdown started, 'expired' = timer ran out
    const pageUrl = body?.page_url ? String(body.page_url) : null;
    const deviceLabel = body?.device_label ? String(body.device_label) : null;
    const metadata = (body?.metadata && typeof body.metadata === "object") ? body.metadata : {};

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: user } = await admin
      .from("users")
      .select("id, full_name, email, role, student_id, lms_status")
      .eq("id", userId)
      .maybeSingle();

    // Count prior hard offences for this user (screen capture / extension).
    const { count: priorHard } = await admin
      .from("security_incidents")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("signal", Array.from(HARD_SIGNALS));

    const isHard = HARD_SIGNALS.has(signal);
    // Suspend when: the 5s countdown expired, or this is a repeat hard offence.
    const shouldSuspend = phase === "expired" || (isHard && (priorHard ?? 0) >= 1);
    const action = shouldSuspend ? "suspended" : "warned";
    const ip = parseIp(req);
    const nowIso = new Date().toISOString();

    const { data: incident } = await admin
      .from("security_incidents")
      .insert({
        user_id: userId,
        signal,
        severity: shouldSuspend ? "critical" : (isHard ? "high" : "warning"),
        action_taken: action,
        user_agent: req.headers.get("user-agent"),
        device_label: deviceLabel,
        ip_address: ip,
        page_url: pageUrl,
        metadata: { ...metadata, phase, prior_hard_offences: priorHard ?? 0 },
      })
      .select("id")
      .maybeSingle();

    if (shouldSuspend) {
      await admin
        .from("users")
        .update({ lms_status: "suspended", sessions_revoked_at: nowIso })
        .eq("id", userId);
      await admin
        .from("student_sessions")
        .update({ ended_at: nowIso })
        .eq("user_id", userId)
        .is("ended_at", null);
    }

    const signalLabel = SIGNAL_LABELS[signal] || signal;
    const description = shouldSuspend
      ? `Account auto-suspended — ${signalLabel}`
      : `Security warning — ${signalLabel}`;

    await admin.from("admin_logs").insert([{
      performed_by: null,
      entity_type: "security",
      entity_id: userId,
      action: shouldSuspend ? "security_auto_suspended" : "security_warning",
      description,
      data: {
        target_user_id: userId,
        signal,
        signal_label: signalLabel,
        phase,
        action_taken: action,
        device_label: deviceLabel,
        ip_address: ip,
        page_url: pageUrl,
        incident_id: incident?.id ?? null,
        timestamp: nowIso,
      },
    }]);

    // Alert email to the general notification address in company settings.
    try {
      const { data: settings } = await admin
        .from("company_settings")
        .select("notification_email_cc, company_name")
        .maybeSingle();

      const to = (settings?.notification_email_cc || Deno.env.get("NOTIFICATION_EMAIL_CC") || "")
        .split(",")
        .map((e: string) => sanitizeEmail(e))
        .filter(Boolean);

      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      const rawFrom = Deno.env.get("SMTP_FROM_EMAIL");
      const fromEmail = rawFrom ? sanitizeEmail(rawFrom) : "";
      const fromName = Deno.env.get("SMTP_FROM_NAME") || settings?.company_name || "LMS Security";

      if (to.length && resendApiKey && fromEmail) {
        const resend = new Resend(resendApiKey);
        const html = `
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111">
            <h2 style="margin:0 0 12px">${shouldSuspend ? "Account auto-suspended" : "Screen capture warning"}</h2>
            <p>${signalLabel} was detected on an active LMS session.</p>
            <table cellpadding="6" style="border-collapse:collapse;margin-top:12px">
              <tr><td><b>User</b></td><td>${user?.full_name || "Unknown"}</td></tr>
              <tr><td><b>Email</b></td><td>${user?.email || "-"}</td></tr>
              <tr><td><b>Student ID</b></td><td>${user?.student_id || "-"}</td></tr>
              <tr><td><b>Role</b></td><td>${user?.role || "-"}</td></tr>
              <tr><td><b>Signal</b></td><td>${signalLabel}</td></tr>
              <tr><td><b>Action taken</b></td><td>${shouldSuspend ? "Suspended + signed out on all devices" : "5-second warning shown"}</td></tr>
              <tr><td><b>Device</b></td><td>${deviceLabel || "-"}</td></tr>
              <tr><td><b>IP</b></td><td>${ip || "-"}</td></tr>
              <tr><td><b>Page</b></td><td>${pageUrl || "-"}</td></tr>
              <tr><td><b>Time</b></td><td>${nowIso}</td></tr>
            </table>
          </div>`;
        await resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to,
          subject: `${shouldSuspend ? "[SUSPENDED]" : "[WARNING]"} ${signalLabel} — ${user?.full_name || user?.email || userId}`,
          html,
        });
      }
    } catch (mailErr) {
      console.error("security alert email failed", mailErr);
    }

    return new Response(
      JSON.stringify({ ok: true, action, suspended: shouldSuspend, offences: (priorHard ?? 0) + (isHard ? 1 : 0) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
