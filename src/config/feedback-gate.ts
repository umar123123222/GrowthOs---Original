/**
 * Rollout timestamp for the "rate to unlock next lesson" feedback gate.
 *
 * Only lessons that a student watches on/after this date will require a rating
 * before the next lesson unlocks. Anything watched before this date is
 * grandfathered and does NOT block progression, so students never see a backlog
 * of pending-feedback prompts.
 *
 * Change this value only if you want to shift the effective start date.
 */
export const FEEDBACK_GATE_ROLLOUT_AT = '2026-07-11T00:00:00Z';

/** XP awarded to a student for submitting a rating on a lesson. */
export const FEEDBACK_XP_REWARD = 2;

/** Custom event name fired after a rating is submitted, so listing hooks refresh. */
export const FEEDBACK_RATED_EVENT = 'lovable:recording-rated';

export const isWatchInGateWindow = (watchedAt: string | null | undefined): boolean => {
  if (!watchedAt) return false;
  return new Date(watchedAt).getTime() >= new Date(FEEDBACK_GATE_ROLLOUT_AT).getTime();
};
