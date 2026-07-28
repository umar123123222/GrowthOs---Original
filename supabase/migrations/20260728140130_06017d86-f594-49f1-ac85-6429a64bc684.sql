
-- Phase 1: Observability - billing drift findings (read-only detection)

CREATE TABLE public.billing_drift_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  expected_total numeric NOT NULL DEFAULT 0,
  actual_total numeric NOT NULL DEFAULT 0,
  difference numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'PKR',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open',
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.billing_drift_findings TO authenticated;
GRANT ALL ON public.billing_drift_findings TO service_role;

ALTER TABLE public.billing_drift_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can view drift findings"
  ON public.billing_drift_findings
  FOR SELECT
  TO authenticated
  USING (public.get_my_role() = 'superadmin');

CREATE POLICY "Superadmins can update drift findings"
  ON public.billing_drift_findings
  FOR UPDATE
  TO authenticated
  USING (public.get_my_role() = 'superadmin')
  WITH CHECK (public.get_my_role() = 'superadmin');

CREATE INDEX idx_billing_drift_findings_status ON public.billing_drift_findings(status);
CREATE INDEX idx_billing_drift_findings_student ON public.billing_drift_findings(student_id);
CREATE INDEX idx_billing_drift_findings_detected_at ON public.billing_drift_findings(detected_at DESC);

CREATE TRIGGER trg_billing_drift_findings_updated_at
  BEFORE UPDATE ON public.billing_drift_findings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
