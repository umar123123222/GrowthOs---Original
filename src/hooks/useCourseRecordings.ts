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
  lockReason?: string | null;
  dripUnlockDate?: string | null;
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

      const unlockStatusMap = new Map<string, { isUnlocked: boolean; lockReason?: string; dripUnlockDate?: string }>();
      (unlockData || []).forEach((u: any) => {
        unlockStatusMap.set(u.recording_id, {
          isUnlocked: u.is_unlocked,
          lockReason: u.lock_reason,
          dripUnlockDate: u.drip_unlock_date
        });
      });

      // Check if student is in a batch and override drip dates with batch timeline
      const { data: enrollment } = await supabase
        .from('course_enrollments')
        .select('batch_id')
        .eq('student_id', user.id)
        .eq('course_id', courseId)
        .not('batch_id', 'is', null)
        .maybeSingle();

      if (enrollment?.batch_id) {
        // Fetch batch start_date and timeline items
        const [{ data: batchData }, { data: timelineItems }] = await Promise.all([
          supabase
            .from('batches')
            .select('start_date')
            .eq('id', enrollment.batch_id)
            .single(),
          supabase
            .from('batch_timeline_items')
            .select('recording_id, drip_offset_days')
            .eq('batch_id', enrollment.batch_id)
            .not('recording_id', 'is', null)
        ]);

        if (batchData?.start_date && timelineItems?.length) {
          const batchStart = new Date(batchData.start_date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          for (const item of timelineItems) {
            if (!item.recording_id) continue;
            const unlockDate = new Date(batchStart);
            unlockDate.setDate(unlockDate.getDate() + item.drip_offset_days);
            unlockDate.setHours(0, 0, 0, 0);

            const existing = unlockStatusMap.get(item.recording_id);
            // Check if already watched (don't re-lock watched content)
            const alreadyWatched = existing?.lockReason === 'already_watched' || existing?.isUnlocked;
            
            if (today >= unlockDate) {
              // Batch timeline says it should be unlocked by now
              // Only override if not already unlocked for a better reason
              if (!existing?.isUnlocked) {
                unlockStatusMap.set(item.recording_id, {
                  isUnlocked: true,
                  lockReason: undefined,
                  dripUnlockDate: undefined
                });
              }
            } else if (!alreadyWatched) {
              // Batch timeline says still locked - override with batch drip date
              unlockStatusMap.set(item.recording_id, {
                isUnlocked: false,
                lockReason: 'drip_locked',
                dripUnlockDate: unlockDate.toISOString()
              });
            }
          }
        }
      }

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
        const unlockStatus = unlockStatusMap.get(lesson.id);
        return {
          id: lesson.id,
          recording_title: lesson.recording_title || 'Untitled',
          recording_url: lesson.recording_url,
          sequence_order: lesson.sequence_order || 0,
          duration_min: lesson.duration_min,
          module_id: lesson.module,
          module_title: module?.title || 'Unknown Module',
          module_order: module?.order || 0,
          isUnlocked: unlockStatus?.isUnlocked || false,
          isWatched: watchedMap.get(lesson.id) || false,
          hasAssignment: !!lesson.assignment_id,
          assignmentId: lesson.assignment_id,
          assignmentSubmitted: lesson.assignment_id ? submittedAssignments.has(lesson.assignment_id) : false,
          lockReason: unlockStatus?.lockReason || null,
          dripUnlockDate: unlockStatus?.dripUnlockDate || null
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
