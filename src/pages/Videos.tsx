import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { AssignmentSubmissionDialog } from "@/components/AssignmentSubmissionDialog";
import { ModuleCard } from "@/components/ModuleCard";
import { useVideosData } from "@/hooks/useVideosData";
import { Play } from "lucide-react";

interface VideosProps {
  user?: any;
}

const Videos = ({ user }: VideosProps = {}) => {
  const navigate = useNavigate();
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<{
    title: string;
    lessonTitle: string;
    submitted: boolean;
  } | null>(null);
  const [expandedModules, setExpandedModules] = useState<{ [key: string | number]: boolean }>({});
  
  const { modules, loading } = useVideosData(user);

  // Initialize first module as expanded
  React.useEffect(() => {
    if (modules.length > 0 && Object.keys(expandedModules).length === 0) {
      setExpandedModules({ [modules[0].id]: true });
    }
  }, [modules, expandedModules]);


  const handleWatchNow = useCallback((moduleId: number, lessonId: number) => {
    navigate(`/videos/${moduleId}/${lessonId}`);
  }, [navigate]);

  const handleAssignmentClick = useCallback((lessonTitle: string, assignmentTitle: string, assignmentSubmitted: boolean) => {
    setSelectedAssignment({
      title: assignmentTitle,
      lessonTitle: lessonTitle,
      submitted: assignmentSubmitted
    });
    setAssignmentDialogOpen(true);
  }, []);

  const toggleModule = useCallback((moduleId: string | number) => {
    setExpandedModules(prev => ({
      ...prev,
      [moduleId]: !prev[moduleId]
    }));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Available Lessons</h1>
        <p className="text-muted-foreground">
          Watch lessons and complete assignments to track your progress
        </p>
      </div>

      {modules.length === 0 ? (
        <Card className="shadow-lg">
          <CardContent className="p-8 text-center">
            <div className="text-gray-500">
              <Play className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No Video Lessons Available</h3>
              <p>Check back later for new lessons or contact your instructor.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {modules.map((module, index) => (
            <ModuleCard
              key={module.id}
              module={module}
              index={index}
              isExpanded={expandedModules[module.id]}
              onToggle={toggleModule}
              onWatchNow={handleWatchNow}
              onAssignmentClick={handleAssignmentClick}
            />
          ))}
        </div>
      )}

      {selectedAssignment && (
        <AssignmentSubmissionDialog
          open={assignmentDialogOpen}
          onOpenChange={setAssignmentDialogOpen}
          assignmentTitle={selectedAssignment.title}
          lessonTitle={selectedAssignment.lessonTitle}
          isSubmitted={selectedAssignment.submitted}
        />
      )}
    </div>
  );
};

export default Videos;
