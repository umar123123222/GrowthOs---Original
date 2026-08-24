import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type CaptureSignal =
  | 'screen_capture'
  | 'extension'
  | 'devtools'
  | 'screenshot_key'
  | 'picture_in_picture';

// Hard signals => immediate silent suspension. Soft signals => evidence only.
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
  // Download managers
  '[id*="idmmzcc" i]',
  '[class*="idm-download" i]',
  '[id*="idm_download" i]',
  '[class*="idmbtn" i]',
  '[id*="flashgot" i]',
  '[id*="fdm-" i]',
  '[class*="freedownloadmanager" i]',
  '[id*="jdownloader" i]',
  // Video grabbers
  '[id*="video-downloader" i]',
  '[class*="video-downloader" i]',
  '[id*="videodownloader" i]',
  '[id*="downloadhelper" i]',
  '[class*="downloadhelper" i]',
  '[id*="savefrom" i]',
  '[class*="savefrom" i]',
  '[id*="cococut" i]',
  '[class*="cococut" i]',
  '[id*="getthemall" i]',
  '[id*="vget" i]',
  '[class*="vidown" i]',
  '[id*="m3u8" i]',
  '[class*="hls-downloader" i]',
  '[id*="streamrecorder" i]',
  '[id*="vidiq" i]',
  // Screen recorders / screenshotters
  '[id*="screen-recorder" i]',
  '[class*="screen-recorder" i]',
  '[id*="screenrecorder" i]',
  '[id*="screencastify" i]',
  '[class*="screencastify" i]',
  '[id*="loom-companion" i]',
  '[class*="loom-record" i]',
  '[id*="awesome-screenshot" i]',
  '[id*="nimbus-screenshot" i]',
  '[class*="scrnli" i]',
  '[id*="bandicam" i]',
  '[id*="vidyard-record" i]',
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

  // Extension-injected assets embedded straight into the page.
  try {
    const injected = document.querySelector(
      'img[src^="chrome-extension://"], iframe[src^="chrome-extension://"], link[href^="chrome-extension://"], img[src^="moz-extension://"], iframe[src^="moz-extension://"]',
    );
    if (injected) return 'chrome-extension-resource';
  } catch {
    /* noop */
  }

  // A forced download anchor pointing at a media file next to the player.
  try {
    const anchors = Array.from(document.querySelectorAll('a[download]')) as HTMLAnchorElement[];
    const media = anchors.find((a) => /\.(mp4|m3u8|ts|webm|mkv)(\?|$)/i.test(a.href || ''));
    if (media) return 'injected-download-anchor';
  } catch {
    /* noop */
  }

  return null;
}

function detectDevtools(): boolean {
  const wThreshold = window.outerWidth - window.innerWidth > 200;
  const hThreshold = window.outerHeight - window.innerHeight > 220;
  return wThreshold || hThreshold;
}

/**
 * Detection-only capture guard.
 * Nothing is blocked and nothing is shown to the user: hard signals silently
 * report the incident (which suspends the account server-side) and sign out.
 */
export function useCaptureGuard(userId?: string | null) {
  const lastReportRef = useRef<Record<string, number>>({});
  const suspendedRef = useRef(false);

  const report = useCallback(
    async (signal: CaptureSignal, metadata?: Record<string, unknown>) => {
      if (!userId) return null;
      try {
        const { data } = await supabase.functions.invoke('report-security-incident', {
          body: {
            signal,
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

  const trigger = useCallback(
    async (signal: CaptureSignal, metadata?: Record<string, unknown>) => {
      if (!userId || suspendedRef.current) return;

      const now = Date.now();
      const last = lastReportRef.current[signal] ?? 0;
      if (now - last < COOLDOWN_MS) return;
      lastReportRef.current[signal] = now;

      // Auto-suspension is disabled: every signal is logged as evidence only,
      // no sign-out and no account action.
      await report(signal, metadata);
    },
    [userId, report],
  );

  useEffect(() => {
    if (!userId) return;

    // 1. Screen capture / recording APIs
    const md = navigator.mediaDevices as (MediaDevices & {
      getDisplayMedia?: (c?: DisplayMediaStreamOptions) => Promise<MediaStream>;
    }) | undefined;
    const originalGDM = md?.getDisplayMedia?.bind(md);
    if (md && originalGDM) {
      md.getDisplayMedia = async (constraints?: DisplayMediaStreamOptions) => {
        void trigger('screen_capture', { api: 'getDisplayMedia' });
        return originalGDM(constraints);
      };
    }

    const OriginalRecorder = window.MediaRecorder;
    if (OriginalRecorder) {
      const Patched = function (this: unknown, stream: MediaStream, options?: MediaRecorderOptions) {
        void trigger('screen_capture', { api: 'MediaRecorder' });
        return new OriginalRecorder(stream, options);
      } as unknown as typeof MediaRecorder;
      Patched.isTypeSupported = OriginalRecorder.isTypeSupported?.bind(OriginalRecorder);
      window.MediaRecorder = Patched;
    }

    // 2. Extension artifacts — initial sweep + live DOM mutations
    const sweep = () => {
      const hit = detectExtensionArtifacts();
      if (hit) void trigger('extension', { fingerprint: hit });
    };
    sweep();
    const observer = new MutationObserver(() => sweep());
    observer.observe(document.documentElement, { childList: true, subtree: true });
    const sweepInterval = window.setInterval(sweep, 5000);

    // 3. Picture-in-Picture capture
    const onPip = () => void trigger('picture_in_picture', { api: 'enterpictureinpicture' });
    document.addEventListener('enterpictureinpicture', onPip, true);

    // 4. Soft evidence: devtools + screenshot shortcuts
    const devtoolsInterval = window.setInterval(() => {
      if (detectDevtools()) void trigger('devtools', {});
    }, 4000);

    const onKey = (e: KeyboardEvent) => {
      const key = e.key?.toLowerCase();
      const isPrint = key === 'printscreen';
      const isWinSnip = e.shiftKey && (e.metaKey || e.ctrlKey) && key === 's';
      const isMacShot = e.metaKey && e.shiftKey && ['3', '4', '5'].includes(key);
      if (isPrint || isWinSnip || isMacShot) {
        void trigger('screenshot_key', { key: e.key });
      }
    };
    window.addEventListener('keydown', onKey, true);

    return () => {
      if (md && originalGDM) md.getDisplayMedia = originalGDM;
      if (OriginalRecorder) window.MediaRecorder = OriginalRecorder;
      observer.disconnect();
      window.clearInterval(sweepInterval);
      window.clearInterval(devtoolsInterval);
      document.removeEventListener('enterpictureinpicture', onPip, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [userId, trigger]);
}

export default useCaptureGuard;
