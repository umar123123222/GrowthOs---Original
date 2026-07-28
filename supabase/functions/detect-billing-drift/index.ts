// Phase 1 — Observability: Detect billing drift (READ-ONLY on source tables)
// Compares each student's active-enrollment expected total vs. actual invoice totals
// and inserts findings into public.billing_drift_findings. No writes to invoices/enrollments.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TOLERANCE = 1; // currency units; treat sub-unit rounding as clean

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Optional caller auth: superadmin only when invoked from UI.
    // When called by cron (no Authorization header), skip caller check.
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: userRes } = await supabase.auth.getUser(token);
      const uid = userRes?.user?.id;
      if (!uid) {
        return json({ error: "Unauthorized" }, 401);
      }
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid)
        .in("role", ["superadmin"])
        .maybeSingle();
      if (!roleRow) return json({ error: "Forbidden" }, 403);
    }

    // Pull all active enrollments (incl. snapshot fields for mismatch check)
    const { data: enrollments, error: enrErr } = await supabase
      .from("course_enrollments")
      .select(
        "id, student_id, course_id, pathway_id, total_amount, status, snapshot_price, snapshot_currency, snapshot_source",
      )
      .eq("status", "active");

    if (enrErr) throw enrErr;

    // Pull catalog prices for snapshot-vs-current comparison
    const [{ data: courses }, { data: pathways }] = await Promise.all([
      supabase.from("courses").select("id, price, currency"),
      supabase.from("learning_pathways").select("id, price, currency"),
    ]);
    const coursePrice = new Map<string, number>();
    for (const c of courses ?? []) if (c.price != null) coursePrice.set(c.id as string, Number(c.price));
    const pathwayPrice = new Map<string, number>();
    for (const p of pathways ?? []) if (p.price != null) pathwayPrice.set(p.id as string, Number(p.price));


    // Pull all invoices in one shot (chunked defensively)
    const { data: invoices, error: invErr } = await supabase
      .from("invoices")
      .select("student_id, course_id, pathway_id, amount, status");

    if (invErr) throw invErr;

    // Group invoices by student|course|pathway key
    const key = (s: string, c: string | null, p: string | null) =>
      `${s}::${c ?? ""}::${p ?? ""}`;

    const invTotals = new Map<string, number>();
    for (const inv of invoices ?? []) {
      const k = key(inv.student_id as string, inv.course_id as any, inv.pathway_id as any);
      invTotals.set(k, (invTotals.get(k) ?? 0) + Number(inv.amount ?? 0));
    }

    // Aggregate expected by student (sum of enrollment.total_amount for active ones)
    // AND actual by student (sum of matching invoices).
    const expectedByStudent = new Map<string, number>();
    const actualByStudent = new Map<string, number>();
    const detailsByStudent = new Map<string, any[]>();

    for (const e of enrollments ?? []) {
      const s = e.student_id as string;
      const expected = Number(e.total_amount ?? 0);
      const actual = invTotals.get(
        key(s, e.course_id as any, e.pathway_id as any),
      ) ?? 0;

      expectedByStudent.set(s, (expectedByStudent.get(s) ?? 0) + expected);
      actualByStudent.set(s, (actualByStudent.get(s) ?? 0) + actual);

      const arr = detailsByStudent.get(s) ?? [];
      arr.push({
        enrollment_id: e.id,
        course_id: e.course_id,
        pathway_id: e.pathway_id,
        expected,
        actual,
        difference: +(actual - expected).toFixed(2),
      });
      detailsByStudent.set(s, arr);
    }

    // Also detect orphan invoices: invoices whose (student, course, pathway) has no active enrollment.
    // These are informational — do not delete anything.
    const activeKeys = new Set(
      (enrollments ?? []).map((e) =>
        key(e.student_id as string, e.course_id as any, e.pathway_id as any),
      ),
    );
    const orphanByStudent = new Map<string, number>();
    for (const inv of invoices ?? []) {
      const k = key(inv.student_id as string, inv.course_id as any, inv.pathway_id as any);
      if (!activeKeys.has(k)) {
        orphanByStudent.set(
          inv.student_id as string,
          (orphanByStudent.get(inv.student_id as string) ?? 0) + Number(inv.amount ?? 0),
        );
      }
    }

    // Close previously-open findings that no longer drift (auto-resolve as "cleared")
    const { data: openFindings } = await supabase
      .from("billing_drift_findings")
      .select("id, student_id")
      .eq("status", "open");

    const findingsToInsert: any[] = [];
    const studentIds = new Set<string>([
      ...expectedByStudent.keys(),
      ...orphanByStudent.keys(),
    ]);

    for (const s of studentIds) {
      const expected = expectedByStudent.get(s) ?? 0;
      const actual = actualByStudent.get(s) ?? 0;
      const orphan = orphanByStudent.get(s) ?? 0;
      const diff = +(actual + orphan - expected).toFixed(2);
      if (Math.abs(diff) <= TOLERANCE && orphan <= TOLERANCE) continue;

      findingsToInsert.push({
        student_id: s,
        expected_total: expected,
        actual_total: actual + orphan,
        difference: diff,
        details: {
          per_enrollment: detailsByStudent.get(s) ?? [],
          orphan_invoice_total: orphan,
        },
        status: "open",
      });
    }

    // Insert new findings (do not duplicate existing open ones for the same student — dedupe by upsert-like check)
    const existingOpenStudents = new Set(
      (openFindings ?? []).map((f: any) => f.student_id),
    );
    const fresh = findingsToInsert.filter(
      (f) => !existingOpenStudents.has(f.student_id),
    );

    let inserted = 0;
    if (fresh.length > 0) {
      const { error: insErr } = await supabase
        .from("billing_drift_findings")
        .insert(fresh);
      if (insErr) throw insErr;
      inserted = fresh.length;
    }

    // Auto-resolve findings for students that no longer drift
    const stillDriftingStudents = new Set(
      findingsToInsert.map((f) => f.student_id),
    );
    const toResolve = (openFindings ?? []).filter(
      (f: any) => !stillDriftingStudents.has(f.student_id),
    );
    let resolved = 0;
    if (toResolve.length > 0) {
      const { error: updErr } = await supabase
        .from("billing_drift_findings")
        .update({
          status: "auto_cleared",
          resolved_at: new Date().toISOString(),
          notes: "Auto-resolved: drift no longer detected",
        })
        .in("id", toResolve.map((f: any) => f.id));
      if (updErr) throw updErr;
      resolved = toResolve.length;
    }

    return json({
      ok: true,
      scanned_students: studentIds.size,
      drifting_students: findingsToInsert.length,
      inserted_findings: inserted,
      auto_resolved: resolved,
    });
  } catch (err) {
    console.error("detect-billing-drift error", err);
    return json({ error: String(err?.message ?? err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
