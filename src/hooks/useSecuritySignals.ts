import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Lightweight, NON-PUNITIVE signal logger for the video player.
 *
 * IMPORTANT: every signal below is a heuristic and is expected to produce
 * false positives — a student may legitimately open DevTools, switch tabs to
 * take notes, or share their screen in a study call. Nothing here blocks,
 * suspends, signs out or otherwise punishes a student. The data exists purely
 * so admins can review PATTERNS over time and decide manually.
 *
 * Also note: browsers cannot see OBS, IDM or most third-party downloaders at
 * all. This is best-effort logging plus soft friction, never a guarantee.
 */

export type SecuritySignalType =
  | 'devtools_open'
  | 'focus_loss_repeated'
  | 'display_capture_api'
  | 'user_media_api'
  | 'downloader_extension_fingerprint';

// Threshold of DISTINCT signal types in one playback session before the
// student sees a single, non-blocking informational banner.
const SOFT_WARNING_THRESHOLD = 3;
// Tab switches tolerated before the focus-loss signal is logged once.
const FOCUS_LOSS_THRESHOLD = 3;

// Manually maintained list of DOM/script fingerprints left behind by known
// downloader / recorder extensions. Deliberately small: broad matching creates
// noise, and a miss here is fine — this layer is advisory only.
const EXTENSION_FINGERPRINTS: string[] = [
  '[id*="idmmzcc" i]',
  '[class*="idm-download" i]',
  '[id*="flashgot" i]',
  '[id*="downloadhelper" i]',
  '[id*="savefrom" i]',
  '[id*="cococut" i]',
  '[id*="video-downloader" i]',
  '[class*="video-downloader" i]',
  '[id*="hls-downloader" i]',
  '[id*="streamrecorder" i]',
  '[id*="screencastify" i]',
  '[class*="loom-record" i]',
  '[id*="awesome-screenshot" i]',
  '[id*="nimbus-screenshot" i]',
];

function detectExtensionFingerprint(): string | null {
  for (const sel of EXTENSION_FINGERPRINTS) {
    try {
      if (document.querySelector(sel)) return sel;
    } catch {
      /* invalid selector — ignore */
    }
  }
  try {
    const injected = document.querySelector(
      'img[src^="chrome-extension://"], iframe[src^="chrome-extension://"], link[href^="chrome-extension://"], iframe[src^="moz-extension://"]',
    );
    if (injected) return 'extension-injected-resource';
  } catch {
    /* noop */
  }
  return null;
}

// Window-size delta heuristic. Docked DevTools shrink the viewport relative to
// the window; a maximised sidebar or zoom level can trip this too.
function devtoolsBySizeDelta(): boolean {
  return window.outerWidth - window.innerWidth > 220 || window.outerHeight - window.innerHeight > 240;
}

// Debugger-timing heuristic: a paused debugger makes this statement slow.
function devtoolsByDebuggerTiming(): boolean {
  const start = performance.now();
  // eslint-disable-next-line no-debugger
  debugger;
  return performance.now() - start > 120;
}

function getDeviceLabel(ua: string): string {
  let os = 'Unknown OS';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iOS/i.test(ua)) os = 'iOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let browser = 'Browser';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua)) browser = 'Safari';

  return `${browser} on ${os}`;
}

interface Options {
  userId?: string | null;
  videoId?: string | null;
  /** Only run while a video is actually on screen. */
  enabled?: boolean;
}

/**
 * Returns `showSoftWarning` — true once 3+ distinct signals fired in this
 * playback session. The banner is shown at most once per session and has no
 * other consequence.
 */
export function useSecuritySignals({ userId, videoId, enabled = true }: Options) {
  const [showSoftWarning, setShowSoftWarning] = useState(false);
  const sessionIdRef = useRef<string>('');
  const seenRef = useRef<Set<SecuritySignalType>>(new Set());
  const warnedRef = useRef(false);
  const focusLossCountRef = useRef(0);

  // A fresh playback session whenever the lesson changes.
  useEffect(() => {
    sessionIdRef.current =
      (globalThis.crypto?.randomUUID?.() as string) || `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    seenRef.current = new Set();
    warnedRef.current = false;
    focusLossCountRef.current = 0;
    setShowSoftWarning(false);
  }, [videoId]);

  const logSignal = useCallback(
    async (signalType: SecuritySignalType, details: Record<string, unknown> = {}) => {
      if (!userId) return;
      // Each distinct signal type is recorded once per playback session.
      if (seenRef.current.has(signalType)) return;
      seenRef.current.add(signalType);

      try {
        await supabase.from('security_signals').insert({
          student_id: userId,
          signal_type: signalType,
          video_id: videoId ?? null,
          session_id: sessionIdRef.current,
          page_url: window.location.href,
          device_label: getDeviceLabel(navigator.userAgent),
          details: details as never,
        } as never);
      } catch {
        // Logging must never disrupt playback.
      }

      if (!warnedRef.current && seenRef.current.size >= SOFT_WARNING_THRESHOLD) {
        warnedRef.current = true;
        setShowSoftWarning(true);
      }
    },
    [userId, videoId],
  );

  useEffect(() => {
    if (!enabled || !userId) return;

    // 1. DevTools (two heuristics, either one is enough — both false-positive prone)
    const devtoolsTimer = window.setInterval(() => {
      if (devtoolsBySizeDelta()) {
        void logSignal('devtools_open', { heuristic: 'window_size_delta' });
      } else if (devtoolsByDebuggerTiming()) {
        void logSignal('devtools_open', { heuristic: 'debugger_timing' });
      }
    }, 5000);

    // 2. Repeated loss of tab visibility / window focus (note-taking looks like this too)
    const onFocusLoss = (source: string) => {
      focusLossCountRef.current += 1;
      if (focusLossCountRef.current > FOCUS_LOSS_THRESHOLD) {
        void logSignal('focus_loss_repeated', { count: focusLossCountRef.current, source });
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') onFocusLoss('visibilitychange');
    };
    const onBlur = () => onFocusLoss('blur');
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);

    // 3. Our own page invoking screen/camera capture APIs
    const md = navigator.mediaDevices as
      | (MediaDevices & { getDisplayMedia?: (c?: DisplayMediaStreamOptions) => Promise<MediaStream> })
      | undefined;
    const originalGDM = md?.getDisplayMedia?.bind(md);
    if (md && originalGDM) {
      md.getDisplayMedia = (constraints?: DisplayMediaStreamOptions) => {
        void logSignal('display_capture_api', { api: 'getDisplayMedia' });
        return originalGDM(constraints);
      };
    }
    const originalGUM = md?.getUserMedia?.bind(md);
    if (md && originalGUM) {
      md.getUserMedia = (constraints?: MediaStreamConstraints) => {
        void logSignal('user_media_api', { api: 'getUserMedia' });
        return originalGUM(constraints);
      };
    }

    // 4. Known downloader-extension DOM fingerprints
    const sweep = () => {
      const hit = detectExtensionFingerprint();
      if (hit) void logSignal('downloader_extension_fingerprint', { fingerprint: hit });
    };
    sweep();
    const observer = new MutationObserver(sweep);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    const sweepTimer = window.setInterval(sweep, 8000);

    return () => {
      window.clearInterval(devtoolsTimer);
      window.clearInterval(sweepTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      observer.disconnect();
      if (md && originalGDM) md.getDisplayMedia = originalGDM;
      if (md && originalGUM) md.getUserMedia = originalGUM;
    };
  }, [enabled, userId, logSignal]);

  return { showSoftWarning, dismissSoftWarning: () => setShowSoftWarning(false) };
}

export default useSecuritySignals;
