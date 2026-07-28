// Phase 4 — Manual reconciliation of billing drift findings.
// Superadmin-only. Every action snapshots pre-state so it can be undone within 7 days.
//
// Action types:
//  - delete_orphan_invoices: hard-delete UNPAID invoices whose (student, course, pathway)
//    has no active enrollment. Paid invoices are never touched.
//  - resync_enrollment_total: set course_enrollments.total_amount = snapshot_price
//    for a specific enrollment. Does NOT touch invoices or LMS access.
//  - mark_duplicate_enrollment: soft-flag one enrollment row's status to 'duplicate_flagged'
//    so admins can review before deletion. Never deletes.
//
// Undo: reverses the exact rows captured in before_state, allowed for 7 days.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UNDO_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

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

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .eq("role", "superadmin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Forbidden — superadmin only" }, 403);

    const body = await req.json().catch(() => ({}));
    const op = String(body.op ?? "");

    if (op === "undo") {
      return await undoAction(admin, uid, body.action_id);
    }

    const action_type = String(body.action_type ?? "");
    const finding_id = body.finding_id ?? null;
    const student_id = String(body.student_id ?? "");
    if (!student_id) return json({ error: "student_id required" }, 400);

    if (action_type === "delete_orphan_invoices") {
      return await deleteOrphanInvoices(admin, uid, { finding_id, student_id });
    }
    if (action_type === "resync_enrollment_total") {
      const enrollment_id = String(body.enrollment_id ?? "");
      if (!enrollment_id) return json({ error: "enrollment_id required" }, 400);
      return await resyncEnrollmentTotal(admin, uid, { finding_id, student_id, enrollment_id });
    }
    if (action_type === "mark_duplicate_enrollment") {
      const enrollment_id = String(body.enrollment_id ?? "");
      if (!enrollment_id) return json({ error: "enrollment_id required" }, 400);
      return await markDuplicate(admin, uid, { finding_id, student_id, enrollment_id });
    }
    if (action_type === "remove_phantom_enrollment") {
      const enrollment_id = String(body.enrollment_id ?? "");
      if (!enrollment_id) return json({ error: "enrollment_id required" }, 400);
      return await removePhantomEnrollment(admin, uid, { finding_id, student_id, enrollment_id });
    }

    return json({ error: "Unknown action_type" }, 400);
  } catch (err) {
    console.error("reconcile-billing-finding error", err);
    return json({ error: String((err as any)?.message ?? err) }, 500);
  }
});

async function deleteOrphanInvoices(
  admin: any,
  uid: string,
  { finding_id, student_id }: { finding_id: string | null; student_id: string },
) {
  const { data: enrollments } = await admin
    .from("course_enrollments")
    .select("student_id, course_id, pathway_id")
    .eq("student_id", student_id)
    .eq("status", "active");

  const activeKeys = new Set(
    (enrollments ?? []).map((e: any) => `${e.course_id ?? ""}::${e.pathway_id ?? ""}`),
  );

  const { data: invs } = await admin
    .from("invoices")
    .select("*")
    .eq("student_id", student_id);

  const orphansUnpaid = (invs ?? []).filter((i: any) => {
    const k = `${i.course_id ?? ""}::${i.pathway_id ?? ""}`;
    return !activeKeys.has(k) && String(i.status ?? "").toLowerCase() !== "paid";
  });

  if (orphansUnpaid.length === 0) {
    return json({ ok: true, deleted: 0, message: "No unpaid orphan invoices to delete." });
  }

  const ids = orphansUnpaid.map((i: any) => i.id);
  const { error: delErr } = await admin.from("invoices").delete().in("id", ids);
  if (delErr) throw delErr;

  const { data: action, error: logErr } = await admin
    .from("billing_reconciliation_actions")
    .insert({
      finding_id,
      student_id,
      action_type: "delete_orphan_invoices",
      performed_by: uid,
      before_state: { invoices: orphansUnpaid },
      after_state: { deleted_ids: ids },
    })
    .select("id")
    .single();
  if (logErr) throw logErr;

  return json({ ok: true, deleted: ids.length, action_id: action.id });
}

async function resyncEnrollmentTotal(
  admin: any,
  uid: string,
  { finding_id, student_id, enrollment_id }: any,
) {
  const { data: before, error: readErr } = await admin
    .from("course_enrollments")
    .select("*")
    .eq("id", enrollment_id)
    .eq("student_id", student_id)
    .maybeSingle();
  if (readErr) throw readErr;
  if (!before) return json({ error: "Enrollment not found" }, 404);
  if (before.snapshot_price == null) {
    return json({ error: "No snapshot_price on this enrollment — cannot resync." }, 400);
  }

  const newTotal = Number(before.snapshot_price);
  const { error: updErr } = await admin
    .from("course_enrollments")
    .update({ total_amount: newTotal })
    .eq("id", enrollment_id);
  if (updErr) throw updErr;

  const { data: action, error: logErr } = await admin
    .from("billing_reconciliation_actions")
    .insert({
      finding_id,
      student_id,
      action_type: "resync_enrollment_total",
      performed_by: uid,
      before_state: { enrollment: before },
      after_state: { total_amount: newTotal },
    })
    .select("id")
    .single();
  if (logErr) throw logErr;

  return json({ ok: true, enrollment_id, total_amount: newTotal, action_id: action.id });
}

async function markDuplicate(
  admin: any,
  uid: string,
  { finding_id, student_id, enrollment_id }: any,
) {
  const { data: before, error: readErr } = await admin
    .from("course_enrollments")
    .select("*")
    .eq("id", enrollment_id)
    .eq("student_id", student_id)
    .maybeSingle();
  if (readErr) throw readErr;
  if (!before) return json({ error: "Enrollment not found" }, 404);

  const { error: updErr } = await admin
    .from("course_enrollments")
    .update({ status: "duplicate_flagged" })
    .eq("id", enrollment_id);
  if (updErr) throw updErr;

  const { data: action, error: logErr } = await admin
    .from("billing_reconciliation_actions")
    .insert({
      finding_id,
      student_id,
      action_type: "mark_duplicate_enrollment",
      performed_by: uid,
      before_state: { enrollment: before },
      after_state: { status: "duplicate_flagged" },
    })
    .select("id")
    .single();
  if (logErr) throw logErr;

  return json({ ok: true, enrollment_id, action_id: action.id });
}

async function removePhantomEnrollment(
  admin: any,
  uid: string,
  { finding_id, student_id, enrollment_id }: any,
) {
  // Safety: only remove a course_enrollment when
  //   (a) enrollment_source = 'direct' AND pathway_id IS NULL, AND
  //   (b) the student has ANOTHER active pathway enrollment whose pathway
  //       contains this course (i.e. it truly is a phantom duplicate).
  // Also delete only UNPAID invoices for that (student, course, no pathway) key.
  const { data: before, error: readErr } = await admin
    .from("course_enrollments")
    .select("*")
    .eq("id", enrollment_id)
    .eq("student_id", student_id)
    .maybeSingle();
  if (readErr) throw readErr;
  if (!before) return json({ error: "Enrollment not found" }, 404);
  if (before.pathway_id || before.enrollment_source !== "direct" || !before.course_id) {
    return json({ error: "Enrollment is not a phantom direct-course row" }, 400);
  }

  const { data: siblingPathways } = await admin
    .from("course_enrollments")
    .select("pathway_id")
    .eq("student_id", student_id)
    .eq("status", "active")
    .not("pathway_id", "is", null);
  const pathwayIds = (siblingPathways ?? []).map((r: any) => r.pathway_id);
  if (pathwayIds.length === 0) {
    return json({ error: "Student has no pathway enrollment — refuse to remove" }, 400);
  }
  const { data: pathwayCourses } = await admin
    .from("pathway_courses")
    .select("course_id")
    .in("pathway_id", pathwayIds);
  const covered = new Set((pathwayCourses ?? []).map((r: any) => r.course_id));
  if (!covered.has(before.course_id)) {
    return json({ error: "Course is not covered by any active pathway — refuse to remove" }, 400);
  }

  // Snapshot unpaid invoices for this exact (student, course, no pathway) slot
  const { data: invs } = await admin
    .from("invoices")
    .select("*")
    .eq("student_id", student_id)
    .eq("course_id", before.course_id)
    .is("pathway_id", null);
  const unpaidInvoices = (invs ?? []).filter(
    (i: any) => String(i.status ?? "").toLowerCase() !== "paid",
  );

  // Delete unpaid invoices, then the phantom enrollment
  const invoiceIds = unpaidInvoices.map((i: any) => i.id);
  if (invoiceIds.length > 0) {
    const { error: delInvErr } = await admin.from("invoices").delete().in("id", invoiceIds);
    if (delInvErr) throw delInvErr;
  }
  const { error: delEnrErr } = await admin
    .from("course_enrollments")
    .delete()
    .eq("id", enrollment_id);
  if (delEnrErr) throw delEnrErr;

  const { data: action, error: logErr } = await admin
    .from("billing_reconciliation_actions")
    .insert({
      finding_id,
      student_id,
      action_type: "remove_phantom_enrollment",
      performed_by: uid,
      before_state: { enrollment: before, invoices: unpaidInvoices },
      after_state: { deleted_enrollment_id: enrollment_id, deleted_invoice_ids: invoiceIds },
    })
    .select("id")
    .single();
  if (logErr) throw logErr;

  return json({
    ok: true,
    enrollment_id,
    deleted_invoices: invoiceIds.length,
    action_id: action.id,
  });
}



async function undoAction(admin: any, uid: string, action_id: string) {
  if (!action_id) return json({ error: "action_id required" }, 400);
  const { data: action, error: readErr } = await admin
    .from("billing_reconciliation_actions")
    .select("*")
    .eq("id", action_id)
    .maybeSingle();
  if (readErr) throw readErr;
  if (!action) return json({ error: "Action not found" }, 404);
  if (action.undone_at) return json({ error: "Action already undone" }, 400);

  const performedAt = new Date(action.performed_at).getTime();
  if (Date.now() - performedAt > UNDO_WINDOW_MS) {
    return json({ error: "Undo window (7 days) has expired" }, 400);
  }

  if (action.action_type === "delete_orphan_invoices") {
    const invoices = action.before_state?.invoices ?? [];
    if (invoices.length > 0) {
      // Strip audit-managed cols that may collide
      const rows = invoices.map((i: any) => ({ ...i }));
      const { error: insErr } = await admin.from("invoices").insert(rows);
      if (insErr) throw insErr;
    }
  } else if (action.action_type === "resync_enrollment_total") {
    const enr = action.before_state?.enrollment;
    if (enr?.id) {
      const { error: updErr } = await admin
        .from("course_enrollments")
        .update({ total_amount: enr.total_amount })
        .eq("id", enr.id);
      if (updErr) throw updErr;
    }
  } else if (action.action_type === "mark_duplicate_enrollment") {
    const enr = action.before_state?.enrollment;
    if (enr?.id) {
      const { error: updErr } = await admin
        .from("course_enrollments")
        .update({ status: enr.status })
        .eq("id", enr.id);
      if (updErr) throw updErr;
    }
  } else if (action.action_type === "remove_phantom_enrollment") {
    const enr = action.before_state?.enrollment;
    const invoices = action.before_state?.invoices ?? [];
    if (enr?.id) {
      const { error: insEnrErr } = await admin
        .from("course_enrollments")
        .insert({ ...enr });
      if (insEnrErr) throw insEnrErr;
    }
    if (invoices.length > 0) {
      const rows = invoices.map((i: any) => ({ ...i }));
      const { error: insInvErr } = await admin.from("invoices").insert(rows);
      if (insInvErr) throw insInvErr;
    }
  }

  const { error: markErr } = await admin
    .from("billing_reconciliation_actions")
    .update({ undone_at: new Date().toISOString(), undone_by: uid })
    .eq("id", action_id);
  if (markErr) throw markErr;

  return json({ ok: true, undone: true });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
