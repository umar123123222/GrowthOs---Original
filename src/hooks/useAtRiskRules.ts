import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AtRiskRules {
  no_login_days: number;
  stuck_recording_days: number;
  stuck_assignment_days: number;
  missed_sessions_count: number;
}

const DEFAULT_RULES: AtRiskRules = {
  no_login_days: 0,
  stuck_recording_days: 0,
  stuck_assignment_days: 0,
  missed_sessions_count: 0,
};

export function useAtRiskRules() {
  const [rules, setRules] = useState<AtRiskRules>(DEFAULT_RULES);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('at_risk_rules')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (data) {
      setRules({
        no_login_days: data.no_login_days ?? 0,
        stuck_recording_days: data.stuck_recording_days ?? 0,
        stuck_assignment_days: data.stuck_assignment_days ?? 0,
        missed_sessions_count: data.missed_sessions_count ?? 0,
      });
      setConfigured(!!data.configured);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveRules = async (next: AtRiskRules): Promise<boolean> => {
    const isConfigured =
      next.no_login_days > 0 ||
      next.stuck_recording_days > 0 ||
      next.stuck_assignment_days > 0 ||
      next.missed_sessions_count > 0;
    const { error } = await (supabase as any)
      .from('at_risk_rules')
      .update({ ...next, configured: isConfigured, updated_at: new Date().toISOString() })
      .eq('id', 1);
    if (error) return false;
    setRules(next);
    setConfigured(isConfigured);
    return true;
  };

  return { rules, configured, loading, saveRules, refetch: load };
}
