
-- Drop the HTTP trigger that calls a non-existent extensions.http_post function
DROP TRIGGER IF EXISTS trigger_notify_content_unlocked ON public.user_unlocks;
DROP FUNCTION IF EXISTS public.trigger_notify_content_unlocked() CASCADE;

-- Restore fees_cleared auto-update on invoice payment
CREATE OR REPLACE FUNCTION public.update_student_fees_cleared_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_all_paid boolean;
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN
    SELECT NOT EXISTS(
      SELECT 1 FROM public.invoices
      WHERE student_id = NEW.student_id
      AND status != 'paid'
    ) INTO v_all_paid;
    IF v_all_paid THEN
      UPDATE public.students
      SET fees_cleared = true
      WHERE id = NEW.student_id AND fees_cleared = false;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_fees_cleared_on_invoice_paid ON public.invoices;
CREATE TRIGGER update_fees_cleared_on_invoice_paid
  AFTER UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_student_fees_cleared_status();

-- Back-fill
UPDATE public.students s
SET fees_cleared = true
WHERE s.fees_cleared = false
  AND EXISTS (SELECT 1 FROM public.invoices i WHERE i.student_id = s.id)
  AND NOT EXISTS (SELECT 1 FROM public.invoices i WHERE i.student_id = s.id AND i.status != 'paid');
