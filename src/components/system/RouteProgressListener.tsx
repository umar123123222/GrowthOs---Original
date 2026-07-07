import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { progressBar } from '@/lib/progress-bar';

/**
 * Ticks the global progress bar on every client-side route change so lazy-loaded
 * pages surface an immediate "something's happening" signal.
 */
export function RouteProgressListener() {
  const location = useLocation();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    progressBar.start();
    // Give the new route a beat to mount / suspend, then release.
    const t = window.setTimeout(() => progressBar.done(), 400);
    return () => window.clearTimeout(t);
  }, [location.pathname]);

  return null;
}
