import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Runs on a cron schedule. For each upcoming success_session whose start_time is
// within the next 3 hours and hasn't been reminded yet, sends an email reminder
// to all students in its batch_ids via send-batch-content-notification.
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    // window: sessions starting in (now, now + 3h15m] so we catch a session
    // crossing the 3h mark even if cron runs at coarse intervals.
    const windowEnd = new Date(now.getTime() + (3 * 60 + 15) * 60 * 1000);

    const { data: sessions, error } = await supabase
      .from("success_sessions")
      .select("id, title, description, mentor_name, link, start_time, status, batch_ids, batch_id, reminder_3h_sent_at")
      .in("status", ["upcoming", "live"])
      .is("reminder_3h_sent_at", null)
      .gt("start_time", now.toISOString())
      .lte("start_time", windowEnd.toISOString());

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

      for (const batchId of batchIds) {
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
              cta_path: "/live-sessions",
              is_reminder: true,
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
