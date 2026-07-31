import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { useCaptureGuard, type CaptureSignal } from '@/hooks/useCaptureGuard';
import { Button } from '@/components/ui/button';

const SIGNAL_TEXT: Record<CaptureSignal, string> = {
  screen_capture: 'Screen recording / capture tool detected.',
  extension: 'A downloader or recorder extension was detected.',
  picture_in_picture: 'Video capture (Picture-in-Picture) detected.',
  devtools: 'Developer tools are open.',
  screenshot_key: 'Screenshot capture shortcut detected.',
};

const SOFT: CaptureSignal[] = ['devtools', 'screenshot_key'];

export function CaptureWarningOverlay({ userId }: { userId?: string | null }) {
  const { active, signal, secondsLeft, suspended, dismiss } = useCaptureGuard(userId);

  if (!active && !suspended) return null;

  const isSoft = signal ? SOFT.includes(signal) : false;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
      <div className="max-w-md w-full rounded-lg border border-destructive/40 bg-card p-6 text-center shadow-lg">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          {suspended ? (
            <ShieldAlert className="h-7 w-7 text-destructive" />
          ) : (
            <AlertTriangle className="h-7 w-7 text-destructive" />
          )}
        </div>

        <h2 className="text-xl font-semibold text-destructive">
          {suspended ? 'Account suspended' : 'Recording detected'}
        </h2>

        <p className="mt-2 text-sm text-muted-foreground">
          {suspended
            ? 'Your account has been suspended for attempting to record or download protected content. Contact support to restore access.'
            : `${signal ? SIGNAL_TEXT[signal] : 'Suspicious capture activity detected.'} Stop it immediately.`}
        </p>

        {!suspended && (
          <>
            <div className="mt-6 text-5xl font-bold tabular-nums text-destructive">{secondsLeft}</div>
            <p className="mt-2 text-xs text-muted-foreground">
              {isSoft
                ? 'This activity has been logged and reported to the administrators.'
                : 'Your account will be suspended automatically when this timer reaches zero.'}
            </p>
            {isSoft && (
              <Button variant="outline" className="mt-4" onClick={dismiss}>
                I understand
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default CaptureWarningOverlay;
