import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type CaptureSignal =
  | 'screen_capture'
  | 'extension'
  | 'devtools'
  | 'screenshot_key'
  | 'picture_in_picture';

const HARD_SIGNALS: CaptureSignal[] = ['screen_capture', 'extension', 'picture_in_picture'];
const COOLDOWN_MS = 30_000;

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

// DOM footprints commonly injected by video downloader / recorder extensions.
const EXTENSION_SELECTORS = [
  '[id*="video-downloader" i]',
  '[class*="video-downloader" i]',
  '[id*="videodownloader" i]',
  '[id*="downloadhelper" i]',
  '[class*="downloadhelper" i]',
  '[id*="savefrom" i]',
  '[class*="savefrom" i]',
  '[id*="flashgot" i]',
  '[id*="idmmzcc" i]',
  '[class*="idm-download" i]',
  '[id*="screen-recorder" i]',
  '[class*="screen-recorder" i]',
  '[id*="screenrecorder" i]',
  '[id*="loom-companion" i]',
  '[class*="loom-record" i]',
  '[id*="awesome-screenshot" i]',
  '[id*="nimbus-screenshot" i]',
  '[class*="scrnli" i]',
  '[id*="vidiq" i]',
  '[data-extension-id]',
];

function detectExtensionArtifacts(): string | null {
  for (const sel of EXTENSION_SELECTORS) {
    try {
      if (document.querySelector(sel)) return sel;
    } catch {
      /* invalid selector, skip */
    }
  }
  return null;
}

function detectDevtools(): boolean {
  const wThreshold = window.outerWidth - window.innerWidth > 200;
  const hThreshold = window.outerHeight - window.innerHeight > 220;
  return wThreshold || hThreshold;
}

type GuardState = {
  active: boolean;
  signal: CaptureSignal | null;
  secondsLeft: number;
};

export function useCaptureGuard(userId?: string | null) {
  const [state, setState] = useState<GuardState>({ active: false, signal: null, secondsLeft: 5 });
  const [suspended, setSuspended] = useState(false);
  const lastReportRef = useRef<Record<string, number>>({});
  const countdownRef = useRef<number | null>(null);
  const activeSignalRef = useRef<CaptureSignal | null>(null);

  const report = useCallback(
    async (signal: CaptureSignal, phase: 'detected' | 'expired', metadata?: Record<string, unknown>) => {
      if (!userId) return null;
      try {
        const { data } = await supabase.functions.invoke('report-security-incident', {
          body: {
            signal,
            phase,
            page_url: window.location.href,
            device_label: getDeviceLabel(navigator.userAgent),
            metadata: metadata ?? {},
          },
        });
        return data as { suspended?: boolean } | null;
      } catch {
        return null;
      }
    },
    [userId],
  );

  const enforceSuspend = useCallback(async (signal: CaptureSignal) => {
    setSuspended(true);
    await report(signal, 'expired');
    try {
      await supabase.auth.signOut();
    } catch {
      /* noop */
    }
    window.location.replace('/login?suspended=capture');
  }, [report]);

  const trigger = useCallback(
    async (signal: CaptureSignal, metadata?: Record<string, unknown>) => {
      if (!userId || suspended) return;
      const now = Date.now();
      if (now - (lastReportRef.current[signal] ?? 0) < COOLDOWN_MS) return;
      lastReportRef.current[signal] = now;

      const res = await report(signal, 'detected', metadata);
      if (res?.suspended) {
        // Repeat offence — server already suspended the account.
        setSuspended(true);
        try {
          await supabase.auth.signOut();
        } catch {
          /* noop */
        }
        window.location.replace('/login?suspended=capture');
        return;
      }

      // Only hard signals escalate to auto-suspend after the countdown.
      activeSignalRef.current = signal;
      setState({ active: true, signal, secondsLeft: 5 });
    },
    [userId, suspended, report],
  );

  // Countdown handling
  useEffect(() => {
    if (!state.active) {
      if (countdownRef.current) window.clearInterval(countdownRef.current);
      countdownRef.current = null;
      return;
    }
    countdownRef.current = window.setInterval(() => {
      setState((prev) => {
        if (!prev.active) return prev;
        const next = prev.secondsLeft - 1;
        if (next <= 0) {
          const sig = prev.signal;
          const isHard = sig ? HARD_SIGNALS.includes(sig) : false;
          if (sig && isHard) {
            void enforceSuspend(sig);
            return { active: true, signal: sig, secondsLeft: 0 };
          }
          return { active: false, signal: null, secondsLeft: 5 };
        }
        return { ...prev, secondsLeft: next };
      });
    }, 1000);
    return () => {
      if (countdownRef.current) window.clearInterval(countdownRef.current);
      countdownRef.current = null;
    };
  }, [state.active, enforceSuspend]);

  // Detectors
  useEffect(() => {
    if (!userId) return;

    // 1) Screen capture API
    const md = navigator.mediaDevices as MediaDevices | undefined;
    let originalGDM: typeof navigator.mediaDevices.getDisplayMedia | null = null;
    if (md && typeof md.getDisplayMedia === 'function') {
      originalGDM = md.getDisplayMedia.bind(md);
      (md as any).getDisplayMedia = async (constraints?: DisplayMediaStreamOptions) => {
        void trigger('screen_capture', { via: 'getDisplayMedia' });
        return originalGDM!(constraints as any);
      };
    }

    // Also catch already-running display captures
    const captureScan = window.setInterval(() => {
      try {
        const anyDoc = document as any;
        if (anyDoc.pictureInPictureElement) {
          void trigger('picture_in_picture', { via: 'pip' });
        }
      } catch {
        /* noop */
      }
    }, 4000);

    const onEnterPip = () => void trigger('picture_in_picture', { via: 'enterpictureinpicture' });
    document.addEventListener('enterpictureinpicture', onEnterPip, true);

    // 2) Extension artifacts
    const extScan = window.setInterval(() => {
      const hit = detectExtensionArtifacts();
      if (hit) void trigger('extension', { selector: hit });
    }, 5000);

    const observer = new MutationObserver(() => {
      const hit = detectExtensionArtifacts();
      if (hit) void trigger('extension', { selector: hit, via: 'mutation' });
    });
    try {
      observer.observe(document.documentElement, { childList: true, subtree: true });
    } catch {
      /* noop */
    }

    // 3) Devtools + screenshot shortcuts (warning only)
    const devScan = window.setInterval(() => {
      if (detectDevtools()) void trigger('devtools', { via: 'window-size' });
    }, 5000);

    const onKey = (e: KeyboardEvent) => {
      const key = e.key;
      const isPrintScreen = key === 'PrintScreen';
      const isWinSnip = e.shiftKey && (e.metaKey || e.getModifierState?.('Meta')) && key.toLowerCase() === 's';
      const isMacShot = e.metaKey && e.shiftKey && ['3', '4', '5'].includes(key);
      if (isPrintScreen || isWinSnip || isMacShot) {
        void trigger('screenshot_key', { key });
      }
    };
    window.addEventListener('keydown', onKey, true);

    return () => {
      if (originalGDM && navigator.mediaDevices) {
        (navigator.mediaDevices as any).getDisplayMedia = originalGDM;
      }
      window.clearInterval(captureScan);
      window.clearInterval(extScan);
      window.clearInterval(devScan);
      document.removeEventListener('enterpictureinpicture', onEnterPip, true);
      window.removeEventListener('keydown', onKey, true);
      observer.disconnect();
    };
  }, [userId, trigger]);

  const dismiss = useCallback(() => {
    const sig = activeSignalRef.current;
    // Soft signals can be dismissed immediately; hard signals must wait out the timer.
    if (sig && HARD_SIGNALS.includes(sig)) return;
    setState({ active: false, signal: null, secondsLeft: 5 });
  }, []);

  return { ...state, suspended, dismiss };
}
