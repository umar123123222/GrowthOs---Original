import { createClient } from "npm:@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---- Tunable thresholds (deliberately conservative) -------------------------
const THRESHOLDS = {
  WINDOW_MINUTES: 20,
  // Bulk sweep: many distinct lessons opened in the window with almost no heartbeats.
  BULK_DISTINCT_RECORDINGS: 10,
  BULK_MAX_HEARTBEAT_RATIO: 0.2, // heartbeats / opens
  // Same lesson re-opened over and over (stream URL harvesting / retry loops).
  REOPEN_SAME_RECORDING: 8,
  // Same account streaming from several networks at once (shared credentials).
  DISTINCT_IPS: 4,
  // Opens that never produced a single heartbeat.
  ZERO_HEARTBEAT_OPENS: 12,
};
// -----------------------------------------------------------------------------

function parseIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip");
}

type EventRow = {
  recording_id: string | null;
  event_type: string;
  ip_address: string | null;
  device_label: string | null;
  created_at: string;
};

function evaluate(events: EventRow[]) {
  const opens = events.filter((e) => e.event_type === "open");
  const heartbeats = events.filter((e) => e.event_type === "heartbeat");
  const distinctRecordings = new Set(opens.map((e) => e.recording_id).filter(Boolean));
  const distinctIps = new Set(events.map((e) => e.ip_address).filter(Boolean));

  const perRecording = new Map<string, number>();
  for (const o of opens) {
    if (!o.recording_id) continue;
    perRecording.set(o.recording_id, (perRecording.get(o.recording_id) ?? 0) + 1);
  }
  const maxReopens = Math.max(0, ...Array.from(perRecording.values()));

  const recordingsWithHeartbeat = new Set(heartbeats.map((h) => h.recording_id).filter(Boolean));
  const zeroHeartbeatOpens = Array.from(distinctRecordings).filter(
    (r) => !recordingsWithHeartbeat.has(r as string),
  ).length;

  const heartbeatRatio = opens.length ? heartbeats.length / opens.length : 1;

  const reasons: string[] = [];
  if (
    distinctRecordings.size >= THRESHOLDS.BULK_DISTINCT_RECORDINGS &&
    heartbeatRatio <= THRESHOLDS.BULK_MAX_HEARTBEAT_RATIO
  ) {
    reasons.push(
      `Opened ${distinctRecordings.size} different lessons in ${THRESHOLDS.WINDOW_MINUTES} minutes with almost no playback`,
    );
  }
  if (maxReopens >= THRESHOLDS.REOPEN_SAME_RECORDING) {
    reasons.push(`Re-opened the same lesson ${maxReopens} times in the window`);
  }
  if (distinctIps.size >= THRESHOLDS.DISTINCT_IPS) {
    reasons.push(`Active from ${distinctIps.size} different IP addresses simultaneously`);
  }
  if (zeroHeartbeatOpens >= THRESHOLDS.ZERO_HEARTBEAT_OPENS) {
    reasons.push(`${zeroHeartbeatOpens} lessons opened without a single playback heartbeat`);
  }

  return {
    flagged: reasons.length > 0,
    reasons,
    stats: {
      window_minutes: THRESHOLDS.WINDOW_MINUTES,
      opens: opens.length,
      heartbeats: heartbeats.length,
      distinct_recordings: distinctRecordings.size,
      distinct_ips: distinctIps.size,
      max_reopens_same_recording: maxReopens,
      zero_heartbeat_opens: zeroHeartbeatOpens,
      heartbeat_ratio: Number(heartbeatRatio.toFixed(2)),
    },
  };
}

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
    const callerId = claimsData.claims.sub as string;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const mode = body?.mode === "rescan" ? "rescan" : "self";

    // Only admins may run a rescan across all students.
    let targetIds: string[] = [callerId];
    if (mode === "rescan") {
      const { data: caller } = await admin
        .from("users")
        .select("role")
        .eq("id", callerId)
        .maybeSingle();
      if (!["admin", "superadmin"].includes(String(caller?.role))) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const since = new Date(Date.now() - THRESHOLDS.WINDOW_MINUTES * 60 * 1000).toISOString();
      const { data: recent } = await admin
        .from("video_access_events")
        .select("user_id")
        .gte("created_at", since)
        .limit(5000);
      targetIds = Array.from(new Set((recent || []).map((r) => r.user_id)));
    }

    const since = new Date(Date.now() - THRESHOLDS.WINDOW_MINUTES * 60 * 1000).toISOString();
    const nowIso = new Date().toISOString();
    const ip = parseIp(req);
    const flagged: Array<{ user_id: string; reasons: string[] }> = [];

    for (const userId of targetIds) {
      const { data: events } = await admin
        .from("video_access_events")
        .select("recording_id, event_type, ip_address, device_label, created_at")
        .eq("user_id", userId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1000);

      const result = evaluate((events || []) as EventRow[]);
      if (!result.flagged) continue;

      // Don't re-flag the same user repeatedly within the window.
      const { count: recentIncidents } = await admin
        .from("security_incidents")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("signal", "bulk_download_pattern")
        .gte("created_at", since);
      if ((recentIncidents ?? 0) > 0) continue;

      const { data: user } = await admin
        .from("users")
        .select("id, full_name, email, role, student_id")
        .eq("id", userId)
        .maybeSingle();

      // Never auto-suspend staff accounts on a behavioural signal.
      const isStaff = ["admin", "superadmin", "mentor", "enrollment_manager", "support_member"]
        .includes(String(user?.role));

      const { data: incident } = await admin
        .from("security_incidents")
        .insert({
          user_id: userId,
          signal: "bulk_download_pattern",
          severity: isStaff ? "high" : "critical",
          action_taken: isStaff ? "logged" : "suspended",
          user_agent: req.headers.get("user-agent"),
          device_label: (events || [])[0]?.device_label ?? null,
          ip_address: ip,
          page_url: null,
          metadata: {
            source: "detect-capture-patterns",
            reasons: result.reasons,
            stats: result.stats,
            thresholds: THRESHOLDS,
          },
        })
        .select("id")
        .maybeSingle();

      if (!isStaff) {
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

      await admin.from("admin_logs").insert([{
        performed_by: null,
        entity_type: "security",
        entity_id: userId,
        action: isStaff ? "security_warning" : "security_auto_suspended",
        description: isStaff
          ? "Security evidence logged — Bulk download / harvesting pattern detected"
          : "Account auto-suspended — Bulk download / harvesting pattern detected",
        data: {
          target_user_id: userId,
          signal: "bulk_download_pattern",
          signal_label: "Bulk download / harvesting pattern detected",
          action_taken: isStaff ? "logged" : "suspended",
          reasons: result.reasons,
          stats: result.stats,
          incident_id: incident?.id ?? null,
          timestamp: nowIso,
        },
      }]);

      flagged.push({ user_id: userId, reasons: result.reasons });
    }

    return new Response(
      JSON.stringify({ ok: true, scanned: targetIds.length, flagged }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
