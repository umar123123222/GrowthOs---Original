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
  picture_in_picture: "Picture-in-Picture capture",
  bulk_download_pattern: "Bulk download / harvesting pattern detected",
  devtools: "Developer tools opened",
  screenshot_key: "Screenshot / capture keyboard shortcut used",
};

// Signals that identify a real offender -> immediate suspension (no warning).
const HARD_SIGNALS = new Set([
  "screen_capture",
  "extension",
  "picture_in_picture",
  "bulk_download_pattern",
]);

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
    const pageUrl = body?.page_url ? String(body.page_url) : null;
    const deviceLabel = body?.device_label ? String(body.device_label) : null;
    const metadata = (body?.metadata && typeof body.metadata === "object") ? body.metadata : {};

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: user } = await admin
      .from("users")
      .select("id, full_name, email, role, lms_status")
      .eq("id", userId)
      .maybeSingle();

    const { data: studentRow } = await admin
      .from("students")
      .select("student_id, lms_username")
      .eq("user_id", userId)
      .maybeSingle();
    const studentId = studentRow?.student_id || "-";


    const { count: priorHard } = await admin
      .from("security_incidents")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("signal", Array.from(HARD_SIGNALS));

    const isHard = HARD_SIGNALS.has(signal);
    // Detection-first policy: any hard signal suspends immediately, first time.
    const shouldSuspend = isHard;
    const action = shouldSuspend ? "suspended" : "logged";
    const ip = parseIp(req);
    const nowIso = new Date().toISOString();

    // Recent access pattern summary attached as evidence.
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: recentEvents } = await admin
      .from("video_access_events")
      .select("recording_id, event_type, ip_address, created_at")
      .eq("user_id", userId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(200);

    const evidence = {
      recent_window_minutes: 30,
      recent_opens: (recentEvents || []).filter((e) => e.event_type === "open").length,
      distinct_recordings: new Set((recentEvents || []).map((e) => e.recording_id)).size,
      distinct_ips: new Set((recentEvents || []).map((e) => e.ip_address).filter(Boolean)).size,
      last_recording_id: recentEvents?.[0]?.recording_id ?? null,
    };

    const { data: incident } = await admin
      .from("security_incidents")
      .insert({
        user_id: userId,
        signal,
        severity: shouldSuspend ? "critical" : "warning",
        action_taken: action,
        user_agent: req.headers.get("user-agent"),
        device_label: deviceLabel,
        ip_address: ip,
        page_url: pageUrl,
        metadata: {
          ...metadata,
          prior_hard_offences: priorHard ?? 0,
          access_pattern: evidence,
        },
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
      : `Security evidence logged — ${signalLabel}`;

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
        action_taken: action,
        device_label: deviceLabel,
        ip_address: ip,
        page_url: pageUrl,
        evidence,
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
            <h2 style="margin:0 0 12px">${shouldSuspend ? "Account auto-suspended" : "Security evidence logged"}</h2>
            <p>${signalLabel} was detected on an active LMS session.</p>
            <table cellpadding="6" style="border-collapse:collapse;margin-top:12px">
              <tr><td><b>User</b></td><td>${user?.full_name || studentRow?.lms_username || "Unknown"}</td></tr>
              <tr><td><b>Email</b></td><td>${user?.email || "-"}</td></tr>
              <tr><td><b>Student ID</b></td><td>${studentId}</td></tr>

              <tr><td><b>Role</b></td><td>${user?.role || "-"}</td></tr>
              <tr><td><b>Signal</b></td><td>${signalLabel}</td></tr>
              <tr><td><b>Action taken</b></td><td>${shouldSuspend ? "Suspended + signed out on all devices" : "Logged as evidence only"}</td></tr>
              <tr><td><b>Device</b></td><td>${deviceLabel || "-"}</td></tr>
              <tr><td><b>IP</b></td><td>${ip || "-"}</td></tr>
              <tr><td><b>Page</b></td><td>${pageUrl || "-"}</td></tr>
              <tr><td><b>Recent opens (30m)</b></td><td>${evidence.recent_opens} across ${evidence.distinct_recordings} lessons, ${evidence.distinct_ips} IP(s)</td></tr>
              <tr><td><b>Time</b></td><td>${nowIso}</td></tr>
            </table>
          </div>`;
        await resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to,
          subject: `${shouldSuspend ? "[SUSPENDED]" : "[EVIDENCE]"} ${signalLabel} — ${user?.full_name || user?.email || userId}${studentId !== "-" ? ` (${studentId})` : ""}`,
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
