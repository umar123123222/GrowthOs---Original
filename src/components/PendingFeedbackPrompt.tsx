import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { LectureRating } from '@/components/LectureRating';
import { usePendingFeedback } from '@/hooks/usePendingFeedback';

const SESSION_FLAG_KEY = 'lovable:pending-feedback-prompt-shown';

/**
 * On first mount per browser session, opens the rating modal for the
 * student's most recent watched-but-unrated lesson so they can't miss it
 * after logging back in. Dismissable via "Later" — the flag persists for
 * the session so it won't re-open on every route change.
 */
export function PendingFeedbackPrompt() {
  const { user } = useAuth();
  const { pending, loading } = usePendingFeedback();
  const [dismissed, setDismissed] = useState(false);
  const [checkedThisSession, setCheckedThisSession] = useState(false);

  useEffect(() => {
    if (!user?.id || user.role !== 'student') return;
    if (loading) return;
    if (checkedThisSession) return;

    // Mark session as checked whether or not we found something, so we don't
    // re-open on every navigation within this session.
    if (sessionStorage.getItem(SESSION_FLAG_KEY) !== '1') {
      sessionStorage.setItem(SESSION_FLAG_KEY, '1');
    }
    setCheckedThisSession(true);
  }, [user?.id, user?.role, loading, checkedThisSession]);

  // Only show the modal if we haven't shown one yet this session
  const shouldShow =
    user?.role === 'student' &&
    !dismissed &&
    !loading &&
    pending.length > 0 &&
    sessionStorage.getItem(SESSION_FLAG_KEY) === '1' &&
    // Only auto-open if the flag was set this render cycle (fresh login)
    checkedThisSession;

  if (!shouldShow) return null;

  const target = pending[0];

  return (
    <LectureRating
      recordingId={target.recordingId}
      lessonTitle={target.lessonTitle}
      isModalOpen={true}
      mandatory={false}
      onClose={() => setDismissed(true)}
    />
  );
}
