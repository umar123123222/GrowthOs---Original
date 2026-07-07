import { useEffect, useState, useSyncExternalStore } from 'react';
import { progressBar } from '@/lib/progress-bar';

/**
 * Thin top progress bar that appears whenever any tracked async work is in-flight.
 * Uses a smooth "creep-to-90%" animation while active, then snaps to 100% and fades.
 */
export function GlobalProgressBar() {
  const activeCount = useSyncExternalStore(
    progressBar.subscribe,
    progressBar.getSnapshot,
    progressBar.getSnapshot,
  );
  const isActive = activeCount > 0;

  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let creepTimer: number | undefined;
    let hideTimer: number | undefined;

    if (isActive) {
      setVisible(true);
      setProgress((p) => (p < 10 ? 10 : p));
      // Creep towards 90% while work is happening.
      creepTimer = window.setInterval(() => {
        setProgress((p) => {
          if (p >= 90) return p;
          const remaining = 90 - p;
          return p + Math.max(0.5, remaining * 0.08);
        });
      }, 200);
    } else if (visible) {
      setProgress(100);
      hideTimer = window.setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 300);
    }

    return () => {
      if (creepTimer) window.clearInterval(creepTimer);
      if (hideTimer) window.clearTimeout(hideTimer);
    };
  }, [isActive, visible]);

  if (!visible) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none"
      aria-hidden="true"
    >
      <div
        className="h-[2px] bg-primary shadow-[0_0_8px_hsl(var(--primary)),0_0_2px_hsl(var(--primary))] transition-[width,opacity] duration-300 ease-out"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
        }}
      />
    </div>
  );
}
