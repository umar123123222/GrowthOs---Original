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
  module_id: string;
  isUnlocked: boolean;
  isWatched: boolean;
  hasAssignment: boolean;
  assignmentSubmitted: boolean;
}

interface Module {
  id: string;
  title: string;
  order: number;
  recordings: Recording[];
}

export const useModulesWithRecordings = () => {
  const { user } = useAuth();
  const { isRecordingUnlocked, loading: unlocksLoading } = useRecordingUnlocks();
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id && !unlocksLoading) {
      fetchModulesWithRecordings();
    }
  }, [user?.id, unlocksLoading]);

  const fetchModulesWithRecordings = async () => {
    if (!user?.id) return;

    try {
      console.log('ModulesWithRecordings: Fetching for user:', user.id);
      
      // Fetch all modules
      const { data: modulesData, error: modulesError } = await supabase
        .from('modules')
        .select('id, title, order')
        .order('order');

      if (modulesError) throw modulesError;

      // Fetch all recordings with their module info
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

      // Group recordings by module
      const processedModules = (modulesData || []).map(module => {
        const moduleRecordings = (recordingsData || [])
          .filter(recording => recording.module === module.id)
          .map(recording => {
            const isUnlocked = isRecordingUnlocked(recording.id);
            const view = viewsData?.find(v => v.recording_id === recording.id);
            const assignment = assignmentsData?.find(a => a.recording_id === recording.id);
            const submission = assignment ? submissionsData?.find(s => s.assignment_id === assignment.id) : null;

            return {
              id: recording.id,
              recording_title: recording.recording_title || 'Untitled Recording',
              recording_url: recording.recording_url,
              sequence_order: recording.sequence_order || 999,
              duration_min: recording.duration_min,
              module_id: recording.module,
              isUnlocked,
              isWatched: view?.watched || false,
              hasAssignment: !!assignment,
              assignmentSubmitted: !!submission && submission.status !== 'declined'
            };
          })
          .sort((a, b) => a.sequence_order - b.sequence_order);

        return {
          id: module.id,
          title: module.title,
          order: module.order || 999,
          recordings: moduleRecordings
        };
      }).filter(module => module.recordings.length > 0);

      console.log('ModulesWithRecordings: Processed modules:', processedModules.length);
      setModules(processedModules);
    } catch (error) {
      console.error('Error fetching modules with recordings:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = () => {
    fetchModulesWithRecordings();
  };

  return {
    modules,
    loading,
    refreshData
  };
};