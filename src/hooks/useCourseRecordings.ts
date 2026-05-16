import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger';
import { getStudentVideoAccessState } from '@/lib/student-video-access';

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
  assignmentDeclined?: boolean;
  lockReason?: string | null;
  dripUnlockDate?: string | null;
  /** Title of the specific predecessor lesson that is currently blocking this one */
  blockingLessonTitle?: string | null;
  /** True when the predecessor blocking this lesson has a declined submission */
  blockingAssignmentDeclined?: boolean;
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
      
      let lessonsData: LessonRow[] = [];
      if (moduleIds.length > 0) {
        const { data, error: lessonsError } = await supabase
          .from('available_lessons')
          .select('id, recording_title, recording_url, sequence_order, duration_min, module, assignment_id')
          .in('module', moduleIds)
          .order('sequence_order', { ascending: true });

        if (lessonsError) throw lessonsError;
        lessonsData = (data || []) as LessonRow[];
      }

      // Fetch unlock status, student LMS status, views, submissions, and access overrides in parallel
      const [unlockResult, studentResult, viewsResult, submissionsResult, videoAccessState] = await Promise.all([
        supabase.rpc('get_course_sequential_unlock_status', {
          p_user_id: user.id,
          p_course_id: courseId
        }),
        supabase.from('users').select('lms_status').eq('id', user.id).maybeSingle(),
        supabase.from('recording_views').select('recording_id, watched').eq('user_id', user.id),
        supabase
          .from('submissions')
          .select('assignment_id, status, version, created_at')
          .eq('student_id', user.id),
        getStudentVideoAccessState(user.id),
      ]);

      const unlockData = unlockResult.data;
      const studentLMSStatus = studentResult.data?.lms_status || 'active';
      const hasVideoBypass = videoAccessState.hasVideoBypass;

      const unlockStatusMap = new Map<string, { isUnlocked: boolean; lockReason?: string; dripUnlockDate?: string }>();
      ((unlockData || []) as UnlockStatusRow[]).forEach((u) => {
        unlockStatusMap.set(u.recording_id, {
          isUnlocked: u.is_unlocked,
          lockReason: u.lock_reason,
          dripUnlockDate: u.drip_unlock_date
        });
      });

      const watchedMap = new Map((viewsResult.data || []).map(v => [v.recording_id, v.watched]));

      const latestSubmissionByAssignment = new Map<string, { status: string; version: number; createdAt: number }>();
      ((submissionsResult.data || []) as SubmissionRow[]).forEach((submission) => {
        const version = Number(submission.version || 0);
        const createdAt = submission.created_at ? new Date(submission.created_at).getTime() : 0;
        const existing = latestSubmissionByAssignment.get(submission.assignment_id);

        if (!existing || version > existing.version || (version === existing.version && createdAt > existing.createdAt)) {
          latestSubmissionByAssignment.set(submission.assignment_id, {
            status: submission.status,
            version,
            createdAt
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
          isUnlocked: hasVideoBypass ? true : unlockStatus?.isUnlocked || false,
          isWatched: watchedMap.get(lesson.id) || false,
          hasAssignment: !!lesson.assignment_id,
          assignmentId: lesson.assignment_id,
          assignmentSubmitted: lesson.assignment_id ? submittedAssignments.has(lesson.assignment_id) : false,
          assignmentDeclined: lesson.assignment_id ? declinedAssignments.has(lesson.assignment_id) : false,
          lockReason: hasVideoBypass ? null : unlockStatus?.lockReason || null,
          dripUnlockDate: hasVideoBypass ? null : unlockStatus?.dripUnlockDate || null,
          blockingLessonTitle: null,
          blockingAssignmentDeclined: false,
        };
      });

      // Consistency fix + identify the precise predecessor blocking each locked lesson
      const sortedRecordings = [...processedRecordings].sort((a, b) => {
        if (a.module_order !== b.module_order) return a.module_order - b.module_order;
        return a.sequence_order - b.sequence_order;
      });

      for (let i = 1; i < sortedRecordings.length && !hasVideoBypass; i++) {
        const current = sortedRecordings[i];
        const blockingByPreviousAssignment =
          current.lockReason === 'previous_assignment_not_approved' ||
          current.lockReason === 'previous_assignment_not_submitted';

        if (!current.isUnlocked && blockingByPreviousAssignment) {
          // Walk backwards to find the actual blocking predecessor
          let allPredecessorsMet = true;
          let blocker: typeof current | null = null;
          for (let j = i - 1; j >= 0; j--) {
            const pred = sortedRecordings[j];
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
            // Sharper reason if the blocker has a declined submission
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
      // Walks backwards through ALL prior lessons (not just the immediate one), because
      // a lesson without an assignment between two assignment-gated lessons would
      // otherwise let the chain "leak" — e.g. lesson 5 stays unlocked because lesson 4
      // has no assignment, even though lesson 2's assignment is still pending.
      for (let i = 1; i < sortedRecordings.length && !hasVideoBypass; i++) {
        const current = sortedRecordings[i];
        if (!current.isUnlocked) continue;

        let blocker: typeof current | null = null;
        let reason: CourseRecording['lockReason'] | null = null;

        for (let j = i - 1; j >= 0; j--) {
          const pred = sortedRecordings[j];

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


      if (studentLMSStatus === 'active' && !hasVideoBypass) {
        const sortedBySequence = [...processedRecordings].sort((a, b) => {
          if (a.module_order !== b.module_order) return a.module_order - b.module_order;
          return a.sequence_order - b.sequence_order;
        });
        
        const hasFeesNotCleared = sortedBySequence.some(r => r.lockReason === 'fees_not_cleared');
        if (hasFeesNotCleared) {
          let canUnlockNext = true;
          for (const rec of sortedBySequence) {
            if (rec.lockReason !== 'fees_not_cleared' && rec.lockReason !== 'fees_cleared') continue;
            const original = processedRecordings.find(r => r.id === rec.id)!;
            if (canUnlockNext) {
              original.isUnlocked = true;
              original.lockReason = null;
              // Determine if this blocks the next one
              if (!original.isWatched) {
                canUnlockNext = false;
              } else if (original.hasAssignment && !approvedAssignments.has(original.assignmentId)) {
                canUnlockNext = false;
              }
            } else {
              // Keep locked but fix the reason
              original.lockReason = 'previous_lesson_not_watched';
            }
          }
        }
      }

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
