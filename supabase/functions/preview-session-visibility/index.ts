// Phase 5 — Preview which students would see a Success Session BEFORE saving.
// Read-only. Uses the same visibility rules as LiveSessions.tsx / student RLS:
//
//  - No course selected (course_id null): ALL active students see it (global).
//  - Course selected + batch_ids empty/null: all active students enrolled in that
//    course see it (global-per-course).
//  - Course selected + batch_ids includes real batch UUIDs: students enrolled in
//    that course whose active enrollment.batch_id matches see it.
//  - Course selected + batch_ids includes 'unbatched': students enrolled in the
//    course with a NULL batch_id AND enrolled_at strictly before start_time see it.
//
// Superadmin/admin/enrollment_manager only. No writes. No emails.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: userRes } = await admin.auth.getUser(token);
    const uid = userRes?.user?.id;
    if (!uid) return json({ error: "Unauthorized" }, 401);

    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", uid);
    const allowed = new Set(["superadmin", "admin", "enrollment_manager"]);
    if (!(roles ?? []).some((r) => allowed.has(r.role))) {
      return json({ error: "Forbidden" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const course_id: string | null = body.course_id || null;
    const rawBatchIds = Array.isArray(body.batch_ids) ? body.batch_ids : [];
    const batch_ids: string[] = rawBatchIds
      .filter((x: unknown) => typeof x === "string" && x.length > 0)
      .filter((x: string) => x !== "__all__");
    const start_time: string | null = body.start_time || null;
    const startMs = start_time ? new Date(start_time).getTime() : null;

    // Fetch active enrollments; optionally scoped to course.
    let enrollQ = admin
      .from("course_enrollments")
      .select("student_id, course_id, batch_id, enrolled_at, status")
      .eq("status", "active");
    if (course_id) enrollQ = enrollQ.eq("course_id", course_id);

    const { data: enrollments, error: enrollErr } = await enrollQ;
    if (enrollErr) return json({ error: enrollErr.message }, 500);

    const hasBatchTargeting = batch_ids.length > 0;
    const includesUnbatched = batch_ids.includes("unbatched");
    const realBatchIds = new Set(batch_ids.filter((b) => b !== "unbatched"));

    // Match student rows against session targeting rules.
    type Row = { student_id: string; batch_id: string | null; enrolled_at: string | null };
    const matched: Row[] = [];
    const seen = new Set<string>();
    for (const e of enrollments ?? []) {
      if (!e.student_id) continue;
      // De-dup by (student_id + batch_id) so a student enrolled twice in the
      // same course under one batch counts once.
      const key = `${e.student_id}::${e.batch_id ?? "null"}`;
      let visible = false;

      if (!course_id) {
        // Global session — every active enrollment qualifies once per student.
        if (seen.has(e.student_id)) continue;
        seen.add(e.student_id);
        matched.push({ student_id: e.student_id, batch_id: e.batch_id, enrolled_at: e.enrolled_at });
        continue;
      }

      if (!hasBatchTargeting) {
        // Course selected, no batch filter -> all enrolled in course.
        visible = true;
      } else {
        if (e.batch_id && realBatchIds.has(e.batch_id)) {
          visible = true;
        } else if (!e.batch_id && includesUnbatched) {
          // Unbatched rule: strictly enrolled BEFORE start_time.
          if (startMs && e.enrolled_at && new Date(e.enrolled_at).getTime() < startMs) {
            visible = true;
          } else if (!startMs && e.enrolled_at) {
            // No start_time provided yet — show potential unbatched matches.
            visible = true;
          }
        }
      }

      if (visible && !seen.has(key)) {
        seen.add(key);
        matched.push({ student_id: e.student_id, batch_id: e.batch_id, enrolled_at: e.enrolled_at });
      }
    }

    if (matched.length === 0) {
      return json({ total: 0, groups: [], students: [] });
    }

    // Resolve student -> user (name, email) and batch names.
    const studentIds = Array.from(new Set(matched.map((m) => m.student_id)));
    const batchIdsToLookup = Array.from(
      new Set(matched.map((m) => m.batch_id).filter((b): b is string => !!b)),
    );

    const [{ data: students }, { data: batches }] = await Promise.all([
      admin
        .from("students")
        .select("id, user_id, users:users!students_user_id_fkey(id, full_name, email, lms_status)")
        .in("id", studentIds),
      batchIdsToLookup.length
        ? admin.from("batches").select("id, name").in("id", batchIdsToLookup)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ]);

    const studentMap = new Map<string, { full_name: string | null; email: string | null; lms_status: string | null }>();
    for (const s of students ?? []) {
      const u: any = Array.isArray((s as any).users) ? (s as any).users[0] : (s as any).users;
      studentMap.set(s.id, {
        full_name: u?.full_name ?? null,
        email: u?.email ?? null,
        lms_status: u?.lms_status ?? null,
      });
    }
    const batchMap = new Map<string, string>();
    for (const b of batches ?? []) batchMap.set(b.id, b.name);

    const enriched = matched
      .map((m) => {
        const u = studentMap.get(m.student_id);
        return {
          student_id: m.student_id,
          full_name: u?.full_name ?? "(unknown)",
          email: u?.email ?? "",
          lms_status: u?.lms_status ?? null,
          batch_id: m.batch_id,
          batch_name: m.batch_id ? (batchMap.get(m.batch_id) ?? m.batch_id) : "Unbatched",
          enrolled_at: m.enrolled_at,
        };
      })
      .sort((a, b) => {
        // Group by batch name, then by student name.
        const bn = a.batch_name.localeCompare(b.batch_name);
        if (bn !== 0) return bn;
        return (a.full_name || "").localeCompare(b.full_name || "");
      });

    const groupsMap = new Map<string, { key: string; label: string; count: number }>();
    for (const r of enriched) {
      const key = r.batch_id ?? "unbatched";
      const label = r.batch_name;
      const g = groupsMap.get(key);
      if (g) g.count += 1;
      else groupsMap.set(key, { key, label, count: 1 });
    }

    return json({
      total: enriched.length,
      groups: Array.from(groupsMap.values()).sort((a, b) => b.count - a.count),
      students: enriched,
    });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
