import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger';
import { getStudentVideoAccessState } from '@/lib/student-video-access';
import type { CourseRecording, CourseModule } from '@/hooks/useCourseRecordings';

export interface CourseGroup {
  courseId: string;
  courseTitle: string;
  stepNumber: number;
  modules: CourseModule[];
  totalLessons: number;
  watchedLessons: number;
  isCurrentPathwayCourse?: boolean;
  isCompletedPathwayCourse?: boolean;
}

interface PathwayCourseAccess {
  courseId: string;
  isCurrent: boolean;
  isCompleted: boolean;
}

interface LessonRow {
  id: string;
  recording_title: string | null;
  recording_url: string | null;
  sequence_order: number | null;
  duration_min: number | null;
  module: string;
  assignment_id: string | null;
}

interface UnlockStatusRow {
  recording_id: string;
  is_unlocked: boolean;
  lock_reason: string | null;
  drip_unlock_date: string | null;
}

interface SubmissionRow {
  assignment_id: string;
  status: string;
  version: number | null;
  created_at: string | null;
}

const EMPTY_PATHWAY_ACCESS: PathwayCourseAccess[] = [];

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
  pathwayId: string | null,
  pathwayCoursesAccess: PathwayCourseAccess[] = EMPTY_PATHWAY_ACCESS
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

      // Fetch courses, modules, views, submissions, student LMS status, and access overrides in parallel
      const [
        { data: coursesData },
        { data: modulesData },
        { data: viewsData },
        { data: submissionsData },
        { data: studentData },
        videoAccessState,
      ] = await Promise.all([
        supabase.from('courses').select('id, title').in('id', courseIds),
        supabase.from('modules').select('id, title, order, course_id').in('course_id', courseIds).order('order', { ascending: true }),
        supabase.from('recording_views').select('recording_id, watched').eq('user_id', user.id),
        supabase
          .from('submissions')
          .select('assignment_id, status, version, created_at')
          .eq('student_id', user.id),
        supabase.from('users').select('lms_status').eq('id', user.id).maybeSingle(),
        getStudentVideoAccessState(user.id),
      ]);

      const studentLMSStatus = studentData?.lms_status || 'active';

      // Bypass detection: if ANY active enrollment for this student has drip disabled
      // or sequential disabled, all visible pathway videos are fully unlocked.
      const studentHasBypass = videoAccessState.hasVideoBypass;

      const fullBypassCourseIds = new Set<string>();
      if (studentHasBypass) {
        courseIds.forEach((cid) => fullBypassCourseIds.add(cid));
      }

      // Fetch lessons for all modules
      const moduleIds = modulesData?.map(m => m.id) || [];
      let lessonsData: LessonRow[] = [];
      if (moduleIds.length > 0) {
        const { data } = await supabase
          .from('available_lessons')
          .select('id, recording_title, recording_url, sequence_order, duration_min, module, assignment_id')
          .in('module', moduleIds)
          .order('sequence_order', { ascending: true });
        lessonsData = (data || []) as LessonRow[];
      }

      // Fetch unlock status for all courses in parallel
      const unlockStatusMap = new Map<string, { isUnlocked: boolean; lockReason?: string; dripUnlockDate?: string }>();

      const unlockResults = await Promise.all(
        pathwayCourses.map(async (pc) => {
          try {
            const res = await supabase.rpc('get_course_sequential_unlock_status', {
              p_user_id: user.id,
              p_course_id: pc.course_id,
            });
            return (res.data || []) as UnlockStatusRow[];
          } catch {
            return [];
          }
        })
      );

      unlockResults.forEach(unlockData => {
        unlockData.forEach((u) => {
          unlockStatusMap.set(u.recording_id, {
            isUnlocked: u.is_unlocked,
            lockReason: u.lock_reason,
            dripUnlockDate: u.drip_unlock_date,
          });
        });
      });

      // Build lookup maps
      const courseMap = new Map((coursesData || []).map(c => [c.id, c.title]));
      const pathwayAccessMap = new Map(pathwayCoursesAccess.map(course => [course.courseId, course]));
      const watchedMap = new Map((viewsData || []).map(v => [v.recording_id, v.watched]));
      const latestSubmissionByAssignment = new Map<string, { status: string; version: number; createdAt: number }>();
      ((submissionsData || []) as SubmissionRow[]).forEach((submission) => {
        const version = Number(submission.version || 0);
        const createdAt = submission.created_at ? new Date(submission.created_at).getTime() : 0;
        const existing = latestSubmissionByAssignment.get(submission.assignment_id);

        if (!existing || version > existing.version || (version === existing.version && createdAt > existing.createdAt)) {
          latestSubmissionByAssignment.set(submission.assignment_id, {
            status: submission.status,
            version,
            createdAt,
          });
        }
      });

      const submittedAssignments = new Set(
        Array.from(latestSubmissionByAssignment.entries())
          .filter(([, submission]) => submission.status !== 'declined')
          .map(([assignmentId]) => assignmentId)
      );
      const approvedAssignments = new Set(
        Array.from(latestSubmissionByAssignment.entries())
          .filter(([, submission]) => submission.status === 'approved')
          .map(([assignmentId]) => assignmentId)
      );
      const declinedAssignments = new Set(
        Array.from(latestSubmissionByAssignment.entries())
          .filter(([, submission]) => submission.status === 'declined')
          .map(([assignmentId]) => assignmentId)
      );

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let allRecordingsCount = 0;
      let allWatchedCount = 0;

      const groups: CourseGroup[] = pathwayCourses.map(pc => {
        const courseTitle = courseMap.get(pc.course_id) || 'Unknown Course';
        const courseModules = (modulesData || []).filter(m => m.course_id === pc.course_id);
        const pathwayAccess = pathwayAccessMap.get(pc.course_id);
        const isCurrentPathwayCourse = pathwayAccess?.isCurrent ?? false;
        const isCompletedPathwayCourse = pathwayAccess?.isCompleted ?? false;
        const courseHasBypass = fullBypassCourseIds.has(pc.course_id);

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

            // Bypass: when this student's enrollment has drip disabled (and/or sequential disabled),
            // assignment locks must not apply either — unlock unconditionally.
            if (courseHasBypass) {
              isUnlocked = true;
              lockReason = null;
              dripUnlockDate = null;
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
              assignmentDeclined: lesson.assignment_id ? declinedAssignments.has(lesson.assignment_id) : false,
              lockReason,
              dripUnlockDate,
              blockingLessonTitle: null,
              blockingAssignmentDeclined: false,
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
          isCurrentPathwayCourse,
          isCompletedPathwayCourse,
        };
      });

      // Consistency fix: if previous lesson assignment is already approved, ensure next lesson isn't
      // still locked by stale previous_assignment_not_approved/not_submitted state.
      for (const group of groups) {
        const allCourseRecordings = group.modules
          .slice()
          .sort((a, b) => a.order - b.order)
          .flatMap(mod => mod.recordings.slice().sort((a, b) => a.sequence_order - b.sequence_order));

        for (let i = 1; i < allCourseRecordings.length; i++) {
          const current = allCourseRecordings[i];
          const blockingByPreviousAssignment =
            current.lockReason === 'previous_assignment_not_approved' ||
            current.lockReason === 'previous_assignment_not_submitted';

          if (!current.isUnlocked && blockingByPreviousAssignment) {
            // Walk backwards to find the actual blocking predecessor
            let allPredecessorsMet = true;
            let blocker: typeof current | null = null;
            for (let j = i - 1; j >= 0; j--) {
              const pred = allCourseRecordings[j];
              if (!pred.isWatched) { allPredecessorsMet = false; blocker = pred; break; }
              if (pred.hasAssignment && pred.assignmentId && !approvedAssignments.has(pred.assignmentId)) {
                allPredecessorsMet = false;
                blocker = pred;
                break;
              }
            }
            if (allPredecessorsMet) {
              current.isUnlocked = true;
              current.lockReason = null;
            } else if (blocker) {
              current.blockingLessonTitle = blocker.recording_title;
              if (blocker.hasAssignment && blocker.assignmentId && declinedAssignments.has(blocker.assignmentId)) {
                current.lockReason = 'previous_assignment_declined';
                current.blockingAssignmentDeclined = true;
              } else if (blocker.hasAssignment && blocker.assignmentId && submittedAssignments.has(blocker.assignmentId) && !approvedAssignments.has(blocker.assignmentId)) {
                current.lockReason = 'previous_assignment_not_approved';
              } else if (blocker.hasAssignment && blocker.assignmentId) {
                current.lockReason = 'previous_assignment_not_submitted';
              } else {
                current.lockReason = 'previous_lesson_not_watched';
              }
            }
          }
        }

        // SAFETY NET: Re-lock lessons whose chain of predecessors isn't fully complete.
        // Walks backwards through ALL prior lessons in the course (not just the
        // immediate one) so a lesson without an assignment between two assignment-gated
        // lessons can't let the chain "leak" — e.g. lesson 5 stays unlocked because
        // lesson 4 has no assignment, even though lesson 2's assignment is still pending.
        // SKIP this safety net entirely for courses where the student's enrollment has
        // full bypass (drip_override+sequential_override true, both *_enabled false) —
        // in that case assignment locks must not be enforced.
        const skipAssignmentSafetyNet = fullBypassCourseIds.has(group.courseId);
        for (let i = 1; i < allCourseRecordings.length && !skipAssignmentSafetyNet; i++) {
          const current = allCourseRecordings[i];
          if (!current.isUnlocked) continue;

          let blocker: CourseRecording | null = null;
          let reason: string | null = null;

          for (let j = i - 1; j >= 0; j--) {
            const pred = allCourseRecordings[j];

            if (pred.hasAssignment && pred.assignmentId && !approvedAssignments.has(pred.assignmentId)) {
              blocker = pred;
              if (declinedAssignments.has(pred.assignmentId)) {
                reason = 'previous_assignment_declined';
              } else if (submittedAssignments.has(pred.assignmentId)) {
                reason = 'previous_assignment_not_approved';
              } else {
                reason = 'previous_assignment_not_submitted';
              }
              break;
            }

            if (!pred.isWatched) {
              blocker = pred;
              reason = 'previous_lesson_not_watched';
              break;
            }
          }

          if (blocker && reason) {
            current.isUnlocked = false;
            current.blockingLessonTitle = blocker.recording_title;
            current.lockReason = reason;
            current.blockingAssignmentDeclined = reason === 'previous_assignment_declined';
          }
        }

        for (const mod of group.modules) {
          mod.isLocked = mod.recordings.length > 0 && mod.recordings.every(r => !r.isUnlocked);
          mod.watchedLessons = mod.recordings.filter(r => r.isWatched).length;
        }
      }

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

      // Pathway gating is handled purely by the drip timeline set in the pathway
      // (per-course drip dates from the RPC). We do NOT force-lock future pathway
      // courses based on whether the current course is completed — the drip date
      // is the single source of truth.

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
  }, [user?.id, pathwayId, pathwayCoursesAccess]);

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
