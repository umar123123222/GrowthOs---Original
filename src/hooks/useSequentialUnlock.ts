import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger';

interface SequentialUnlockStatus {
  isEnabled: boolean;
  firstRecordingUnlocked: boolean;
  feesCleared: boolean;
}

export const useSequentialUnlock = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState<SequentialUnlockStatus>({
    isEnabled: false,
    firstRecordingUnlocked: false,
    feesCleared: false
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchSequentialUnlockStatus();
    }
  }, [user?.id]);

  const fetchSequentialUnlockStatus = async () => {
    if (!user?.id) return;

    try {
      // Check if sequential unlock is enabled
      const { data: companySettings } = await supabase
        .from('company_settings')
        .select('lms_sequential_unlock')
        .eq('id', 1)
        .single();

      const isEnabled = companySettings?.lms_sequential_unlock || false;

      if (!isEnabled) {
        setStatus({ isEnabled: false, firstRecordingUnlocked: false, feesCleared: false });
        setLoading(false);
        return;
      }

      // Get student fees status
      const { data: studentData } = await supabase
        .from('students')
        .select('fees_cleared')
        .eq('user_id', user.id)
        .single();

      const feesCleared = studentData?.fees_cleared || false;

      // Check if first recording is unlocked
      const { data: firstRecording } = await supabase
        .from('available_lessons')
        .select('id')
        .order('sequence_order', { ascending: true })
        .limit(1)
        .single();

      let firstRecordingUnlocked = false;
      if (firstRecording && feesCleared) {
        const { data: unlockData } = await supabase
          .from('user_unlocks')
          .select('is_unlocked')
          .eq('user_id', user.id)
          .eq('recording_id', firstRecording.id)
          .single();

        firstRecordingUnlocked = unlockData?.is_unlocked || false;
      }

      setStatus({
        isEnabled,
        firstRecordingUnlocked,
        feesCleared
      });

    } catch (error) {
      logger.error('Error fetching sequential unlock status:', error);
    } finally {
      setLoading(false);
    }
  };

  const initializeFirstRecordingUnlock = async () => {
    if (!user?.id || !status.isEnabled || !status.feesCleared) return;

    try {
      // Get first recording
      const { data: firstRecording } = await supabase
        .from('available_lessons')
        .select('id')
        .order('sequence_order', { ascending: true })
        .limit(1)
        .single();

      if (!firstRecording) return;

      // Unlock first recording
      await supabase
        .from('user_unlocks')
        .upsert({
          user_id: user.id,
          recording_id: firstRecording.id,
          is_unlocked: true,
          unlocked_at: new Date().toISOString()
        });

      setStatus(prev => ({ ...prev, firstRecordingUnlocked: true }));
      
    } catch (error) {
      logger.error('Error initializing first recording unlock:', error);
    }
  };

  return {
    status,
    loading,
    initializeFirstRecordingUnlock,
    refreshStatus: fetchSequentialUnlockStatus
  };
};