import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { safeLogger } from '@/lib/safe-logger';

export const useProgressTracker = (user?: any, modules?: any[]) => {
  useEffect(() => {
    const checkAndUpdateUserStatus = async () => {
      if (!user?.id || !modules?.length) return;

      try {
        // Check if all modules are completed
        const allModulesCompleted = modules.every(module => 
          module.lessons.every((lesson: any) => lesson.completed)
        );

        if (allModulesCompleted) {
          // Update user status to "Completed"
          const { error } = await supabase
            .from('users')
            .update({ status: 'Passed out / Completed' })
            .eq('id', user.id);

          if (error) {
            safeLogger.error('Error updating user status:', error);
          } else {
            safeLogger.info('User status updated to Completed');
          }
        }
      } catch (error) {
        safeLogger.error('Error checking module completion:', error);
      }
    };

    checkAndUpdateUserStatus();
  }, [user?.id, modules]);

  const markModuleComplete = async (moduleId: string) => {
    if (!user?.id) return;

    try {
      // TODO: Create user_module_progress table in migration
      // For now, log the activity in user_activity_logs
      await supabase
        .from('user_activity_logs')
        .insert({
          user_id: user.id,
          activity_type: 'module_completed',
          metadata: { module_id: moduleId }
        });
    } catch (error) {
      safeLogger.error('Error marking module as complete:', error);
    }
  };

  const markRecordingWatched = async (recordingId: string) => {
    if (!user?.id) return;

    try {
      await supabase
        .from('recording_views')
        .upsert({
          user_id: user.id,
          recording_id: recordingId,
          watched: true
        });
    } catch (error) {
      safeLogger.error('Error marking recording as watched:', error);
    }
  };

  return {
    markModuleComplete,
    markRecordingWatched
  };
};