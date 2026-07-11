
-- Award XP metric when a student submits a video rating (feedback gate reward).
CREATE OR REPLACE FUNCTION public.award_xp_on_recording_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_metrics (user_id, source, metric, value, date, fetched_at)
  VALUES (NEW.student_id, 'lms', 'rating_reward_xp', 2, CURRENT_DATE, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_xp_on_recording_rating ON public.recording_ratings;
CREATE TRIGGER trg_award_xp_on_recording_rating
AFTER INSERT ON public.recording_ratings
FOR EACH ROW
EXECUTE FUNCTION public.award_xp_on_recording_rating();
