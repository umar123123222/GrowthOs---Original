CREATE OR REPLACE FUNCTION public.award_xp_on_recording_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_metrics (user_id, source, metric, value, date, fetched_at)
  VALUES (NEW.student_id, 'lms', 'rating_reward_xp', 2, CURRENT_DATE, now())
  ON CONFLICT (user_id, source, metric, date)
  DO UPDATE SET
    value = public.user_metrics.value + EXCLUDED.value,
    fetched_at = now();

  RETURN NEW;
END;
$$;