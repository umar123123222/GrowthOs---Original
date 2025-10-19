import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, Loader2 } from 'lucide-react';

interface OnboardingVideoModalProps {
  videoUrl: string;
  userId: string;
  onComplete: () => void;
}

export const OnboardingVideoModal: React.FC<OnboardingVideoModalProps> = ({
  videoUrl,
  userId,
  onComplete
}) => {
  const [videoCompleted, setVideoCompleted] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { toast } = useToast();

  const videoType = getVideoType(videoUrl);

  function getVideoType(url: string): 'youtube' | 'vimeo' | 'direct' {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return 'youtube';
    }
    if (url.includes('vimeo.com')) {
      return 'vimeo';
    }
    return 'direct';
  }

  function getYouTubeEmbedUrl(url: string): string {
    const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)?.[1];
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&enablejsapi=1`;
  }

  function getVimeoEmbedUrl(url: string): string {
    const videoId = url.match(/vimeo\.com\/(\d+)/)?.[1];
    return `https://player.vimeo.com/video/${videoId}?autoplay=1&title=0&byline=0&portrait=0`;
  }

  useEffect(() => {
    if (videoType === 'youtube') {
      // YouTube iframe API
      const handleMessage = (event: MessageEvent) => {
        if (event.origin === 'https://www.youtube.com') {
          try {
            const data = JSON.parse(event.data);
            if (data.event === 'onStateChange' && data.info === 0) {
              // Video ended (state 0)
              setVideoCompleted(true);
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      };

      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    } else if (videoType === 'vimeo') {
      // Vimeo player API
      const handleMessage = (event: MessageEvent) => {
        if (event.origin === 'https://player.vimeo.com') {
          try {
            const data = JSON.parse(event.data);
            if (data.event === 'ended') {
              setVideoCompleted(true);
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      };

      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }
  }, [videoType]);

  const handleVideoEnd = () => {
    setVideoCompleted(true);
  };

  const handleContinue = async () => {
    setIsUpdating(true);

    try {
      const { error } = await supabase
        .from('students')
        .update({ onboarding_video_watched: true })
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "Welcome!",
        description: "You can now access your dashboard.",
      });

      onComplete();
    } catch (error) {
      console.error('Error updating video watch status:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update your progress. Please try again.",
      });
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={true} modal>
      <DialogContent 
        className="max-w-4xl p-0 gap-0 [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div className="space-y-4 p-6">
          <div>
            <h2 className="text-2xl font-semibold mb-2">Welcome! Watch this video to get started</h2>
            <p className="text-sm text-muted-foreground">
              Please watch the complete video before continuing to your dashboard
            </p>
          </div>

          <div className="aspect-video bg-black rounded-lg overflow-hidden">
            {videoType === 'youtube' && (
              <iframe
                ref={iframeRef}
                src={getYouTubeEmbedUrl(videoUrl)}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )}

            {videoType === 'vimeo' && (
              <iframe
                ref={iframeRef}
                src={getVimeoEmbedUrl(videoUrl)}
                className="w-full h-full"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
              />
            )}

            {videoType === 'direct' && (
              <video
                ref={videoRef}
                src={videoUrl}
                className="w-full h-full"
                controls
                autoPlay
                muted={false}
                playsInline
                onEnded={handleVideoEnd}
                onError={(e) => {
                  console.error('Video error:', e);
                  toast({
                    variant: "destructive",
                    title: "Video Error",
                    description: "Unable to load the video. Please contact support.",
                  });
                }}
                onLoadStart={() => console.log('Video loading started')}
                onCanPlay={() => console.log('Video can play')}
              >
                Your browser does not support the video tag.
              </video>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2 text-sm">
              {videoCompleted ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-green-600 font-medium">Video completed!</span>
                </>
              ) : (
                <span className="text-muted-foreground">Please watch the entire video</span>
              )}
            </div>

            <Button
              onClick={handleContinue}
              disabled={!videoCompleted || isUpdating}
              size="lg"
            >
              {isUpdating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Please wait...
                </>
              ) : (
                'Continue to Dashboard'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
