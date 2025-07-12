
import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AssignmentSubmissionDialog } from "@/components/AssignmentSubmissionDialog";
import { supabase } from "@/integrations/supabase/client";
import { 
  Play, 
  CheckCircle, 
  Clock, 
  Lock,
  FileText,
  ChevronDown,
  ChevronRight
} from "lucide-react";

// Memoized lesson component for better performance
const LessonRow = React.memo(({ 
  lesson, 
  moduleId, 
  onWatchNow, 
  onAssignmentClick 
}: {
  lesson: any;
  moduleId: number;
  onWatchNow: (moduleId: number, lessonId: number) => void;
  onAssignmentClick: (lessonTitle: string, assignmentTitle: string, assignmentSubmitted: boolean) => void;
}) => (
  <tr 
    className={`border-b hover:bg-muted/20 transition-colors ${
      lesson.locked ? "opacity-50" : ""
    }`}
  >
    <td className="p-4 pl-8">
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">
          {lesson.locked ? (
            <Lock className="w-4 h-4 text-muted-foreground" />
          ) : lesson.completed ? (
            <CheckCircle className="w-4 h-4 text-green-600" />
          ) : (
            <Play className="w-4 h-4 text-blue-600" />
          )}
        </div>
        <span className={lesson.locked ? "text-muted-foreground" : ""}>
          {lesson.title}
        </span>
      </div>
    </td>
    <td className="p-4">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm">{lesson.duration}</span>
      </div>
    </td>
    <td className="p-4">
      <Button
        variant="ghost"
        size="sm"
        className={`flex items-center gap-2 transition-colors ${
          lesson.assignmentSubmitted 
            ? "text-green-600 hover:text-green-700" 
            : "text-blue-600 hover:text-blue-700"
        }`}
        onClick={() => !lesson.locked && onAssignmentClick(lesson.title, lesson.assignmentTitle, lesson.assignmentSubmitted)}
        disabled={lesson.locked}
      >
        <FileText className="w-4 h-4" />
        <span className="text-sm">
          {lesson.assignmentSubmitted ? "✓ " : ""}{lesson.assignmentTitle}
        </span>
      </Button>
    </td>
    <td className="p-4">
      <Button
        size="sm"
        onClick={() => !lesson.locked && onWatchNow(moduleId, lesson.id)}
        disabled={lesson.locked}
        className="text-blue-600 hover:text-blue-700 transition-colors"
        variant="ghost"
      >
        Watch Now
      </Button>
    </td>
  </tr>
));

LessonRow.displayName = "LessonRow";

const Videos = () => {
  const navigate = useNavigate();
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<{
    title: string;
    lessonTitle: string;
    submitted: boolean;
  } | null>(null);
  const [expandedModules, setExpandedModules] = useState<{ [key: number]: boolean }>({});
  const [modules, setModules] = useState<any[]>([]);
  const [recordings, setRecordings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchModulesAndRecordings();
  }, []);

  const fetchModulesAndRecordings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch modules
      const { data: modulesData, error: modulesError } = await supabase
        .from('modules')
        .select('*')
        .order('order');

      if (modulesError) throw modulesError;

      // Fetch recordings with assignment info
      const { data: recordingsData, error: recordingsError } = await supabase
        .from('session_recordings')
        .select('*')
        .order('sequence_order');

      // Fetch assignments separately
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('assignment')
        .select('*');

      if (recordingsError) throw recordingsError;
      if (assignmentsError) throw assignmentsError;

      // Fetch user's assignment submissions
      const { data: submissions, error: submissionsError } = await supabase
        .from('assignment_submissions')
        .select('*')
        .eq('user_id', user.id);

      if (submissionsError) throw submissionsError;

      // Fetch manual unlocks
      const { data: unlocks, error: unlocksError } = await supabase
        .from('user_unlocks')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_unlocked', true);

      if (unlocksError) throw unlocksError;

      // Process data to determine locked/unlocked status
      const processedModules = modulesData?.map(module => {
        const moduleRecordings = recordingsData?.filter(r => r.module === module.id) || [];
        
        const lessons = moduleRecordings.map(recording => {
          // Find associated assignment
          const associatedAssignment = assignmentsData?.find(a => a.assignment_id === recording.assignment_id);
          
          // Check if recording is manually unlocked
          const manualUnlock = unlocks?.find(u => u.recording_id === recording.id);
          if (manualUnlock?.is_unlocked) {
            return {
              id: recording.id,
              title: recording.recording_title || 'Untitled Recording',
              duration: recording.duration_min ? `${recording.duration_min} min` : 'N/A',
              completed: false,
              locked: false,
              assignmentTitle: associatedAssignment?.assignment_title || 'No Assignment',
              assignmentSubmitted: false,
              recording_url: recording.recording_url
            };
          }

          // Check assignment unlock logic
          if (recording.assignment_id) {
            const submission = submissions?.find(s => s.assignment_id === recording.assignment_id);
            const isLocked = !submission || submission.status !== 'accepted';
            
            return {
              id: recording.id,
              title: recording.recording_title || 'Untitled Recording',
              duration: recording.duration_min ? `${recording.duration_min} min` : 'N/A',
              completed: submission?.status === 'accepted',
              locked: isLocked,
              assignmentTitle: associatedAssignment?.assignment_title || 'No Assignment',
              assignmentSubmitted: !!submission,
              recording_url: recording.recording_url
            };
          }

          // No assignment required - unlocked
          return {
            id: recording.id,
            title: recording.recording_title || 'Untitled Recording',
            duration: recording.duration_min ? `${recording.duration_min} min` : 'N/A',
            completed: false,
            locked: false,
            assignmentTitle: 'No Assignment Required',
            assignmentSubmitted: false,
            recording_url: recording.recording_url
          };
        });

        return {
          id: module.id,
          title: module.title,
          totalLessons: lessons.length,
          completedLessons: lessons.filter(l => l.completed).length,
          lessons
        };
      }) || [];

      setModules(processedModules);
      setRecordings(recordingsData || []);
      
      // Auto-expand first module
      if (processedModules.length > 0) {
        setExpandedModules({ [processedModules[0].id]: true });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };


  // Memoized callbacks to prevent unnecessary re-renders
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

  const toggleModule = useCallback((moduleId: number) => {
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

      <Card className="shadow-lg">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-muted/20">
                <tr>
                  <th className="text-left p-4 font-medium">Lesson</th>
                  <th className="text-left p-4 font-medium">Duration</th>
                  <th className="text-left p-4 font-medium">Assignment</th>
                  <th className="text-left p-4 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {modules.map((module) => (
                  <React.Fragment key={`module-${module.id}`}>
                    {/* Module Header */}
                    <tr 
                      className="border-b bg-blue-50/50 cursor-pointer hover:bg-blue-50 transition-colors"
                      onClick={() => toggleModule(module.id)}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {expandedModules[module.id] ? (
                            <ChevronDown className="w-4 h-4 transition-transform" />
                          ) : (
                            <ChevronRight className="w-4 h-4 transition-transform" />
                          )}
                          <span className="font-semibold">{module.title}</span>
                          <Badge variant="outline" className="ml-2">
                            {module.completedLessons}/{module.totalLessons} completed
                          </Badge>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted-foreground">Module</span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted-foreground">
                          {module.totalLessons} assignments
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted-foreground">-</span>
                      </td>
                    </tr>

                    {/* Module Lessons */}
                    {expandedModules[module.id] && module.lessons.map((lesson) => (
                      <LessonRow
                        key={`lesson-${lesson.id}`}
                        lesson={lesson}
                        moduleId={module.id}
                        onWatchNow={handleWatchNow}
                        onAssignmentClick={handleAssignmentClick}
                      />
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

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
