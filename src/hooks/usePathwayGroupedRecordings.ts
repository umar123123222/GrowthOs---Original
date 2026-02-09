import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger';
import type { CourseRecording, CourseModule } from '@/hooks/useCourseRecordings';
import type { CourseGroup } from '@/hooks/useBatchPathwayRecordings';

interface UsePathwayGroupedRecordingsReturn {
  courseGroups: CourseGroup[];
  totalRecordings: number;
  totalWatched: number;
  totalProgress: number;
  loading: boolean;
  error: Error | null;
  refreshData: () => Promise<void>;
}

/**
 * Fetches all courses in a pathway with their modules and recordings,
 * using sequential unlock status for access control.
 * Used for non-batch pathway students.
 */
export function usePathwayGroupedRecordings(
  pathwayId: string | null
): UsePathwayGroupedRecordingsReturn {
  const { user } = useAuth();
  const [courseGroups, setCourseGroups] = useState<CourseGroup[]>([]);
  const [totalRecordings, setTotalRecordings] = useState(0);
  const [totalWatched, setTotalWatched] = useState(0);
  const [totalProgress, setTotalProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!user?.id || !pathwayId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get pathway courses in step order
      const { data: pathwayCourses, error: pcError } = await supabase
        .from('pathway_courses')
        .select('course_id, step_number')
        .eq('pathway_id', pathwayId)
        .order('step_number', { ascending: true });

      if (pcError) throw pcError;
      if (!pathwayCourses?.length) {
        setCourseGroups([]);
        setLoading(false);
        return;
      }

      const courseIds = pathwayCourses.map(pc => pc.course_id);

      // Fetch courses, modules, views, submissions in parallel
      const [
        { data: coursesData },
        { data: modulesData },
        { data: viewsData },
        { data: submissionsData },
      ] = await Promise.all([
        supabase.from('courses').select('id, title').in('id', courseIds),
        supabase.from('modules').select('id, title, order, course_id').in('course_id', courseIds).order('order', { ascending: true }),
        supabase.from('recording_views').select('recording_id, watched').eq('user_id', user.id),
        supabase.from('submissions').select('assignment_id, status').eq('student_id', user.id),
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

      // Fetch unlock status for each course using sequential unlock RPC
      const unlockStatusMap = new Map<string, { isUnlocked: boolean; lockReason?: string; dripUnlockDate?: string }>();
      
      // Check for batch enrollment to use batch drip dates
      const { data: batchEnrollment } = await supabase
        .from('course_enrollments')
        .select('batch_id')
        .eq('student_id', user.id)
        .not('batch_id', 'is', null)
        .limit(1)
        .maybeSingle();

      let batchDripMap: Map<string, number> | null = null;
      let batchStartDate: Date | null = null;

      if (batchEnrollment?.batch_id) {
        const [{ data: batchData }, { data: timelineItems }] = await Promise.all([
          supabase.from('batches').select('start_date').eq('id', batchEnrollment.batch_id).single(),
          supabase.from('batch_timeline_items').select('recording_id, drip_offset_days').eq('batch_id', batchEnrollment.batch_id).not('recording_id', 'is', null),
        ]);

        if (batchData?.start_date && timelineItems?.length) {
          batchStartDate = new Date(batchData.start_date);
          batchDripMap = new Map();
          for (const item of timelineItems) {
            if (item.recording_id) batchDripMap.set(item.recording_id, item.drip_offset_days);
          }
        }
      }

      // If no batch drip, use sequential unlock per course
      if (!batchDripMap) {
        for (const pc of pathwayCourses) {
          try {
            const { data: unlockData } = await supabase.rpc('get_course_sequential_unlock_status', {
              p_user_id: user.id,
              p_course_id: pc.course_id,
            });
            (unlockData || []).forEach((u: any) => {
              unlockStatusMap.set(u.recording_id, {
                isUnlocked: u.is_unlocked,
                lockReason: u.lock_reason,
                dripUnlockDate: u.drip_unlock_date,
              });
            });
          } catch {
            // Non-critical
          }
        }
      }

      // Build lookup maps
      const courseMap = new Map((coursesData || []).map(c => [c.id, c.title]));
      const watchedMap = new Map((viewsData || []).map(v => [v.recording_id, v.watched]));
      const submittedAssignments = new Set(
        (submissionsData || []).filter(s => s.status !== 'declined').map(s => s.assignment_id)
      );

      const today = new Date();
      today.setHours(0, 0, 0, 0);

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
            let isUnlocked = false;
            let lockReason: string | null = null;
            let dripUnlockDate: string | null = null;

            if (batchDripMap && batchStartDate) {
              // Use batch drip logic
              const dripOffset = batchDripMap.get(lesson.id);
              if (dripOffset !== undefined) {
                const unlockDate = new Date(batchStartDate);
                unlockDate.setDate(unlockDate.getDate() + dripOffset);
                unlockDate.setHours(0, 0, 0, 0);
                if (today >= unlockDate || isWatched) {
                  isUnlocked = true;
                } else {
                  lockReason = 'drip_locked';
                  dripUnlockDate = unlockDate.toISOString();
                }
              } else {
                isUnlocked = isWatched;
                if (!isUnlocked) lockReason = 'drip_locked';
              }
            } else {
              // Use sequential unlock status
              const status = unlockStatusMap.get(lesson.id);
              isUnlocked = status?.isUnlocked || false;
              lockReason = status?.lockReason || null;
              dripUnlockDate = status?.dripUnlockDate || null;
            }

            if (isWatched) courseWatchedLessons++;
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
      logger.error('Error fetching pathway grouped recordings:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch pathway data'));
    } finally {
      setLoading(false);
    }
  }, [user?.id, pathwayId]);

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
