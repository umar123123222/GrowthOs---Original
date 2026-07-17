import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

const toPakistanTimestamp = (date: Date): string => {
  const pakistanDate = new Date(date.getTime() + PKT_OFFSET_MS);
  return pakistanDate.toISOString().slice(0, 19);
};

const parsePakistanTimestamp = (timestamp: string): number => {
  const [datePart, timePart = "00:00:00"] = timestamp.replace(" ", "T").split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour = 0, minute = 0, second = 0] = timePart.split(":").map(Number);

  return Date.UTC(year, month - 1, day, hour, minute, second) - PKT_OFFSET_MS;
};

// Runs on a cron schedule. For each upcoming success_session whose start_time is
// within the next 3 hours and hasn't been reminded yet, sends an email reminder
// to all students in its batch_ids via send-batch-content-notification.
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Live session reminder emails are disabled.
  return new Response(
    JSON.stringify({ success: true, disabled: true, reminders_sent: 0 }),
    { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
  );

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    // success_sessions.start_time is stored as Pakistan local wall-clock time
    // (timestamp without time zone). Compare using PKT timestamps so reminders
    // are not sent hours late by treating local class times as UTC.
    const pakistanNow = toPakistanTimestamp(now);
    const pakistanWindowEnd = toPakistanTimestamp(new Date(now.getTime() + (3 * 60 + 15) * 60 * 1000));

    const { data: sessions, error } = await supabase
      .from("success_sessions")
      .select("id, title, description, mentor_name, mentor_id, link, start_time, status, batch_ids, batch_id, reminder_3h_sent_at")
      .in("status", ["upcoming", "live"])
      .is("reminder_3h_sent_at", null)
      .gt("start_time", pakistanNow)
      .lte("start_time", pakistanWindowEnd);

    if (error) throw error;

    let remindersSent = 0;
    const results: any[] = [];

    for (const s of sessions || []) {
      const batchIds: string[] = Array.isArray((s as any).batch_ids) && (s as any).batch_ids.length
        ? (s as any).batch_ids
        : (s as any).batch_id ? [(s as any).batch_id] : [];

      if (batchIds.length === 0) {
        // No batches: still mark sent to avoid re-processing
        await supabase
          .from("success_sessions")
          .update({ reminder_3h_sent_at: now.toISOString() } as any)
          .eq("id", s.id);
        continue;
      }

      const startMs = parsePakistanTimestamp((s as any).start_time);
      const minutesUntil = Math.max(0, Math.round((startMs - now.getTime()) / 60000));
      let reminderLabel = "Starting in ~3 hours";
      if (minutesUntil <= 15) reminderLabel = "Starting soon";
      else if (minutesUntil <= 45) reminderLabel = "Starting in ~30 minutes";
      else if (minutesUntil <= 90) reminderLabel = "Starting in ~1 hour";
      else if (minutesUntil <= 150) reminderLabel = "Starting in ~2 hours";

      for (const [index, batchId] of batchIds.entries()) {
        if (!batchId) continue;
        try {
          await supabase.functions.invoke("send-batch-content-notification", {
            body: {
              batch_id: batchId,
              item_type: "LIVE_SESSION",
              item_id: s.id,
              title: s.title,
              description: s.description,
              meeting_link: s.link,
              start_datetime: s.start_time,
              mentor_name: s.mentor_name,
              mentor_id: (s as any).mentor_id || undefined,
              cta_path: "/live-sessions",
              is_reminder: true,
              reminder_label: reminderLabel,
              include_mentor: index === 0,
            },
          });
        } catch (e: any) {
          console.error(`Reminder send failed for session ${s.id}, batch ${batchId}:`, e?.message || e);
        }
      }

      await supabase
        .from("success_sessions")
        .update({ reminder_3h_sent_at: now.toISOString() } as any)
        .eq("id", s.id);

      remindersSent++;
      results.push({ session_id: s.id, batches: batchIds.length });
    }

    return new Response(
      JSON.stringify({ success: true, reminders_sent: remindersSent, results }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: any) {
    console.error("Error in success-session-reminder:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
