
import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AssignmentSubmissionDialog } from "@/components/AssignmentSubmissionDialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  const [expandedModules, setExpandedModules] = useState<{ [key: number]: boolean }>({});
  const [modules, setModules] = useState<any[]>([]);
  const [recordings, setRecordings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchModulesAndRecordings();
  }, []);

  const fetchModulesAndRecordings = async () => {
    console.log('fetchModulesAndRecordings called');
    try {

      // Fetch modules
      const { data: modulesData, error: modulesError } = await supabase
        .from('modules')
        .select('*')
        .order('order');

      console.log('Modules data:', modulesData);
      if (modulesError) {
        console.error('Modules error:', modulesError);
        throw modulesError;
      }

      // Fetch recordings with assignment info
      const { data: recordingsData, error: recordingsError } = await supabase
        .from('available_lessons')
        .select('*')
        .order('sequence_order');

      console.log('Recordings data:', recordingsData);

      // Fetch assignments separately
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('assignment')
        .select('*');

      console.log('Assignments data:', assignmentsData);
      if (recordingsError) {
        console.error('Recordings error:', recordingsError);
        throw recordingsError;
      }
      if (assignmentsError) {
        console.error('Assignments error:', assignmentsError);
        throw assignmentsError;
      }

      // Fetch user's assignment submissions (if user is logged in)
      let submissions = [];
      if (user?.id) {
        const { data: submissionsData, error: submissionsError } = await supabase
          .from('assignment_submissions')
          .select('*')
          .eq('user_id', user.id);
        
        console.log('Submissions data:', submissionsData);
        if (submissionsError) {
          console.error('Submissions error:', submissionsError);
          throw submissionsError;
        }
        submissions = submissionsData || [];
      }

      // Process data to determine locked/unlocked status
      console.log('Processing modules...');
      const processedModules = modulesData?.map(module => {
        console.log('Processing module:', module.title, 'ID:', module.id);
        const moduleRecordings = recordingsData?.filter(r => r.module === module.id) || [];
        console.log('Module recordings for', module.title, ':', moduleRecordings.length, 'recordings');
        
        const lessons = moduleRecordings.map(recording => {
          // Find associated assignment based on sequence_order matching
          const associatedAssignment = assignmentsData?.find(a => a.sequence_order === recording.sequence_order);
          console.log('Recording:', recording.recording_title, 'Sequence:', recording.sequence_order, 'Found assignment:', associatedAssignment?.assignment_title);
          
          // Check if user has submitted assignment for this recording
          const submission = submissions?.find(s => s.assignment_id === associatedAssignment?.assignment_id);
          
          return {
            id: recording.id,
            title: recording.recording_title || 'Untitled Recording',
            duration: recording.duration_min ? `${recording.duration_min} min` : 'N/A',
            completed: submission?.status === 'accepted',
            locked: false,
            assignmentTitle: associatedAssignment?.assignment_title || 'No Assignment',
            assignmentSubmitted: !!submission,
            recording_url: recording.recording_url
          };
        });

        console.log('Processed lessons for', module.title, ':', lessons.length, 'lessons');
        return {
          id: module.id,
          title: module.title,
          totalLessons: lessons.length,
          completedLessons: lessons.filter(l => l.completed).length,
          lessons
        };
      }) || [];

      // Filter out modules with no lessons to keep the interface clean
      const modulesWithLessons = processedModules.filter(module => module.lessons.length > 0);
      console.log('Modules with lessons:', modulesWithLessons.length);

      // Only create default module if NO modules exist at all
      if (modulesWithLessons.length === 0 && recordingsData?.length > 0) {
        console.log('No modules with lessons found, creating default module for', recordingsData.length, 'recordings');
        const defaultModule = {
          id: 'default',
          title: 'Uncategorized Recordings',
          totalLessons: recordingsData.length,
          completedLessons: 0,
          lessons: recordingsData.map(recording => {
            const associatedAssignment = assignmentsData?.find(a => a.sequence_order === recording.sequence_order);
            const submission = submissions?.find(s => s.assignment_id === associatedAssignment?.assignment_id);
            
            return {
              id: recording.id,
              title: recording.recording_title || 'Untitled Recording',
              duration: recording.duration_min ? `${recording.duration_min} min` : 'N/A',
              completed: submission?.status === 'accepted',
              locked: false,
              assignmentTitle: associatedAssignment?.assignment_title || 'No Assignment',
              assignmentSubmitted: !!submission,
              recording_url: recording.recording_url
            };
          })
        };
        modulesWithLessons.push(defaultModule);
        console.log('Created default module:', defaultModule);
      }

      console.log('Final processed modules:', modulesWithLessons);

      setModules(modulesWithLessons);
      setRecordings(recordingsData || []);
      
      // Start with the first module expanded to show recordings
      if (modulesWithLessons.length > 0) {
        setExpandedModules({ [modulesWithLessons[0].id]: true });
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
          {modules.map((module) => (
            <div key={module.id} className="bg-white rounded-lg shadow-sm border border-border">
              <Collapsible
                open={expandedModules[module.id]}
                onOpenChange={(open) => setExpandedModules(prev => ({ ...prev, [module.id]: open }))}
              >
                <CollapsibleTrigger className="w-full p-6 flex items-center justify-between hover:bg-muted/50 transition-colors">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center justify-center w-10 h-10 bg-primary/10 text-primary rounded-lg">
                      <Play className="h-5 w-5" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-lg font-semibold text-foreground">
                        {module.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {module.completedLessons}/{module.totalLessons} completed • {module.lessons.reduce((acc, lesson) => acc + (parseInt(lesson.duration) || 0), 0)} min
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="text-sm font-medium text-foreground">
                        {module.totalLessons} assignments
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {module.totalLessons > 0 ? 'Track progress' : 'No assignments'}
                      </div>
                    </div>
                    <ChevronDown 
                      className={`h-5 w-5 text-muted-foreground transition-transform ${
                        expandedModules[module.id] ? 'rotate-180' : ''
                      }`} 
                    />
                  </div>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <div className="border-t border-border">
                    <div className="p-6 space-y-4">
                      {module.lessons.map((lesson) => (
                        <div key={lesson.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
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
                                onClick={() => handleAssignmentClick(lesson.title, lesson.assignmentTitle, lesson.assignmentSubmitted)}
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
                              onClick={() => {
                                if (lesson.recording_url) {
                                  navigate(`/video-player?url=${encodeURIComponent(lesson.recording_url)}&title=${encodeURIComponent(lesson.title)}&id=${lesson.id}`);
                                }
                              }}
                              disabled={!lesson.recording_url}
                            >
                              {lesson.completed ? 'Watch Again' : 'Watch Now'}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
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
