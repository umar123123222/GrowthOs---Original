import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { FEEDBACK_GATE_ROLLOUT_AT, FEEDBACK_RATED_EVENT } from '@/config/feedback-gate';
import { logger } from '@/lib/logger';

interface PendingLesson {
  recordingId: string;
  lessonTitle: string;
  watchedAt: string;
}

interface UsePendingFeedbackResult {
  loading: boolean;
  count: number;
  pending: PendingLesson[];
  refresh: () => Promise<void>;
}

/**
 * Fetches the student's watched-but-unrated lessons (post-rollout only),
 * filtered to lessons whose course the student still has active access to.
 * Returns them ordered most-recent-first.
 */
export function usePendingFeedback(): UsePendingFeedbackResult {
  const { user } = useAuth();
  const [pending, setPending] = useState<PendingLesson[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user?.id || user.role !== 'student') {
      setPending([]);
      return;
    }
    setLoading(true);
    try {
      // 1. Recent post-rollout watches
      const { data: views, error: viewsErr } = await supabase
        .from('recording_views')
        .select('recording_id, watched_at')
        .eq('user_id', user.id)
        .eq('watched', true)
        .gte('watched_at', FEEDBACK_GATE_ROLLOUT_AT)
        .order('watched_at', { ascending: false })
        .limit(50);

      if (viewsErr || !views || views.length === 0) {
        setPending([]);
        return;
      }

      const recordingIds = views.map(v => v.recording_id);

      // 2. Which are already rated
      const { data: ratings } = await supabase
        .from('recording_ratings')
        .select('recording_id')
        .eq('student_id', user.id)
        .in('recording_id', recordingIds);

      const ratedIds = new Set((ratings || []).map(r => r.recording_id));
      const unratedIds = recordingIds.filter(id => !ratedIds.has(id));
      if (unratedIds.length === 0) {
        setPending([]);
        return;
      }

      // 3. Fetch lesson + course, filter to student's currently accessible courses
      const { data: lessons } = await supabase
        .from('available_lessons')
        .select('id, recording_title, modules!inner(course_id)')
        .in('id', unratedIds);

      if (!lessons || lessons.length === 0) {
        setPending([]);
        return;
      }

      // Accessible courses via active enrollment
      const { data: enrollments } = await supabase
        .from('course_enrollments')
        .select('course_id')
        .eq('user_id', user.id);
      const accessibleCourseIds = new Set(
        (enrollments || []).map(e => e.course_id).filter(Boolean)
      );

      const lessonById = new Map(
        (lessons as any[]).map(l => [l.id, {
          title: l.recording_title || 'this lesson',
          courseId: l.modules?.course_id as string | undefined,
        }])
      );

      const watchedAtById = new Map(views.map(v => [v.recording_id, v.watched_at]));

      const result: PendingLesson[] = [];
      for (const id of unratedIds) {
        const meta = lessonById.get(id);
        if (!meta) continue;
        // If we can determine the course and student isn't enrolled, skip
        if (meta.courseId && accessibleCourseIds.size > 0 && !accessibleCourseIds.has(meta.courseId)) {
          continue;
        }
        result.push({
          recordingId: id,
          lessonTitle: meta.title,
          watchedAt: watchedAtById.get(id) || '',
        });
      }

      setPending(result);
    } catch (err) {
      logger.error('usePendingFeedback: failed to load', err);
      setPending([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Refresh when a rating is submitted anywhere
  useEffect(() => {
    const handler = () => { refresh(); };
    window.addEventListener(FEEDBACK_RATED_EVENT, handler);
    return () => window.removeEventListener(FEEDBACK_RATED_EVENT, handler);
  }, [refresh]);

  return { loading, count: pending.length, pending, refresh };
}
