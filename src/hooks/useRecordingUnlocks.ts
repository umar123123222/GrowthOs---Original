import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface RecordingUnlock {
  recording_id: string;
  is_unlocked: boolean;
  unlocked_at?: string;
}

export const useRecordingUnlocks = () => {
  const { user } = useAuth();
  const [unlocks, setUnlocks] = useState<RecordingUnlock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchUnlocks();
    }
  }, [user?.id]);

  const fetchUnlocks = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('user_unlocks')
        .select('recording_id, is_unlocked, unlocked_at')
        .eq('user_id', user.id)
        .eq('is_unlocked', true);

      if (error) throw error;
      setUnlocks(data || []);
    } catch (error) {
      console.error('Error fetching recording unlocks:', error);
    } finally {
      setLoading(false);
    }
  };

  const isRecordingUnlocked = (recordingId: string) => {
    return unlocks.some(unlock => unlock.recording_id === recordingId && unlock.is_unlocked);
  };

  const refreshUnlocks = () => {
    fetchUnlocks();
  };

  return {
    unlocks,
    loading,
    isRecordingUnlocked,
    refreshUnlocks
  };
};