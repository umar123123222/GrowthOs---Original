import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Dynamic identity watermark rendered on top of the Bunny Stream embed.
 *
 * SECURITY NOTE (v1 deterrent only):
 * This is a client-side DOM overlay. A technical user can remove it with dev
 * tools, since it is not burned into the video pixels. It exists to deter
 * casual screen recording / phone-camera capture and to make leaked footage
 * traceable back to an account.
 *
 * To upgrade to a server-side burned-in watermark later, keep this component's
 * boundary: the identity string is produced by `buildWatermarkText()` below.
 * Swap the render for an encoder/transcode step (or a Bunny overlay/DRM
 * pipeline) that stamps the same string into the stream, and leave the call
 * site in the player untouched.
 */

type Identity = {
  studentId: string | null;
  label: string | null;
};

// Nine safe anchor positions inside the video bounds (percentages).
const POSITIONS = [
  { top: '8%', left: '6%' },
  { top: '8%', left: '38%' },
  { top: '8%', left: '64%' },
  { top: '44%', left: '6%' },
  { top: '44%', left: '38%' },
  { top: '44%', left: '64%' },
  { top: '82%', left: '6%' },
  { top: '82%', left: '38%' },
  { top: '82%', left: '64%' },
];

function formatNow() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function buildWatermarkText(identity: Identity, stamp: string) {
  return [identity.label, identity.studentId ? `ID: ${identity.studentId}` : null, stamp]
    .filter(Boolean)
    .join(' · ');
}

export function VideoWatermark() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [posIndex, setPosIndex] = useState(() => Math.floor(Math.random() * POSITIONS.length));
  const [stamp, setStamp] = useState(formatNow);

  // Identity always comes fresh from the auth session — never from props.
  useEffect(() => {
    let active = true;

    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user || !active) return;

      const [{ data: profile }, { data: student }] = await Promise.all([
        supabase.from('users').select('full_name, email').eq('id', user.id).maybeSingle(),
        supabase.from('students').select('student_id').eq('user_id', user.id).maybeSingle(),
      ]);

      if (!active) return;
      setIdentity({
        studentId: student?.student_id ?? null,
        label: profile?.full_name || profile?.email || user.email || null,
      });
    })();

    return () => {
      active = false;
    };
  }, []);

  // Live clock.
  useEffect(() => {
    const id = window.setInterval(() => setStamp(formatNow()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  // Reposition every 8-15s so the mark cannot simply be cropped out.
  useEffect(() => {
    let timeoutId: number;

    const schedule = () => {
      const delay = 8000 + Math.random() * 7000;
      timeoutId = window.setTimeout(() => {
        setPosIndex((prev) => {
          let next = Math.floor(Math.random() * POSITIONS.length);
          if (next === prev) next = (next + 1) % POSITIONS.length;
          return next;
        });
        schedule();
      }, delay);
    };

    schedule();
    return () => window.clearTimeout(timeoutId);
  }, []);

  if (!identity || (!identity.label && !identity.studentId)) return null;

  const pos = POSITIONS[posIndex];

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden select-none"
    >
      <span
        className="absolute whitespace-nowrap text-[11px] sm:text-xs md:text-sm font-medium tracking-wide transition-all duration-1000 ease-in-out"
        style={{
          top: pos.top,
          left: pos.left,
          color: 'rgba(255,255,255,0.3)',
          textShadow: '0 1px 2px rgba(0,0,0,0.65), 0 0 1px rgba(0,0,0,0.8)',
        }}
      >
        {buildWatermarkText(identity, stamp)}
      </span>
    </div>
  );
}

export default VideoWatermark;
