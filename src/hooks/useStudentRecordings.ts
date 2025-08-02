import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRecordingUnlocks } from '@/hooks/useRecordingUnlocks';

interface Recording {
  id: string;
  recording_title: string;
  recording_url?: string;
  sequence_order: number;
  duration_min?: number;
  module?: string;
  isUnlocked: boolean;
  isWatched: boolean;
  hasAssignment: boolean;
  assignmentSubmitted: boolean;
}

export const useStudentRecordings = () => {
  const { user } = useAuth();
  const { isRecordingUnlocked, loading: unlocksLoading } = useRecordingUnlocks();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id && !unlocksLoading) {
      fetchRecordings();
    }
  }, [user?.id, unlocksLoading]);

  const fetchRecordings = async () => {
    if (!user?.id) return;

    try {
      console.log('StudentRecordings: Fetching recordings for user:', user.id);
      
      // Fetch all recordings with their assignments
      const { data: recordingsData, error: recordingsError } = await supabase
        .from('available_lessons')
        .select(`
          id,
          recording_title,
          recording_url,
          sequence_order,
          duration_min,
          module
        `)
        .order('sequence_order');

      if (recordingsError) throw recordingsError;
      console.log('StudentRecordings: Found recordings:', recordingsData?.length || 0);

      // Fetch recording views for this user
      const { data: viewsData, error: viewsError } = await supabase
        .from('recording_views')
        .select('recording_id, watched')
        .eq('user_id', user.id);

      if (viewsError) throw viewsError;

      // Fetch assignments linked to recordings
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('assignments')
        .select('id, recording_id')
        .not('recording_id', 'is', null);

      if (assignmentsError) throw assignmentsError;

      // Fetch user's submissions
      const { data: submissionsData, error: submissionsError } = await supabase
        .from('submissions')
        .select('assignment_id, status')
        .eq('student_id', user.id);

      if (submissionsError) throw submissionsError;

      // Process the data
      const processedRecordings = (recordingsData || []).map(recording => {
        const isUnlocked = isRecordingUnlocked(recording.id);
        const view = viewsData?.find(v => v.recording_id === recording.id);
        const assignment = assignmentsData?.find(a => a.recording_id === recording.id);
        const submission = assignment ? submissionsData?.find(s => s.assignment_id === assignment.id) : null;

        console.log(`Recording ${recording.recording_title}: unlocked=${isUnlocked}, watched=${view?.watched || false}`);

        return {
          id: recording.id,
          recording_title: recording.recording_title || 'Untitled Recording',
          recording_url: recording.recording_url,
          sequence_order: recording.sequence_order || 999,
          duration_min: recording.duration_min,
          module: recording.module,
          isUnlocked,
          isWatched: view?.watched || false,
          hasAssignment: !!assignment,
          assignmentSubmitted: !!submission && submission.status !== 'declined'
        };
      });

      console.log('StudentRecordings: Processed recordings:', processedRecordings.length);
      setRecordings(processedRecordings);
    } catch (error) {
      console.error('Error fetching student recordings:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshRecordings = () => {
    fetchRecordings();
  };

  return {
    recordings,
    loading,
    refreshRecordings
  };
};