// Allowlist of notification keys students may see in the bell + /notifications page.
// Staff (admin/superadmin/mentor/enrollment_manager/support_member) see everything.

export const STUDENT_ALLOWED_KEYS = new Set<string>([
  // 1. Success session added/edited
  "success_session",
  // 2. Invoice generated
  "invoice_issued",
  // 3. Invoice marked paid
  "invoice_paid",
  // 4. New video dripped / content unlocked for this student
  "content_unlocked",
  // 5. New assignment unlocked
  "assignment_unlocked",
  // 6. Assignment approved / declined
  "assignment_reviewed",
  // 7. Resource added/edited
  "resource_changed",
]);

export function getNotificationKey(n: any): string {
  return (n?.template_key || n?.type || "") as string;
}

function getData(n: any): any {
  return n?.payload?.data || n?.payload?.metadata || n?.payload || {};
}

/**
 * Returns true when the notification should be visible to the given role.
 * Non-students always see everything (return true). Students only see the
 * allowlisted events.
 */
export function isRelevantNotificationForRole(
  n: any,
  role: string | null | undefined,
): boolean {
  if (role && role !== "student") return true;

  const key = getNotificationKey(n);
  const data = getData(n);

  // Success sessions: handle both legacy `success_session` type and the
  // unified `learning_item_changed` event for success_session items.
  if (key === "learning_item_changed") {
    if (data?.item_type === "success_session") {
      const action = (data?.action || "").toLowerCase();
      return action === "" || action === "insert" || action === "created" || action === "update" || action === "updated";
    }
    return false;
  }

  if (key === "success_session") {
    const action = (data?.action || "").toLowerCase();
    return action === "" || action === "insert" || action === "created" || action === "update" || action === "updated";
  }

  return STUDENT_ALLOWED_KEYS.has(key);
}
