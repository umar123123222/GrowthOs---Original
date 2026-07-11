import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { LectureRating } from '@/components/LectureRating';
import { FEEDBACK_GATE_ROLLOUT_AT, FEEDBACK_RATED_EVENT } from '@/config/feedback-gate';
import { logger } from '@/lib/logger';

const SESSION_FLAG_KEY = 'lovable:pending-feedback-prompt-shown';

interface PendingLesson {
  recordingId: string;
  lessonTitle: string;
}

/**
 * On first mount per browser session, checks whether the student has any
 * watched-but-unrated lesson (post-rollout) and, if so, auto-opens the rating
 * modal for the most recent one so they can't miss it after logging back in.
 */
export function PendingFeedbackPrompt() {
  const { user } = useAuth();
  const [pending, setPending] = useState<PendingLesson | null>(null);

  useEffect(() => {
    if (!user?.id || user.role !== 'student') return;
    if (sessionStorage.getItem(SESSION_FLAG_KEY) === '1') return;

    let cancelled = false;

    const findPending = async () => {
      try {
        // Most recent watched lesson post-rollout
        const { data: views, error: viewsErr } = await supabase
          .from('recording_views')
          .select('recording_id, watched_at')
          .eq('user_id', user.id)
          .eq('watched', true)
          .gte('watched_at', FEEDBACK_GATE_ROLLOUT_AT)
          .order('watched_at', { ascending: false })
          .limit(25);

        if (viewsErr || !views || views.length === 0) return;

        const recordingIds = views.map(v => v.recording_id);

        const { data: ratings } = await supabase
          .from('recording_ratings')
          .select('recording_id')
          .eq('student_id', user.id)
          .in('recording_id', recordingIds);

        const ratedIds = new Set((ratings || []).map(r => r.recording_id));
        const unrated = views.find(v => !ratedIds.has(v.recording_id));
        if (!unrated) return;

        const { data: lesson } = await supabase
          .from('available_lessons')
          .select('id, recording_title')
          .eq('id', unrated.recording_id)
          .maybeSingle();

        if (cancelled || !lesson) return;

        sessionStorage.setItem(SESSION_FLAG_KEY, '1');
        setPending({
          recordingId: lesson.id,
          lessonTitle: lesson.recording_title || 'this lesson',
        });
      } catch (err) {
        logger.error('PendingFeedbackPrompt: failed to check pending feedback', err);
      }
    };

    findPending();

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (!pending) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.recordingId === pending.recordingId) {
        setPending(null);
      }
    };
    window.addEventListener(FEEDBACK_RATED_EVENT, handler);
    return () => window.removeEventListener(FEEDBACK_RATED_EVENT, handler);
  }, [pending]);

  if (!pending) return null;

  return (
    <LectureRating
      recordingId={pending.recordingId}
      lessonTitle={pending.lessonTitle}
      isModalOpen={true}
      mandatory={true}
      onClose={() => setPending(null)}
    />
  );
}
