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

    // PostgREST caps a plain select at 1000 rows — page through everything,
    // otherwise students beyond the first page look like they have no invoices.
    const fetchAll = async (
      table: string,
      columns: string,
      apply?: (q: any) => any,
    ) => {
      const out: any[] = [];
      const PAGE = 1000;
      for (let from = 0; ; from += PAGE) {
        let q = supabase.from(table).select(columns).range(from, from + PAGE - 1);
        if (apply) q = apply(q);
        const { data, error } = await q;
        if (error) throw error;
        out.push(...(data ?? []));
        if (!data || data.length < PAGE) break;
      }
      return out;
    };

    // Pull ALL enrollments (any status). Completed enrollments still own their
    // invoices — filtering to 'active' made every paid+completed student look
    // like they had orphan invoices and zero expected total.
    const allEnrollments = await fetchAll(
      "course_enrollments",
      "id, student_id, course_id, pathway_id, total_amount, status, snapshot_price, snapshot_currency, snapshot_source",
    );
    // Counted toward "expected": active + completed.
    const enrollments = allEnrollments.filter((e) =>
      ["active", "completed"].includes(String(e.status)),
    );
    // Duplicate / phantom checks only look at live (active) enrollments.
    const activeEnrollments = allEnrollments.filter((e) => String(e.status) === "active");


    // Pull catalog prices for snapshot-vs-current comparison
    const [courses, pathways] = await Promise.all([
      fetchAll("courses", "id, price, currency"),
      fetchAll("learning_pathways", "id, price, currency"),
    ]);
    const coursePrice = new Map<string, number>();
    for (const c of courses ?? []) if (c.price != null) coursePrice.set(c.id as string, Number(c.price));
    const pathwayPrice = new Map<string, number>();
    for (const p of pathways ?? []) if (p.price != null) pathwayPrice.set(p.id as string, Number(p.price));

    // Pull all invoices (paged)
    const invoices = await fetchAll(
      "invoices",
      "student_id, course_id, pathway_id, amount, status",
    );


    // Relaxed matching: an enrollment's invoices are matched by pathway when the
    // enrollment has a pathway (invoices for pathways often carry course_id = NULL),
    // otherwise by course. The old strict student::course::pathway key produced
    // false "actual = 0" drift for fully-paid pathway students.
    const pKey = (s: string, p: string) => `p::${s}::${p}`;
    const cKey = (s: string, c: string) => `c::${s}::${c}`;

    const invByPathway = new Map<string, number>();
    const invByCourse = new Map<string, number>();
    const paidByStudent = new Map<string, number>();
    const unpaidByStudent = new Map<string, number>();
    for (const inv of invoices ?? []) {
      const sid = inv.student_id as string;
      const amt = Number(inv.amount ?? 0);
      if (inv.pathway_id) {
        const k = pKey(sid, inv.pathway_id as string);
        invByPathway.set(k, (invByPathway.get(k) ?? 0) + amt);
      } else if (inv.course_id) {
        const k = cKey(sid, inv.course_id as string);
        invByCourse.set(k, (invByCourse.get(k) ?? 0) + amt);
      }
      if ((inv.status as string) === "paid") {
        paidByStudent.set(sid, (paidByStudent.get(sid) ?? 0) + amt);
      } else {
        unpaidByStudent.set(sid, (unpaidByStudent.get(sid) ?? 0) + amt);
      }
    }

    // Aggregate expected by student (sum of enrollment.total_amount for active ones)
    // AND actual by student (sum of matching invoices).
    const expectedByStudent = new Map<string, number>();
    const actualByStudent = new Map<string, number>();
    const detailsByStudent = new Map<string, any[]>();

    for (const e of enrollments ?? []) {
      const s = e.student_id as string;
      const expected = Number(e.total_amount ?? 0);
      const actual = e.pathway_id
        ? invByPathway.get(pKey(s, e.pathway_id as string)) ?? 0
        : e.course_id
          ? invByCourse.get(cKey(s, e.course_id as string)) ?? 0
          : 0;

      expectedByStudent.set(s, (expectedByStudent.get(s) ?? 0) + expected);
      actualByStudent.set(s, (actualByStudent.get(s) ?? 0) + actual);

      const snap = e.snapshot_price != null ? Number(e.snapshot_price) : null;
      const catalog = e.pathway_id
        ? pathwayPrice.get(e.pathway_id as string) ?? null
        : e.course_id
          ? coursePrice.get(e.course_id as string) ?? null
          : null;
      // Only flag when the snapshot no longer matches the CURRENT catalog price
      // (i.e. the catalog changed after enrollment). A total_amount below the
      // snapshot is a legitimate negotiated discount, not drift.
      const snapshot_mismatch =
        snap != null && catalog != null && Math.abs(snap - catalog) > TOLERANCE;

      const arr = detailsByStudent.get(s) ?? [];
      arr.push({
        enrollment_id: e.id,
        course_id: e.course_id,
        pathway_id: e.pathway_id,
        enrollment_status: e.status ?? null,
        expected,
        actual,
        difference: +(actual - expected).toFixed(2),
        snapshot_price: snap,
        catalog_price: catalog,
        snapshot_source: e.snapshot_source ?? null,
        snapshot_mismatch,
      });
      detailsByStudent.set(s, arr);
    }



    // Orphan invoices: UNPAID invoices that match no enrollment of any status
    // under the relaxed (pathway-first, else course) rule. A paid invoice is
    // money already collected — it is never "extra billing" to clean up.
    const knownPathwayKeys = new Set<string>();
    const knownCourseKeys = new Set<string>();
    for (const e of allEnrollments ?? []) {
      const s = e.student_id as string;
      if (e.pathway_id) knownPathwayKeys.add(pKey(s, e.pathway_id as string));
      if (e.course_id) knownCourseKeys.add(cKey(s, e.course_id as string));
    }
    const orphanByStudent = new Map<string, number>();
    for (const inv of invoices ?? []) {
      if ((inv.status as string) === "paid") continue;
      const sid = inv.student_id as string;
      const matched = inv.pathway_id
        ? knownPathwayKeys.has(pKey(sid, inv.pathway_id as string))
        : inv.course_id
          ? knownCourseKeys.has(cKey(sid, inv.course_id as string))
          : false;
      if (!matched) {
        orphanByStudent.set(sid, (orphanByStudent.get(sid) ?? 0) + Number(inv.amount ?? 0));
      }
    }


    // Detect duplicate enrollments per (student, pathway) and per (student, course, no pathway)
    const dupGroups = new Map<string, { kind: "pathway" | "course"; target_id: string; ids: string[] }>();
    for (const e of activeEnrollments ?? []) {

      const s = e.student_id as string;
      let dk: string | null = null;
      let kind: "pathway" | "course" | null = null;
      let target: string | null = null;
      if (e.pathway_id) {
        dk = `p::${s}::${e.pathway_id}`;
        kind = "pathway";
        target = e.pathway_id as string;
      } else if (e.course_id) {
        dk = `c::${s}::${e.course_id}`;
        kind = "course";
        target = e.course_id as string;
      }
      if (!dk || !kind || !target) continue;
      const g = dupGroups.get(dk) ?? { kind, target_id: target, ids: [] };
      g.ids.push(e.id as string);
      dupGroups.set(dk, g);
    }
    const duplicatesByStudent = new Map<string, any[]>();
    for (const [k, g] of dupGroups) {
      if (g.ids.length < 2) continue;
      const s = k.split("::")[1];
      const arr = duplicatesByStudent.get(s) ?? [];
      arr.push({ kind: g.kind, target_id: g.target_id, count: g.ids.length, enrollment_ids: g.ids });
      duplicatesByStudent.set(s, arr);
    }

    // Detect phantom course enrollments: student is enrolled in a pathway AND
    // separately enrolled as 'direct' in a course that belongs to that same
    // pathway. These are the extra invoices that were causing the 55k -> 120k
    // inflation. Read-only detection here — reconcile step deletes them.
    const pathwayCourseRows = await fetchAll(
      "pathway_courses",
      "pathway_id, course_id",
    );

    const coursesByPathway = new Map<string, Set<string>>();
    for (const r of pathwayCourseRows ?? []) {
      const set = coursesByPathway.get(r.pathway_id as string) ?? new Set<string>();
      set.add(r.course_id as string);
      coursesByPathway.set(r.pathway_id as string, set);
    }

    const enrollmentsByStudent = new Map<string, any[]>();
    for (const e of activeEnrollments ?? []) {

      const arr = enrollmentsByStudent.get(e.student_id as string) ?? [];
      arr.push(e);
      enrollmentsByStudent.set(e.student_id as string, arr);
    }
    const phantomByStudent = new Map<string, any[]>();
    for (const [s, list] of enrollmentsByStudent) {
      const pathwayIds = list
        .filter((e) => e.pathway_id)
        .map((e) => e.pathway_id as string);
      if (pathwayIds.length === 0) continue;
      const coveredCourses = new Set<string>();
      for (const pid of pathwayIds) {
        for (const cid of coursesByPathway.get(pid) ?? []) coveredCourses.add(cid);
      }
      const phantoms = list.filter(
        (e) => !e.pathway_id && e.course_id && coveredCourses.has(e.course_id as string),
      );
      if (phantoms.length > 0) {
        phantomByStudent.set(
          s,
          phantoms.map((e) => ({
            enrollment_id: e.id,
            course_id: e.course_id,
            total_amount: Number(e.total_amount ?? 0),
          })),
        );
      }
    }


    // Close previously-open findings that no longer drift (auto-resolve as "cleared")
    const openFindings = await fetchAll(
      "billing_drift_findings",
      "id, student_id",
      (q) => q.eq("status", "open"),
    );


    const findingsToInsert: any[] = [];
    const studentIds = new Set<string>([
      ...expectedByStudent.keys(),
      ...orphanByStudent.keys(),
      ...duplicatesByStudent.keys(),
      ...phantomByStudent.keys(),
    ]);

    for (const s of studentIds) {
      const expected = expectedByStudent.get(s) ?? 0;
      const actual = actualByStudent.get(s) ?? 0;
      const orphan = orphanByStudent.get(s) ?? 0;
      const diff = +(actual + orphan - expected).toFixed(2);
      const perEnr = detailsByStudent.get(s) ?? [];
      const hasSnapshotMismatch = perEnr.some((d: any) => d.snapshot_mismatch);
      const dupes = duplicatesByStudent.get(s) ?? [];
      const hasDuplicates = dupes.length > 0;
      const phantoms = phantomByStudent.get(s) ?? [];
      const hasPhantoms = phantoms.length > 0;
      const unpaid = unpaidByStudent.get(s) ?? 0;
      const paid = paidByStudent.get(s) ?? 0;
      // Skip students who are fully cleared: no unpaid invoices AND paid amount covers expected.
      // (expected may legitimately be 0 for completed enrollments already paid off.)
      // Exception: phantom enrollments are always flagged so admins can clean them up.
      const fullyCleared = unpaid <= TOLERANCE && paid + TOLERANCE >= expected;
      if (fullyCleared && !hasPhantoms) continue;

      if (
        Math.abs(diff) <= TOLERANCE &&
        orphan <= TOLERANCE &&
        !hasSnapshotMismatch &&
        !hasDuplicates &&
        !hasPhantoms
      ) continue;

      findingsToInsert.push({
        student_id: s,
        expected_total: expected,
        actual_total: actual + orphan,
        difference: diff,
        details: {
          per_enrollment: perEnr,
          enrollment_statuses: Array.from(
            new Set(perEnr.map((d: any) => d.enrollment_status).filter(Boolean)),
          ),
          orphan_invoice_total: orphan,
          paid_total: paid,
          unpaid_total: unpaid,
          snapshot_mismatch: hasSnapshotMismatch,
          duplicate_enrollments: dupes,
          has_duplicate_enrollments: hasDuplicates,
          phantom_course_enrollments: phantoms,
          has_phantom_course_enrollments: hasPhantoms,
        },

        status: "open",
      });
    }



    // Insert new findings (dedupe against existing open ones for the same student)
    const openByStudent = new Map<string, string>();
    for (const f of openFindings ?? []) openByStudent.set(f.student_id, f.id);

    const fresh = findingsToInsert.filter((f) => !openByStudent.has(f.student_id));
    const stale = findingsToInsert.filter((f) => openByStudent.has(f.student_id));

    let inserted = 0;
    if (fresh.length > 0) {
      const { error: insErr } = await supabase
        .from("billing_drift_findings")
        .insert(fresh);
      if (insErr) throw insErr;
      inserted = fresh.length;
    }

    // Refresh numbers on existing open findings so stale snapshots are never shown.
    // Batched upsert (one request per 200 rows) — a per-row loop was too slow and
    // caused the function to be shut down mid-scan.
    let refreshed = 0;
    if (stale.length > 0) {
      const rows = stale.map((f) => ({
        id: openByStudent.get(f.student_id)!,
        student_id: f.student_id,
        expected_total: f.expected_total,
        actual_total: f.actual_total,
        difference: f.difference,
        details: f.details,
        status: "open",
      }));
      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200);
        const { error: refErr } = await supabase
          .from("billing_drift_findings")
          .upsert(chunk, { onConflict: "id" });
        if (!refErr) refreshed += chunk.length;
      }
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
      const ids = toResolve.map((f: any) => f.id);
      for (let i = 0; i < ids.length; i += 100) {
        const chunk = ids.slice(i, i + 100);
        const { error: updErr } = await supabase
          .from("billing_drift_findings")
          .update({
            status: "auto_cleared",
            resolved_at: new Date().toISOString(),
            notes: "Auto-resolved: drift no longer detected",
          })
          .in("id", chunk);
        if (updErr) throw updErr;
        resolved += chunk.length;
      }
    }


    return json({
      ok: true,
      scanned_students: studentIds.size,
      drifting_students: findingsToInsert.length,
      inserted_findings: inserted,
      refreshed_findings: refreshed,
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
