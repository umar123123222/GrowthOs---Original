import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

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

  const fetchUnlocks = async () => {
    if (!user?.id) return;

    try {
      console.log('Fetching sequential unlock status for user:', user.id);
      
      // Use the new sequential unlock function
      const { data, error } = await supabase.rpc('get_student_unlock_sequence', {
        p_user_id: user.id
      });

      if (error) {
        console.error('Error fetching unlock sequence:', error);
        throw error;
      }

      console.log('Sequential unlock data:', data);
      setUnlocks(data || []);
    } catch (error) {
      console.error('Error fetching recording unlocks:', error);
      // Fallback: unlock only first recording
      try {
        const { data: firstRecording } = await supabase
          .from('available_lessons')
          .select('id, sequence_order')
          .order('sequence_order')
          .limit(1)
          .single();

        if (firstRecording) {
          setUnlocks([{
            recording_id: firstRecording.id,
            sequence_order: firstRecording.sequence_order || 1,
            is_unlocked: true,
            unlock_reason: 'First recording - fallback unlock'
          }]);
        }
      } catch (fallbackError) {
        console.error('Fallback unlock failed:', fallbackError);
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
    fetchUnlocks();
  };

  return {
    unlocks,
    loading,
    isRecordingUnlocked,
    refreshUnlocks
  };
};