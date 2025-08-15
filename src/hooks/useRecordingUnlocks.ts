import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { safeMaybeSingle } from '@/lib/database-safety';
import { logger } from '@/lib/logger';

interface RecordingUnlock {
  recording_id: string;
  sequence_order: number;
  is_unlocked: boolean;
  unlock_reason: string;
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

  // Listen for submission approvals to refresh unlock status
  useEffect(() => {
    if (!user?.id) return;

    // Listen for PostgreSQL notifications
    const channel = supabase.channel('submission_notifications');
    
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'submissions',
      filter: `student_id=eq.${user.id}`
    }, (payload) => {
      logger.debug('Received submission change, refreshing unlocks', payload);
      fetchUnlocks();
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const fetchUnlocks = async () => {
    if (!user?.id) return;

    try {
      logger.debug('Fetching sequential unlock status for user:', { userId: user.id });
      
      // Use the new sequential unlock function
      const { data, error } = await supabase.rpc('get_student_unlock_sequence', {
        p_user_id: user.id
      });

      if (error) {
        logger.error('Error fetching unlock sequence:', error);
        throw error;
      }

      logger.debug('Sequential unlock data:', { data });
      setUnlocks(data || []);
    } catch (error) {
      logger.error('Error fetching recording unlocks:', error);
      // Fallback: unlock only first recording
      try {
        const { data: firstRecording } = await supabase
          .from('available_lessons')
          .select('id, sequence_order')
          .order('sequence_order')
          .limit(1)
          .maybeSingle();

        if (firstRecording) {
          setUnlocks([{
            recording_id: firstRecording.id,
            sequence_order: firstRecording.sequence_order || 1,
            is_unlocked: true,
            unlock_reason: 'First recording - fallback unlock'
          }]);
        }
      } catch (fallbackError) {
        logger.error('Fallback unlock failed:', fallbackError);
      }
    } finally {
      setLoading(false);
    }
  };

  const isRecordingUnlocked = (recordingId: string) => {
    const unlock = unlocks.find(unlock => unlock.recording_id === recordingId);
    return unlock?.is_unlocked || false;
  };

  const refreshUnlocks = () => {
    setLoading(true);
    fetchUnlocks();
  };

  return {
    unlocks,
    loading,
    isRecordingUnlocked,
    refreshUnlocks
  };
};