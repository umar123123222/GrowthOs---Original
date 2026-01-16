import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger';

export interface CourseRecording {
  id: string;
  recording_title: string;
  recording_url?: string;
  sequence_order: number;
  duration_min?: number;
  module_id: string;
  module_title: string;
  module_order: number;
  isUnlocked: boolean;
  isWatched: boolean;
  hasAssignment: boolean;
  assignmentId?: string;
  assignmentSubmitted: boolean;
}

export interface CourseModule {
  id: string;
  title: string;
  order: number;
  recordings: CourseRecording[];
  isLocked: boolean;
  totalLessons: number;
  watchedLessons: number;
}

interface UseCourseRecordingsReturn {
  modules: CourseModule[];
  recordings: CourseRecording[];
  loading: boolean;
  error: Error | null;
  courseProgress: number;
  refreshData: () => Promise<void>;
}

export function useCourseRecordings(courseId: string | null): UseCourseRecordingsReturn {
  const { user } = useAuth();
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [recordings, setRecordings] = useState<CourseRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [courseProgress, setCourseProgress] = useState(0);

  const fetchData = useCallback(async () => {
    if (!user?.id || !courseId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch modules for this course
      const { data: modulesData, error: modulesError } = await supabase
        .from('modules')
        .select('id, title, order')
        .eq('course_id', courseId)
        .order('order', { ascending: true });

      if (modulesError) throw modulesError;

      // Fetch lessons for these modules
      const moduleIds = modulesData?.map(m => m.id) || [];
      
      let lessonsData: any[] = [];
      if (moduleIds.length > 0) {
        const { data, error: lessonsError } = await supabase
          .from('available_lessons')
          .select('id, recording_title, recording_url, sequence_order, duration_min, module, assignment_id')
          .in('module', moduleIds)
          .order('sequence_order', { ascending: true });

        if (lessonsError) throw lessonsError;
        lessonsData = data || [];
      }

      // Fetch unlock status using course-scoped function
      const { data: unlockData, error: unlockError } = await supabase
        .rpc('get_course_sequential_unlock_status', {
          p_user_id: user.id,
          p_course_id: courseId
        });

      if (unlockError) {
        logger.warn('Error fetching unlock status:', unlockError);
      }

      const unlockedIds = new Set(
        (unlockData || [])
          .filter((u: any) => u.is_unlocked)
          .map((u: any) => u.recording_id)
      );

      // Fetch views
      const { data: viewsData } = await supabase
        .from('recording_views')
        .select('recording_id, watched')
        .eq('user_id', user.id);

      const watchedMap = new Map((viewsData || []).map(v => [v.recording_id, v.watched]));

      // Fetch submissions
      const { data: submissionsData } = await supabase
        .from('submissions')
        .select('assignment_id, status')
        .eq('student_id', user.id);

      const submittedAssignments = new Set(
        (submissionsData || [])
          .filter(s => s.status !== 'declined')
          .map(s => s.assignment_id)
      );

      // Process recordings
      const processedRecordings: CourseRecording[] = lessonsData.map(lesson => {
        const module = modulesData?.find(m => m.id === lesson.module);
        return {
          id: lesson.id,
          recording_title: lesson.recording_title || 'Untitled',
          recording_url: lesson.recording_url,
          sequence_order: lesson.sequence_order || 0,
          duration_min: lesson.duration_min,
          module_id: lesson.module,
          module_title: module?.title || 'Unknown Module',
          module_order: module?.order || 0,
          isUnlocked: unlockedIds.has(lesson.id),
          isWatched: watchedMap.get(lesson.id) || false,
          hasAssignment: !!lesson.assignment_id,
          assignmentId: lesson.assignment_id,
          assignmentSubmitted: lesson.assignment_id ? submittedAssignments.has(lesson.assignment_id) : false
        };
      });

      setRecordings(processedRecordings);

      // Group into modules
      const moduleMap = new Map<string, CourseModule>();
      
      for (const mod of modulesData || []) {
        const moduleRecordings = processedRecordings.filter(r => r.module_id === mod.id);
        const watchedCount = moduleRecordings.filter(r => r.isWatched).length;
        const isLocked = moduleRecordings.length > 0 && moduleRecordings.every(r => !r.isUnlocked);
        
        moduleMap.set(mod.id, {
          id: mod.id,
          title: mod.title,
          order: mod.order || 0,
          recordings: moduleRecordings,
          isLocked,
          totalLessons: moduleRecordings.length,
          watchedLessons: watchedCount
        });
      }

      const sortedModules = Array.from(moduleMap.values()).sort((a, b) => a.order - b.order);
      setModules(sortedModules);

      // Calculate progress
      const totalRecordings = processedRecordings.length;
      const watchedRecordings = processedRecordings.filter(r => r.isWatched).length;
      const progress = totalRecordings > 0 ? Math.round((watchedRecordings / totalRecordings) * 100) : 0;
      setCourseProgress(progress);

    } catch (err) {
      logger.error('Error fetching course recordings:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch course data'));
    } finally {
      setLoading(false);
    }
  }, [user?.id, courseId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    modules,
    recordings,
    loading,
    error,
    courseProgress,
    refreshData: fetchData
  };
}
