import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Module {
  id: string | number;
  title: string;
  totalLessons: number;
  completedLessons: number;
  lessons: any[];
}

export const useVideosData = (user?: any) => {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchModulesAndRecordings();
  }, [user?.id]);

  const fetchModulesAndRecordings = async () => {
    try {
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
      if (user?.id) {
        const { data: submissionsData, error: submissionsError } = await supabase
          .from('assignment_submissions')
          .select('*')
          .eq('user_id', user.id);
        
        if (submissionsError) throw submissionsError;
        submissions = submissionsData || [];
      }

      // Process data
      const processedModules = modulesData?.map(module => {
        const moduleRecordings = recordingsData?.filter(r => r.module === module.id) || [];
        
        const lessons = moduleRecordings.map(recording => {
          const associatedAssignment = assignmentsData?.find(a => a.sequence_order === recording.sequence_order);
          const submission = submissions?.find(s => s.assignment_id === associatedAssignment?.assignment_id);
          
          return {
            id: recording.id,
            title: recording.recording_title || 'Untitled Recording',
            duration: recording.duration_min ? `${recording.duration_min} min` : 'N/A',
            completed: submission?.status === 'accepted',
            locked: false,
            assignmentTitle: associatedAssignment?.assignment_title || 'No Assignment',
            assignmentSubmitted: !!submission,
            recording_url: recording.recording_url
          };
        });

        return {
          id: module.id,
          title: module.title,
          totalLessons: lessons.length,
          completedLessons: lessons.filter(l => l.completed).length,
          lessons
        };
      }) || [];

      // Filter out modules with no lessons
      const modulesWithLessons = processedModules.filter(module => module.lessons.length > 0);

      // Create default module if NO modules exist at all
      if (modulesWithLessons.length === 0 && recordingsData?.length > 0) {
        const defaultModule = {
          id: 'default',
          title: 'Uncategorized Recordings',
          totalLessons: recordingsData.length,
          completedLessons: 0,
          lessons: recordingsData.map(recording => {
            const associatedAssignment = assignmentsData?.find(a => a.sequence_order === recording.sequence_order);
            const submission = submissions?.find(s => s.assignment_id === associatedAssignment?.assignment_id);
            
            return {
              id: recording.id,
              title: recording.recording_title || 'Untitled Recording',
              duration: recording.duration_min ? `${recording.duration_min} min` : 'N/A',
              completed: submission?.status === 'accepted',
              locked: false,
              assignmentTitle: associatedAssignment?.assignment_title || 'No Assignment',
              assignmentSubmitted: !!submission,
              recording_url: recording.recording_url
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

  return { modules, loading };
};