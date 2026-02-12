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

      // Fetch courses, modules, views, submissions, and student LMS status in parallel
      const [
        { data: coursesData },
        { data: modulesData },
        { data: viewsData },
        { data: submissionsData },
        { data: studentData },
      ] = await Promise.all([
        supabase.from('courses').select('id, title').in('id', courseIds),
        supabase.from('modules').select('id, title, order, course_id').in('course_id', courseIds).order('order', { ascending: true }),
        supabase.from('recording_views').select('recording_id, watched').eq('user_id', user.id),
        supabase.from('submissions').select('assignment_id, status').eq('student_id', user.id),
        supabase.from('users').select('lms_status').eq('id', user.id).maybeSingle(),
      ]);

      const studentLMSStatus = studentData?.lms_status || 'active';

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

      // Build lookup maps
      const courseMap = new Map((coursesData || []).map(c => [c.id, c.title]));
      const watchedMap = new Map((viewsData || []).map(v => [v.recording_id, v.watched]));
      const submittedAssignments = new Set(
        (submissionsData || []).filter(s => s.status !== 'declined').map(s => s.assignment_id)
      );
      const approvedAssignments = new Set(
        (submissionsData || []).filter(s => s.status === 'approved').map(s => s.assignment_id)
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

            // Use sequential unlock status from RPC
            const status = unlockStatusMap.get(lesson.id);
            isUnlocked = status?.isUnlocked || false;
            lockReason = status?.lockReason || null;
            dripUnlockDate = status?.dripUnlockDate || null;

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

      // Frontend override: if LMS is active but RPC returns fees_not_cleared, apply sequential logic
      if (studentLMSStatus === 'active') {
        for (const group of groups) {
          // Collect all recordings in this course, sorted by module order then sequence
          const allCourseRecordings: CourseRecording[] = [];
          for (const mod of group.modules.sort((a, b) => a.order - b.order)) {
            for (const rec of mod.recordings.sort((a, b) => a.sequence_order - b.sequence_order)) {
              allCourseRecordings.push(rec);
            }
          }

          const hasFeesNotCleared = allCourseRecordings.some(r => r.lockReason === 'fees_not_cleared');
          if (hasFeesNotCleared) {
            let canUnlockNext = true;
            for (const rec of allCourseRecordings) {
              if (rec.lockReason !== 'fees_not_cleared' && rec.lockReason !== 'fees_cleared') continue;
              if (canUnlockNext) {
                rec.isUnlocked = true;
                rec.lockReason = null;
                if (!rec.isWatched) {
                  canUnlockNext = false;
                } else if (rec.hasAssignment && !approvedAssignments.has(rec.assignmentId)) {
                  canUnlockNext = false;
                }
              } else {
                rec.lockReason = 'previous_lesson_not_watched';
              }
            }

            // Recalculate module lock status
            for (const mod of group.modules) {
              mod.isLocked = mod.recordings.length > 0 && mod.recordings.every(r => !r.isUnlocked);
              mod.watchedLessons = mod.recordings.filter(r => r.isWatched).length;
            }
          }
        }
      }

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
