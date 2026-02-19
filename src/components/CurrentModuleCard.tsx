import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";
import { Lock, CheckCircle, Play } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useVideosData } from "@/hooks/useVideosData";
interface CurrentModuleCardProps {
  currentVideoId?: string | null;
}
const CurrentModuleCard: React.FC<CurrentModuleCardProps> = ({
  currentVideoId
}) => {
  const {
    user
  } = useAuth();
  const navigate = useNavigate();
  const {
    modules,
    loading
  } = useVideosData(user || undefined);
  const currentModule = React.useMemo(() => {
    if (!modules || modules.length === 0) return undefined as any;
    if (currentVideoId) {
      const byLesson = modules.find((m: any) => m.lessons?.some((l: any) => String(l.id) === String(currentVideoId)));
      if (byLesson) return byLesson;
    }
    return modules[0];
  }, [modules, currentVideoId]);
  if (loading || !currentModule) return null;
  const lessons: any[] = Array.isArray(currentModule.lessons) ? currentModule.lessons : [];
  const watchedCount = lessons.filter((l: any) => l?.watched || l?.completed).length;
  const total = lessons.length || 1;
  const progress = Math.round(watchedCount / total * 100);
  const handleLessonClick = (lesson: any) => {
    if (lesson?.locked) return;
    navigate(`/video-player?id=${lesson.id}&title=${encodeURIComponent(lesson.title || '')}`);
  };
  return <Card key={currentModule.id}>
      <CardHeader className="bg-white">
        <CardTitle className="text-lg">{currentModule.title || "Current Module"}</CardTitle>
        <Progress value={progress} className="h-2" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {lessons.map((lesson: any) => {
          const isCurrent = currentVideoId && String(lesson.id) === String(currentVideoId);
          const isWatched = !!(lesson?.watched || lesson?.completed);
          const rowClass = lesson?.locked ? "opacity-50 cursor-not-allowed" : isCurrent ? "bg-blue-50 border border-blue-200" : "hover:bg-gray-50";
          return <div key={lesson.id} className={`flex items-center space-x-3 p-2 rounded-lg cursor-pointer transition-colors ${rowClass}`} onClick={() => handleLessonClick(lesson)}>
                <div className="flex-shrink-0">
                  {lesson?.locked ? <Lock className="w-4 h-4 text-gray-400" /> : isCurrent ? <Play className="w-4 h-4 text-blue-600" /> : isWatched ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Play className="w-4 h-4 text-blue-600" />}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{lesson.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {lesson?.duration || (lesson?.duration_min ? `${lesson.duration_min} min` : "")}
                  </p>
                </div>
              </div>;
        })}
        </div>
      </CardContent>
    </Card>;
};
export default CurrentModuleCard;