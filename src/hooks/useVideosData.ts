
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Module {
  id: string | number;
  title: string;
  totalLessons: number;
  completedLessons: number;
  locked: boolean;
  lessons: any[];
}

export const useVideosData = (user?: any) => {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchModulesAndRecordings();
    
    // Throttled refresh function to prevent spam
    let lastRefresh = Date.now();
    const THROTTLE_DELAY = 2000; // 2 seconds minimum between refreshes
    
    const throttledRefresh = () => {
      const now = Date.now();
      if (now - lastRefresh >= THROTTLE_DELAY) {
        lastRefresh = now;
        console.log('Data changed, refreshing...');
        fetchModulesAndRecordings();
      }
    };
    
    // Set up real-time subscription for modules changes with throttling
    const modulesChannel = supabase
      .channel('modules-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'modules'
        },
        throttledRefresh
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'available_lessons'
        },
        throttledRefresh
      )
      .subscribe();

    return () => {
      supabase.removeChannel(modulesChannel);
    };
  }, [user?.id]);

  const fetchModulesAndRecordings = async () => {
    try {
      setLoading(true);
      
      // Fetch modules
      const { data: modulesData, error: modulesError } = await supabase
        .from('modules')
        .select('*')
        .order('order');

      if (modulesError) throw modulesError;

      // Fetch recordings with assignment info
      const { data: recordingsData, error: recordingsError } = await supabase
        .from('available_lessons')
        .select('*')
        .order('sequence_order');

      // Fetch assignments
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('assignment')
        .select('*');

      if (recordingsError) throw recordingsError;
      if (assignmentsError) throw assignmentsError;

      // Fetch user's assignment submissions (if user is logged in)
      let submissions = [];
      let recordingViews = [];
      let unlockStatus = [];
      let userLMSStatus = 'active'; // Default to active
      
      if (user?.id) {
        // Fetch user's LMS status
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('lms_status')
          .eq('id', user.id)
          .single();
        
        if (userError) throw userError;
        userLMSStatus = userData?.lms_status || 'active';
        const { data: submissionsData, error: submissionsError } = await supabase
          .from('assignment_submissions')
          .select('*')
          .eq('user_id', user.id);
        
        if (submissionsError) throw submissionsError;
        submissions = submissionsData || [];

        // Fetch recording views to check what's been watched
        const { data: viewsData, error: viewsError } = await supabase
          .from('recording_views')
          .select('*')
          .eq('user_id', user.id);
        
        if (viewsError) throw viewsError;
        recordingViews = viewsData || [];

        // Get unlock status for the user
        const { data: unlockData, error: unlockError } = await supabase
          .rpc('get_user_unlock_status', { _user_id: user.id });
        
        if (unlockError) throw unlockError;
        unlockStatus = unlockData || [];
      }

      // Process data with unlock logic
      const processedModules = modulesData?.map(module => {
        const moduleRecordings = recordingsData?.filter(r => r.module === module.id) || [];
        
        // Check if this module is unlocked (also check LMS status)
        const moduleUnlockStatus = unlockStatus.find(u => u.module_id === module.id && u.recording_id === null);
        const isModuleUnlocked = user?.id ? (moduleUnlockStatus?.is_module_unlocked ?? false) && userLMSStatus === 'active' : true;
        
        const lessons = moduleRecordings.map(recording => {
          const associatedAssignment = assignmentsData?.find(a => a.sequence_order === recording.sequence_order);
          const submission = submissions?.find(s => s.assignment_id === associatedAssignment?.assignment_id);
          const recordingView = recordingViews?.find(rv => rv.recording_id === recording.id);
          
          // Check if this recording is unlocked (also check LMS status)
          const recordingUnlockStatus = unlockStatus.find(u => u.recording_id === recording.id);
          const isRecordingUnlocked = user?.id ? (recordingUnlockStatus?.is_recording_unlocked ?? false) && userLMSStatus === 'active' : true;
          
          return {
            id: recording.id,
            title: recording.recording_title || 'Untitled Recording',
            duration: recording.duration_min ? `${recording.duration_min} min` : 'N/A',
            completed: submission?.status === 'accepted',
            watched: recordingView?.watched ?? false,
            locked: !isRecordingUnlocked,
            assignmentTitle: associatedAssignment?.assignment_title || 'No Assignment',
            assignmentSubmitted: !!submission,
            assignmentId: associatedAssignment?.assignment_id,
            recording_url: recording.recording_url,
            sequence_order: recording.sequence_order
          };
        });

        return {
          id: module.id,
          title: module.title,
          totalLessons: lessons.length,
          completedLessons: lessons.filter(l => l.completed).length,
          locked: !isModuleUnlocked,
          lessons
        };
      }) || [];

      // Filter out modules with no lessons and sort by order
      const modulesWithLessons = processedModules
        .filter(module => module.lessons.length > 0)
        .sort((a, b) => (a.id as any).order - (b.id as any).order);

      // Create default module for unassigned recordings if needed
      const unassignedRecordings = recordingsData?.filter(r => !r.module) || [];
      
      if (unassignedRecordings.length > 0) {
        const defaultModule = {
          id: 'unassigned',
          title: 'Uncategorized Recordings',
          totalLessons: unassignedRecordings.length,
          completedLessons: 0,
          locked: false,
          lessons: unassignedRecordings.map(recording => {
            const associatedAssignment = assignmentsData?.find(a => a.sequence_order === recording.sequence_order);
            const submission = submissions?.find(s => s.assignment_id === associatedAssignment?.assignment_id);
            const recordingView = recordingViews?.find(rv => rv.recording_id === recording.id);
            
            return {
              id: recording.id,
              title: recording.recording_title || 'Untitled Recording',
              duration: recording.duration_min ? `${recording.duration_min} min` : 'N/A',
              completed: submission?.status === 'accepted',
              watched: recordingView?.watched ?? false,
              locked: userLMSStatus !== 'active', // Lock if LMS status is not active
              assignmentTitle: associatedAssignment?.assignment_title || 'No Assignment',
              assignmentSubmitted: !!submission,
              assignmentId: associatedAssignment?.assignment_id,
              recording_url: recording.recording_url,
              sequence_order: recording.sequence_order
            };
          })
        };
        modulesWithLessons.push(defaultModule);
      }

      setModules(modulesWithLessons);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = () => {
    fetchModulesAndRecordings();
  };

  return { modules, loading, refreshData };
};
