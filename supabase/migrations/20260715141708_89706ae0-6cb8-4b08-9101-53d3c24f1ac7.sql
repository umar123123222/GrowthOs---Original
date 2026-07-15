CREATE INDEX IF NOT EXISTS idx_admin_logs_target_user_id ON public.admin_logs ((data->>'target_user_id'));
CREATE INDEX IF NOT EXISTS idx_admin_logs_performed_by_created_at ON public.admin_logs (performed_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON public.admin_logs (created_at DESC);