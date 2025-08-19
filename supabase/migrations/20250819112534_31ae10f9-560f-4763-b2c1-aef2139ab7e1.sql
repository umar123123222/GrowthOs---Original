-- PHASE 2B: Fix RLS warnings for backup tables
-- The linter detected that backup tables don't have RLS enabled

-- Enable RLS on backup tables (they should be read-only for security audit)
ALTER TABLE user_security_summary_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE segmented_weekly_success_sessions_backup ENABLE ROW LEVEL SECURITY;

-- Create restrictive policies for backup tables (superadmin only access)
CREATE POLICY "Superadmins can view user security backup" 
ON user_security_summary_backup FOR SELECT 
USING (get_current_user_role() = 'superadmin');

CREATE POLICY "Superadmins can view sessions backup" 
ON segmented_weekly_success_sessions_backup FOR SELECT 
USING (get_current_user_role() = 'superadmin');