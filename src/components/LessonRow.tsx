import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Play, CheckCircle } from "lucide-react";

interface LessonRowProps {
  lesson: {
    id: string;
    title: string;
    duration: string;
    completed: boolean;
    assignmentTitle: string;
    assignmentSubmitted: boolean;
    recording_url?: string;
  };
  moduleId: string | number;
  onWatchNow: (moduleId: number, lessonId: number) => void;
  onAssignmentClick: (lessonTitle: string, assignmentTitle: string, assignmentSubmitted: boolean) => void;
}

export const LessonRow = React.memo(({ 
  lesson, 
  moduleId, 
  onWatchNow, 
  onAssignmentClick 
}: LessonRowProps) => {
  const navigate = useNavigate();
  
  const handleWatchClick = () => {
    if (lesson.recording_url) {
      navigate(`/video-player?url=${encodeURIComponent(lesson.recording_url)}&title=${encodeURIComponent(lesson.title)}&id=${lesson.id}`);
    }
  };

  return (
    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center space-x-4 flex-1">
        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
          lesson.completed ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
        }`}>
          {lesson.completed ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-foreground truncate">
            {lesson.title}
          </h4>
          <p className="text-xs text-muted-foreground">
            {lesson.duration}
          </p>
        </div>
      </div>
      
      <div className="flex items-center space-x-3">
        {lesson.assignmentTitle !== 'No Assignment' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/assignments')}
            className={`${
              lesson.assignmentSubmitted ? 'bg-green-50 text-green-700 border-green-200' : ''
            }`}
          >
            {lesson.assignmentSubmitted ? 'View Submission' : 'Submit Assignment'}
          </Button>
        )}
        
        <Button
          variant="default"
          size="sm"
          onClick={handleWatchClick}
          disabled={!lesson.recording_url}
        >
          {lesson.completed ? 'Watch Again' : 'Watch Now'}
        </Button>
      </div>
    </div>
  );
});

LessonRow.displayName = "LessonRow";