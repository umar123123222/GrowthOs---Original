import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const TOKEN_KEY = 'lms_session_token';
const HEARTBEAT_MS = 30_000;

type Activity = {
  type: 'video' | 'page';
  recording_id?: string;
  title?: string;
  path?: string;
  started_at?: string;
} | null;

function getOrCreateToken(): string {
  try {
    let t = localStorage.getItem(TOKEN_KEY);
    if (!t) {
      t = (crypto as any).randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(TOKEN_KEY, t);
    }
    return t;
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
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

async function fingerprint(): Promise<string> {
  const data = [
    navigator.userAgent,
    navigator.platform,
    `${screen.width}x${screen.height}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ].join('|');
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
  } catch {
    return btoa(data).slice(0, 32);
  }
}

let currentActivity: Activity = null;

type Coords = { latitude: number; longitude: number; accuracy?: number; ts: number };
let cachedCoords: Coords | null = null;
let lastGeoAttempt = 0;
const GEO_TTL_MS = 10 * 60_000;
const GEO_RETRY_MS = 60_000;

function requestCoords(): Promise<Coords | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    const timeoutId = window.setTimeout(() => resolve(null), 8000);
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          window.clearTimeout(timeoutId);
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            ts: Date.now(),
          });
        },
        () => {
          window.clearTimeout(timeoutId);
          resolve(null);
        },
        { enableHighAccuracy: true, maximumAge: 5 * 60_000, timeout: 7000 }
      );
    } catch {
      window.clearTimeout(timeoutId);
      resolve(null);
    }
  });
}

async function ensureCoords(): Promise<Coords | null> {
  const now = Date.now();
  if (cachedCoords && now - cachedCoords.ts < GEO_TTL_MS) return cachedCoords;
  if (now - lastGeoAttempt < GEO_RETRY_MS && cachedCoords) return cachedCoords;
  lastGeoAttempt = now;
  const c = await requestCoords();
  if (c) cachedCoords = c;
  return cachedCoords;
}

export function setSessionActivity(a: Activity) {
  currentActivity = a;
  try {
    window.dispatchEvent(new CustomEvent('lms:session-activity-changed'));
  } catch {
    /* noop */
  }
}

export function useSessionHeartbeat(userId?: string | null) {
  const tokenRef = useRef<string>(getOrCreateToken());
  const fpRef = useRef<string>('');
  const timerRef = useRef<number | null>(null);

  const ping = useCallback(async (extra?: { end?: boolean }) => {
    if (!userId) return;
    try {
      const ua = navigator.userAgent;
      const coords = extra?.end ? null : await ensureCoords();
      await supabase.functions.invoke('session-heartbeat', {
        body: {
          session_token: tokenRef.current,
          device_fingerprint: fpRef.current,
          user_agent: ua,
          device_label: getDeviceLabel(ua),
          current_activity: currentActivity,
          coords: coords
            ? { latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy }
            : null,
          ...(extra || {}),
        },
      });
    } catch {
      /* swallow */
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      fpRef.current = await fingerprint();
      if (cancelled) return;
      ping();
      timerRef.current = window.setInterval(ping, HEARTBEAT_MS);
    })();

    const onActivity = () => ping();
    window.addEventListener('lms:session-activity-changed', onActivity);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') ping();
    };
    document.addEventListener('visibilitychange', onVisibility);

    const onUnload = () => {
      try {
        const url = `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/session-heartbeat`;
        const blob = new Blob(
          [JSON.stringify({ session_token: tokenRef.current, end: true })],
          { type: 'application/json' }
        );
        navigator.sendBeacon?.(url, blob);
      } catch {
        /* noop */
      }
    };
    window.addEventListener('beforeunload', onUnload);

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      window.removeEventListener('lms:session-activity-changed', onActivity);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [userId, ping]);
}
