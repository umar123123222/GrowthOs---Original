import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { logger } from "@/lib/logger";
import { VideoWatermark } from "@/components/security/VideoWatermark";
import { setSessionActivity } from "@/hooks/useSessionHeartbeat";
import { logUserActivity, ACTIVITY_TYPES } from "@/lib/activity-logger";

// Keep in sync with the sanitizing/converting rules in VideoPlayer.tsx
const sanitizeVideoUrl = (url: string): string => {
  if (!url) return "";
  const cleanUrl = url.trim();
  if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) return "";
  return cleanUrl;
};

const convertToEmbedUrl = (url: string): string => {
  if (!url) return "";
  if (url.includes("iframe.mediadelivery.net/embed/")) {
    const hasParams = url.includes("?");
    const bunnyParams = "autoplay=true&loop=false&muted=false&preload=true&responsive=true";
    return hasParams ? `${url}&${bunnyParams}` : `${url}?${bunnyParams}`;
  }
  if (url.includes("youtube.com/embed/") || url.includes("youtu.be/embed/")) return url;
  let videoId = "";
  if (url.includes("youtube.com/watch?v=") || (url.includes("youtube.com") && url.includes("v="))) {
    const match = url.match(/[?&]v=([^&]+)/);
    if (match) videoId = match[1];
  } else if (url.includes("youtu.be/")) {
    const match = url.match(/youtu\.be\/([^?&]+)/);
    if (match) videoId = match[1];
  }
  if (videoId) {
    videoId = videoId.split("&")[0].split("?")[0];
    return `https://www.youtube.com/embed/${videoId}`;
  }
  return url;
};

/**
 * Standalone "full tab" viewing experience.
 *
 * Rendered OUTSIDE the app Layout (see App.tsx route `/watch`) so the video
 * fills the whole browser tab with no sidebar or header clutter. It keeps the
 * same security and tracking pipeline as the in-app player: identity
 * watermark, video_access_events telemetry, session activity, and auto-mark
 * watched.
 */
const Watch = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState<string>(
    searchParams.get("title") ? decodeURIComponent(searchParams.get("title") || "") : "Lesson"
  );
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [urlError, setUrlError] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const recordingId = searchParams.get("id");

  // Load recording by id (available_lessons view), or fall back to ?url + ?title
  useEffect(() => {
    let cancelled = false;
    const urlParam = searchParams.get("url");
    if (urlParam) {
      setVideoUrl(decodeURIComponent(urlParam));
      return;
    }
    if (!recordingId) {
      setNotFound(true);
      return;
    }
    (async () => {
      try {
        const { data, error } = await supabase
          .from("available_lessons")
          .select("id, recording_title, recording_url")
          .eq("id", recordingId)
          .maybeSingle();
        if (cancelled) return;
        if (error) throw error;
        if (!data) {
          setNotFound(true);
          return;
        }
        if (data.recording_title) setTitle(data.recording_title);
        setVideoUrl(data.recording_url || "");
      } catch (e) {
        logger.error("Watch: failed to load recording", e);
        if (!cancelled) setNotFound(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recordingId, searchParams]);

  // Set iframe src via ref (keeps the raw URL out of the JSX/DOM source)
  useEffect(() => {
    if (!videoUrl || !iframeRef.current) return;
    const sanitized = sanitizeVideoUrl(videoUrl);
    if (!sanitized) {
      setUrlError(true);
      logger.error("Watch: invalid video URL detected", videoUrl);
      return;
    }
    setUrlError(false);
    iframeRef.current.src = convertToEmbedUrl(sanitized);
  }, [videoUrl]);

  // Fullscreen the wrapper (not the raw iframe) so the watermark stays visible
  useEffect(() => {
    const onFsChange = () => {
      const fsEl = document.fullscreenElement;
      const container = containerRef.current;
      if (fsEl && container && fsEl === iframeRef.current) {
        document
          .exitFullscreen()
          .then(() => container.requestFullscreen())
          .catch(() => {
            /* fullscreen redirect not permitted */
          });
        return;
      }
      setIsFullscreen(!!fsEl && fsEl === container);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Broadcast active viewing for session/device tracking
  useEffect(() => {
    if (!recordingId) return;
    setSessionActivity({
      type: "video",
      recording_id: recordingId,
      title,
      started_at: new Date().toISOString(),
    });
    return () => setSessionActivity(null);
  }, [recordingId, title]);

  // Access-pattern telemetry: one open event + heartbeats while tab is visible
  useEffect(() => {
    if (!user?.id || !recordingId) return;
    let cancelled = false;
    const logEvent = async (eventType: "open" | "heartbeat") => {
      try {
        await supabase.from("video_access_events").insert({
          user_id: user.id,
          recording_id: recordingId,
          event_type: eventType,
          user_agent: navigator.userAgent,
          page_url: window.location.href,
        });
      } catch {
        /* telemetry must never break playback */
      }
    };
    (async () => {
      await logEvent("open");
      if (cancelled) return;
      try {
        await supabase.functions.invoke("detect-capture-patterns", { body: { mode: "self" } });
      } catch {
        /* noop */
      }
    })();
    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === "visible") void logEvent("heartbeat");
    }, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(heartbeat);
    };
  }, [user?.id, recordingId]);

  // Auto-mark watched (same behavior as the in-app player)
  useEffect(() => {
    const autoMarkWatched = async () => {
      if (!user?.id || !recordingId) return;
      try {
        const { data: prior } = await supabase
          .from("recording_views")
          .select("watched")
          .eq("user_id", user.id)
          .eq("recording_id", recordingId)
          .maybeSingle();
        const alreadyWatched = !!prior?.watched;
        await supabase.from("recording_views").upsert(
          {
            user_id: user.id,
            recording_id: recordingId,
            watched: true,
            watched_at: new Date().toISOString(),
          },
          { onConflict: "user_id,recording_id" }
        );
        logUserActivity({
          user_id: user.id,
          activity_type: "video_opened",
          reference_id: recordingId,
          metadata: { video_title: title, timestamp: new Date().toISOString() },
        });
        if (!alreadyWatched) {
          logUserActivity({
            user_id: user.id,
            activity_type: ACTIVITY_TYPES.VIDEO_WATCHED,
            reference_id: recordingId,
            metadata: { video_title: title, timestamp: new Date().toISOString() },
          });
        }
      } catch (error) {
        logger.error("Watch: error auto-marking video watched", error);
      }
    };
    autoMarkWatched();
  }, [user?.id, recordingId, title]);

  return (
    <div className="fixed inset-0 flex flex-col bg-black">
      {/* Slim control bar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-gray-950 border-b border-white/10 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="text-gray-200 hover:bg-white/10 hover:text-white"
          onClick={() => navigate("/videos")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Videos
        </Button>
        <p className="flex-1 truncate text-sm font-medium text-gray-200">{title}</p>
      </div>

      {/* Video area */}
      <div className="flex-1 min-h-0 flex items-center justify-center bg-black p-2 sm:p-4">
        <div
          ref={containerRef}
          className={`relative w-full ${
            isFullscreen
              ? "h-full"
              : "max-w-[1400px] max-h-full aspect-video"
          } ${isFullscreen ? "" : "mx-auto"}`}
        >
          {notFound || urlError ? (
            <div className="w-full h-full flex items-center justify-center bg-gray-900 rounded-lg">
              <div className="text-center p-6 text-gray-300">
                <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-amber-500" />
                <p className="font-medium mb-1">
                  {urlError ? "Video URL is invalid" : "This lesson could not be loaded"}
                </p>
                <p className="text-sm text-gray-400">Please contact support to fix this video.</p>
              </div>
            </div>
          ) : (
            <>
              <iframe
                key={`watch-${recordingId}`}
                ref={iframeRef}
                className="w-full h-full"
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                title={title}
                frameBorder="0"
              />
              <VideoWatermark />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Watch;
