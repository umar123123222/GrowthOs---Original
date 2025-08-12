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
  interface Attachment { id: string; file_name: string; file_url: string; uploaded_at: string; }
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
        const { data, error } = await supabase
          .from('recording_attachments' as any)
          .select('id, file_name, file_url, uploaded_at')
          .eq('recording_id', currentVideo.id)
          .order('uploaded_at', { ascending: false }) as any;
        if (!error) setAttachments((data as Attachment[]) || []);
      } catch (e) {
        logger.error('Failed to load attachments', e);
      }
    };
    loadAttachments();
  }, [currentVideo?.id]);
  const modules = [{
    id: 1,
    title: "Introduction to E-commerce",
    progress: 66,
    lessons: [{
      id: 1,
      title: "Welcome to the Course",
      duration: "5:30",
      completed: true,
      locked: false
    }, {
      id: 2,
      title: "E-commerce Fundamentals",
      duration: "12:45",
      completed: true,
      locked: false
    }, {
      id: 3,
      title: "Market Research Basics",
      duration: "18:20",
      completed: false,
      locked: false
    }]
  }, {
    id: 2,
    title: "Product Research & Selection",
    progress: 0,
    lessons: [{
      id: 4,
      title: "Finding Winning Products",
      duration: "22:15",
      completed: false,
      locked: false
    }, {
      id: 5,
      title: "Competitor Analysis",
      duration: "16:30",
      completed: false,
      locked: false
    }, {
      id: 6,
      title: "Trend Identification",
      duration: "14:45",
      completed: false,
      locked: true
    }]
  }];
  const handleChecklistToggle = (index: number) => {
    setCheckedItems(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };
  const handleVideoSelect = (moduleId: number, lessonId: number) => {
    navigate(`/videos/${moduleId}/${lessonId}`);
  };
  const checkVideoCompletion = async () => {
    if (!user?.id || !currentVideo?.id) return;
    try {
      // Check if recording has been watched and no rating exists yet
      const watchedResult = await safeMaybeSingle(supabase.from('recording_views').select('watched').eq('user_id', user.id).eq('recording_id', currentVideo.id).eq('watched', true).maybeSingle() as any, `check if recording ${currentVideo.id} was watched by user ${user.id}`);
      const ratingResult = await safeMaybeSingle(supabase.from('recording_ratings' as any).select('id').eq('user_id', user.id).eq('recording_id', currentVideo.id).maybeSingle() as any, `check if recording ${currentVideo.id} was rated by user ${user.id}`);
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
  return <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Video Player Section */}
      <div className="lg:col-span-3 space-y-6">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="outline" size="sm" onClick={() => navigate('/videos')} className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Videos
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="aspect-video bg-gray-900 rounded-t-lg">
              {currentVideo && <iframe src={currentVideo.videoUrl} className="w-full h-full rounded-t-lg" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title={currentVideo.title} />}
            </div>
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-2">{currentVideo?.title}</h2>
              <p className="text-muted-foreground mb-4">{currentVideo?.description}</p>

              {attachments.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold mb-2">Attachments</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {attachments.map((att) => (
                      <li key={att.id}>
                        <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                          {att.file_name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {attachmentLinks.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold mb-2">Links mentioned</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {attachmentLinks.map((link, idx) => (
                      <li key={idx}>
                        <a href={link} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                          {link}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3 flex-wrap">
                  {currentVideo?.id && (
                    <Badge variant="secondary">{currentVideo.id}</Badge>
                  )}
                  <Badge variant="outline">{currentVideo?.duration} duration</Badge>
                </div>
                <Button size="sm" onClick={handleMarkComplete} disabled={videoWatched}>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {videoWatched ? 'Completed' : 'Mark Complete'}
                </Button>
              </div>

              {/* Action Checklist */}
              <Card>
                <CardHeader>
                  <CardTitle>Checklist</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {currentVideo?.checklist?.map((item, index) => <div key={index} className="flex items-center space-x-3">
                        <input type="checkbox" className="rounded" checked={checkedItems[index] || false} onChange={() => handleChecklistToggle(index)} />
                        <span className={checkedItems[index] ? "line-through text-muted-foreground" : ""}>
                          {item}
                        </span>
                      </div>)}
                  </div>
                </CardContent>
              </Card>

              {/* Lecture Rating - Shows after video is marked complete */}
              {showRating && currentVideo && <LectureRating recordingId={currentVideo.id} lessonTitle={currentVideo.title} />}
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

        {/* Module Progress */}
        {modules.map(module => <Card key={module.id}>
            <CardHeader>
              <CardTitle className="text-lg">{module.title}</CardTitle>
              <Progress value={module.progress} className="h-2" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {module.lessons.map(lesson => <div key={lesson.id} className={`flex items-center space-x-3 p-2 rounded-lg cursor-pointer transition-colors ${lesson.locked ? "opacity-50 cursor-not-allowed" : lesson.id.toString() === lessonId ? "bg-blue-50 border border-blue-200" : "hover:bg-gray-50"}`} onClick={() => !lesson.locked && handleVideoSelect(module.id, lesson.id)}>
                    <div className="flex-shrink-0">
                      {lesson.locked ? <Lock className="w-4 h-4 text-gray-400" /> : lesson.completed ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Play className="w-4 h-4 text-blue-600" />}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{lesson.title}</p>
                      <p className="text-xs text-muted-foreground">{lesson.duration}</p>
                    </div>
                  </div>)}
              </div>
            </CardContent>
          </Card>)}
      </div>

      {showShoaibGPT && <ShoaibGPT onClose={() => setShowShoaibGPT(false)} />}
    </div>;
};
export default VideoPlayer;