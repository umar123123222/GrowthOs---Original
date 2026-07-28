
CREATE TABLE IF NOT EXISTS public.billing_reconciliation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id UUID REFERENCES public.billing_drift_findings(id) ON DELETE SET NULL,
  student_id UUID NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('delete_orphan_invoices','resync_enrollment_total','mark_duplicate_enrollment')),
  performed_by UUID REFERENCES auth.users(id),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  before_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  after_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  undone_at TIMESTAMPTZ,
  undone_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_recon_actions_student ON public.billing_reconciliation_actions(student_id);
CREATE INDEX IF NOT EXISTS idx_recon_actions_performed_at ON public.billing_reconciliation_actions(performed_at DESC);

GRANT SELECT ON public.billing_reconciliation_actions TO authenticated;
GRANT ALL ON public.billing_reconciliation_actions TO service_role;

ALTER TABLE public.billing_reconciliation_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins read reconciliation actions"
ON public.billing_reconciliation_actions FOR SELECT TO authenticated
USING (public.get_my_role() = 'superadmin');
