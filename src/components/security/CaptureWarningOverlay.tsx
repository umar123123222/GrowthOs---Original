import { useCaptureGuard } from '@/hooks/useCaptureGuard';

/**
 * Headless capture detector.
 *
 * Detection-only by design: the offender is never warned. Hard signals are
 * reported to `report-security-incident`, which suspends the account, revokes
 * sessions, logs the evidence and emails admins. This component renders nothing.
 */
export function CaptureWarningOverlay({ userId }: { userId?: string | null }) {
  useCaptureGuard(userId);
  return null;
}

export default CaptureWarningOverlay;
