import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, ArrowLeft, Play, Lock, MessageCircle } from "lucide-react";
import ShoaibGPT from "@/components/ShoaibGPT";
import { LectureRating } from "@/components/LectureRating";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { safeMaybeSingle } from '@/lib/database-safety';
import { logger } from '@/lib/logger';
import CurrentModuleCard from "@/components/CurrentModuleCard";
const VideoPlayer = () => {
  const {
    moduleId,
    lessonId
  } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const {
    user
  } = useAuth();
  const [showShoaibGPT, setShowShoaibGPT] = useState(false);
  const [checkedItems, setCheckedItems] = useState<{
    [key: number]: boolean;
  }>({});
  const [currentVideo, setCurrentVideo] = useState<any>(null);
  const [showRating, setShowRating] = useState(false);
  const [videoWatched, setVideoWatched] = useState(false);
  interface Attachment {
    id: string;
    file_name: string;
    file_url: string;
    uploaded_at: string;
  }
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  // Helper to extract URLs from description for attachments (simple auto-link)
  const extractLinks = (text: string): string[] => {
    const urlRegex = /(https?:\/\/[^\s)]+|www\.[^\s)]+)/g;
    return text ? (text.match(urlRegex) || []).map(u => u.startsWith('http') ? u : `http://${u}`) : [];
  };
  const attachmentLinks = currentVideo?.description ? extractLinks(currentVideo.description) : [];

  // Initialize video data from URL params or by ID
  useEffect(() => {
    const videoUrl = searchParams.get('url');
    const videoTitle = searchParams.get('title');
    const videoId = searchParams.get('id');
    const setFromParams = () => {
      if (videoUrl && videoTitle) {
        setCurrentVideo({
          id: videoId,
          title: decodeURIComponent(videoTitle),
          description: "Watch this lesson to continue your learning journey.",
          videoUrl: decodeURIComponent(videoUrl),
          duration: "N/A",
          module: "Current Module",
          checklist: ["Watch the complete video", "Take notes on key concepts", "Complete any related assignments", "Mark lesson as complete"]
        });
        return true;
      }
      return false;
    };
    const loadById = async (id: string) => {
      try {
        const {
          data,
          error
        } = await supabase.from('available_lessons').select('id, recording_title, recording_url, duration_min, module, notes').eq('id', id).maybeSingle();
        if (error) throw error;
        if (data) {
          setCurrentVideo({
            id: data.id,
            title: data.recording_title || 'Lesson',
            description: data.notes || 'Watch this lesson to continue your learning journey.',
            videoUrl: data.recording_url || '',
            duration: data.duration_min ? `${data.duration_min} min` : 'N/A',
            module: data.module || 'Module',
            checklist: ['Watch the complete video', 'Take notes on key concepts', 'Complete any related assignments', 'Mark lesson as complete']
          });
          return;
        }
      } catch (e) {
        logger.error('VideoPlayer: failed to load by id', e);
      }
      // Fallback mock if not found
      setCurrentVideo({
        id: lessonId,
        title: 'Market Research Basics',
        description: 'Learn how to conduct effective market research to identify profitable niches and understand your target audience.',
        videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        duration: '18:20',
        module: 'Introduction to E-commerce',
        checklist: ['Identify your target market', 'Analyze market size and potential', 'Study competitor pricing strategies', 'Research customer pain points', 'Create buyer personas']
      });
    };

    // Prefer explicit params
    if (!setFromParams()) {
      if (videoId) {
        loadById(videoId);
      } else {
        // Legacy route fallback
        setCurrentVideo({
          id: lessonId,
          title: 'Market Research Basics',
          description: 'Learn how to conduct effective market research to identify profitable niches and understand your target audience.',
          videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
          duration: '18:20',
          module: 'Introduction to E-commerce',
          checklist: ['Identify your target market', 'Analyze market size and potential', 'Study competitor pricing strategies', 'Research customer pain points', 'Create buyer personas']
        });
      }
    }
  }, [searchParams, lessonId]);

  // Load attachments for current video
  useEffect(() => {
    const loadAttachments = async () => {
      if (!currentVideo?.id) return;
      try {
        const {
          data,
          error
        } = (await supabase.from('recording_attachments' as any).select('id, file_name, file_url, uploaded_at').eq('recording_id', currentVideo.id).order('uploaded_at', {
          ascending: false
        })) as any;
        if (!error) setAttachments(data as Attachment[] || []);
      } catch (e) {
        logger.error('Failed to load attachments', e);
      }
    };
    loadAttachments();
  }, [currentVideo?.id]);
  // modules list moved to CurrentModuleCard via useVideosData

  const handleChecklistToggle = (index: number) => {
    setCheckedItems(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };
  // Video selection handled by CurrentModuleCard

  const checkVideoCompletion = async () => {
    if (!user?.id || !currentVideo?.id) return;
    try {
      // Check if recording has been watched and no rating exists yet
      const watchedResult = await safeMaybeSingle(supabase.from('recording_views').select('watched').eq('user_id', user.id).eq('recording_id', currentVideo.id).eq('watched', true).maybeSingle() as any, `check if recording ${currentVideo.id} was watched by user ${user.id}`);
      const ratingResult = await safeMaybeSingle(supabase.from('recording_ratings' as any).select('id').eq('student_id', user.id).eq('recording_id', currentVideo.id).maybeSingle() as any, `check if recording ${currentVideo.id} was rated by user ${user.id}`);
      if (watchedResult.data && !ratingResult.data) {
        setShowRating(true);
      }
    } catch (error) {
      logger.error('Error checking video completion:', error);
    }
  };
  const handleMarkComplete = async () => {
    if (!user?.id || !currentVideo?.id) return;
    try {
      // Mark recording as watched
      await supabase.from('recording_views').upsert({
        user_id: user.id,
        recording_id: currentVideo.id,
        watched: true,
        watched_at: new Date().toISOString()
      });
      setVideoWatched(true);

      // Check if should show rating
      setTimeout(() => {
        checkVideoCompletion();
      }, 1000);
    } catch (error) {
      console.error('Error marking video complete:', error);
    }
  };
  return <div>
      <div className="flex items-center gap-3 mb-4">
        <Button variant="outline" size="sm" onClick={() => navigate('/videos')} className="flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Videos
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Video Player Section */}
        <div className="lg:col-span-3 space-y-6">
          <Card>
            <CardContent className="p-0">
              <div className="aspect-video bg-gray-900 rounded-t-lg">
                {currentVideo && <iframe src={currentVideo.videoUrl} className="w-full h-full rounded-t-lg" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title={currentVideo.title} />}
              </div>
              <div className="p-6">
                <h2 className="text-2xl font-bold mb-2">{currentVideo?.title}</h2>
                <h3 className="font-semibold mb-2 text-base">Description</h3>
                <p className="mb-4 text-black text-left text-sm">{currentVideo?.description}</p>

                {attachments.length > 0 && <div className="mb-4">
                    <h3 className="font-semibold mb-2 text-base">Attachments</h3>
                    <ul className="list-disc list-inside space-y-1">
                      {attachments.map(att => <li key={att.id}>
                          <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                            {att.file_name}
                          </a>
                        </li>)}
                    </ul>
                  </div>}
                
                {attachmentLinks.length > 0 && <div className="mb-4">
                    <h3 className="text-sm font-semibold mb-2">Links mentioned</h3>
                    <ul className="list-disc list-inside space-y-1">
                      {attachmentLinks.map((link, idx) => <li key={idx}>
                          <a href={link} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                            {link}
                          </a>
                        </li>)}
                    </ul>
                  </div>}
                

                {/* Lecture Rating - Shows after video is marked complete */}
                {showRating && currentVideo && <LectureRating recordingId={currentVideo.id} lessonTitle={currentVideo.title} />}

                <div className="mt-8 flex justify-center">
                  <Button size="sm" onClick={handleMarkComplete} disabled={videoWatched}>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {videoWatched ? 'Completed' : 'Mark Complete'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* ShoaibGPT Assistant */}
          <Card className="bg-gradient-to-r from-blue-50 to-green-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-green-600 rounded-full mr-2 flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-white" />
                </div>
                ShoaibGPT
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                I'm here to help! Ask me anything about this video or your learning journey.
              </p>
              <Button size="sm" className="w-full" onClick={() => setShowShoaibGPT(true)}>
                Ask ShoaibGPT
              </Button>
            </CardContent>
          </Card>

          {/* Module Progress - current module only */}
          <CurrentModuleCard currentVideoId={currentVideo?.id} />

        </div>
      </div>

      {showShoaibGPT && <ShoaibGPT onClose={() => setShowShoaibGPT(false)} />}
    </div>;
  };
export default VideoPlayer;