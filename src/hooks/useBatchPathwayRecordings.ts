import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger';
import type { CourseRecording, CourseModule } from '@/hooks/useCourseRecordings';

export interface CourseGroup {
  courseId: string;
  courseTitle: string;
  stepNumber: number;
  modules: CourseModule[];
  totalLessons: number;
  watchedLessons: number;
}

interface UseBatchPathwayRecordingsReturn {
  courseGroups: CourseGroup[];
  totalRecordings: number;
  totalWatched: number;
  totalProgress: number;
  loading: boolean;
  error: Error | null;
  refreshData: () => Promise<void>;
}

export function useBatchPathwayRecordings(
  batchId: string | null,
  pathwayId: string | null
): UseBatchPathwayRecordingsReturn {
  const { user } = useAuth();
  const [courseGroups, setCourseGroups] = useState<CourseGroup[]>([]);
  const [totalRecordings, setTotalRecordings] = useState(0);
  const [totalWatched, setTotalWatched] = useState(0);
  const [totalProgress, setTotalProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!user?.id || !batchId || !pathwayId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch all data in parallel
      const [
        { data: pathwayCourses, error: pcError },
        { data: batchData, error: batchError },
        { data: timelineItems, error: tlError },
        { data: viewsData },
        { data: submissionsData }
      ] = await Promise.all([
        supabase
          .from('pathway_courses')
          .select('course_id, step_number, choice_group, is_choice_point')
          .eq('pathway_id', pathwayId)
          .order('step_number', { ascending: true }),
        supabase
          .from('batches')
          .select('start_date')
          .eq('id', batchId)
          .single(),
        supabase
          .from('batch_timeline_items')
          .select('recording_id, drip_offset_days, course_id, sequence_order')
          .eq('batch_id', batchId)
          .not('recording_id', 'is', null)
          .order('sequence_order', { ascending: true }),
        supabase
          .from('recording_views')
          .select('recording_id, watched')
          .eq('user_id', user.id),
        supabase
          .from('submissions')
          .select('assignment_id, status')
          .eq('student_id', user.id)
      ]);

      if (pcError) throw pcError;
      if (batchError) throw batchError;
      if (tlError) throw tlError;

      if (!pathwayCourses?.length) {
        setCourseGroups([]);
        setLoading(false);
        return;
      }

      // Get course IDs and fetch course titles + modules + lessons
      const courseIds = pathwayCourses.map(pc => pc.course_id);

      const [
        { data: coursesData },
        { data: modulesData },
      ] = await Promise.all([
        supabase
          .from('courses')
          .select('id, title')
          .in('id', courseIds),
        supabase
          .from('modules')
          .select('id, title, order, course_id')
          .in('course_id', courseIds)
          .order('order', { ascending: true }),
      ]);

      // Fetch lessons for all modules
      const moduleIds = modulesData?.map(m => m.id) || [];
      let lessonsData: any[] = [];
      if (moduleIds.length > 0) {
        const { data } = await supabase
          .from('available_lessons')
          .select('id, recording_title, recording_url, sequence_order, duration_min, module, assignment_id')
          .in('module', moduleIds)
          .order('sequence_order', { ascending: true });
        lessonsData = data || [];
      }

      // Build lookup maps
      const courseMap = new Map((coursesData || []).map(c => [c.id, c.title]));
      const watchedMap = new Map((viewsData || []).map(v => [v.recording_id, v.watched]));
      const submittedAssignments = new Set(
        (submissionsData || [])
          .filter(s => s.status !== 'declined')
          .map(s => s.assignment_id)
      );

      // Build timeline drip map: recording_id -> drip_offset_days
      const dripMap = new Map<string, number>();
      for (const item of timelineItems || []) {
        if (item.recording_id) {
          dripMap.set(item.recording_id, item.drip_offset_days);
        }
      }

      const batchStart = batchData?.start_date ? new Date(batchData.start_date) : null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Build course groups in pathway step order
      let allRecordingsCount = 0;
      let allWatchedCount = 0;

      const groups: CourseGroup[] = pathwayCourses.map(pc => {
        const courseTitle = courseMap.get(pc.course_id) || 'Unknown Course';
        const courseModules = (modulesData || []).filter(m => m.course_id === pc.course_id);
        
        let courseTotalLessons = 0;
        let courseWatchedLessons = 0;

        const processedModules: CourseModule[] = courseModules.map(mod => {
          const moduleLessons = lessonsData.filter(l => l.module === mod.id);
          
          const recordings: CourseRecording[] = moduleLessons.map(lesson => {
            const isWatched = watchedMap.get(lesson.id) || false;
            const dripOffset = dripMap.get(lesson.id);
            
            let isUnlocked = false;
            let lockReason: string | null = null;
            let dripUnlockDate: string | null = null;

            if (dripOffset !== undefined && batchStart) {
              const unlockDate = new Date(batchStart);
              unlockDate.setDate(unlockDate.getDate() + dripOffset);
              unlockDate.setHours(0, 0, 0, 0);

              if (today >= unlockDate || isWatched) {
                isUnlocked = true;
              } else {
                lockReason = 'drip_locked';
                dripUnlockDate = unlockDate.toISOString();
              }
            } else {
              // No timeline entry - default unlocked if watched, otherwise locked
              isUnlocked = isWatched;
              if (!isUnlocked) {
                lockReason = 'drip_locked';
              }
            }

            if (isWatched) {
              courseWatchedLessons++;
            }
            courseTotalLessons++;

            return {
              id: lesson.id,
              recording_title: lesson.recording_title || 'Untitled',
              recording_url: lesson.recording_url,
              sequence_order: lesson.sequence_order || 0,
              duration_min: lesson.duration_min,
              module_id: lesson.module,
              module_title: mod.title || 'Unknown Module',
              module_order: mod.order || 0,
              isUnlocked,
              isWatched,
              hasAssignment: !!lesson.assignment_id,
              assignmentId: lesson.assignment_id,
              assignmentSubmitted: lesson.assignment_id ? submittedAssignments.has(lesson.assignment_id) : false,
              lockReason,
              dripUnlockDate,
            };
          });

          const watchedCount = recordings.filter(r => r.isWatched).length;
          const isLocked = recordings.length > 0 && recordings.every(r => !r.isUnlocked);

          return {
            id: mod.id,
            title: mod.title,
            order: mod.order || 0,
            recordings,
            isLocked,
            totalLessons: recordings.length,
            watchedLessons: watchedCount,
          };
        });

        allRecordingsCount += courseTotalLessons;
        allWatchedCount += courseWatchedLessons;

        return {
          courseId: pc.course_id,
          courseTitle,
          stepNumber: pc.step_number,
          modules: processedModules,
          totalLessons: courseTotalLessons,
          watchedLessons: courseWatchedLessons,
        };
      });

      setCourseGroups(groups);
      setTotalRecordings(allRecordingsCount);
      setTotalWatched(allWatchedCount);
      setTotalProgress(allRecordingsCount > 0 ? Math.round((allWatchedCount / allRecordingsCount) * 100) : 0);
    } catch (err) {
      logger.error('Error fetching batch pathway recordings:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch batch pathway data'));
    } finally {
      setLoading(false);
    }
  }, [user?.id, batchId, pathwayId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    courseGroups,
    totalRecordings,
    totalWatched,
    totalProgress,
    loading,
    error,
    refreshData: fetchData,
  };
}
