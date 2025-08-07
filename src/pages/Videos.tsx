import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StudentSubmissionDialog } from "@/components/assignments/StudentSubmissionDialog";
import { useModulesWithRecordings } from "@/hooks/useModulesWithRecordings";
import { useAuth } from "@/hooks/useAuth";
import { useProgressTracker } from "@/hooks/useProgressTracker";
import { RoleGuard } from "@/components/RoleGuard";
import { InactiveLMSBanner } from "@/components/InactiveLMSBanner";
import { Play, Lock, CheckCircle, Clock, BookOpen, ChevronDown, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";

const Videos = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { modules, loading, refreshData } = useModulesWithRecordings();
  const { markRecordingWatched } = useProgressTracker(user);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [selectedRecording, setSelectedRecording] = useState<any>(null);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [userLMSStatus, setUserLMSStatus] = useState<string>('active');

  // Fetch user's LMS status
  React.useEffect(() => {
    const fetchUserLMSStatus = async () => {
      if (!user?.id) return;
      
      const { data } = await supabase
        .from('users')
        .select('lms_status')
        .eq('id', user.id)
        .single();
      
      if (data) {
        setUserLMSStatus(data.lms_status || 'active');
      }
    };
    
    fetchUserLMSStatus();
  }, [user?.id]);

  const handleWatchRecording = async (recording: any) => {
    if (userLMSStatus !== 'active') return;
    if (!recording.isUnlocked || !recording.recording_url) return;

    // Mark as watched
    await markRecordingWatched(recording.id);
    
    // Navigate to video player
    navigate(`/video-player?id=${recording.id}`);
  };

  const handleAssignmentClick = (recording: any) => {
    if (userLMSStatus !== 'active') return;
    setSelectedRecording(recording);
    setAssignmentDialogOpen(true);
  };

  const toggleModule = (moduleId: string) => {
    setExpandedModules(prev => {
      const newSet = new Set(prev);
      if (newSet.has(moduleId)) {
        newSet.delete(moduleId);
      } else {
        newSet.add(moduleId);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const totalRecordings = modules.reduce((sum, module) => sum + module.recordings.length, 0);

  return (
    <RoleGuard allowedRoles={['student', 'admin', 'mentor', 'superadmin']}>
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 animate-fade-in">
          <InactiveLMSBanner show={user?.role === 'student' && userLMSStatus === 'inactive'} />
        
        <div className="mb-4 sm:mb-6 px-4 sm:px-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2 text-foreground leading-tight">Available Lessons</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Watch lessons and complete assignments to track your progress
          </p>
        </div>

        {modules.length === 0 ? (
          <Card className="shadow-medium border-border/50">
            <CardContent className="p-8 text-center">
              <div className="text-muted-foreground">
                <Play className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2 text-foreground">No Video Lessons Available</h3>
                <p>Check back later for new lessons or contact your instructor.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {modules.map((module) => (
              <Card key={module.id} className="shadow-soft border border-border/50 bg-card overflow-hidden">
                <Collapsible
                  open={expandedModules.has(module.id)}
                  onOpenChange={() => toggleModule(module.id)}
                >
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors border-b border-border/50 p-4 sm:p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base sm:text-lg lg:text-xl font-semibold flex items-center gap-2 sm:gap-3">
                            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs sm:text-sm flex-shrink-0">
                              {module.order}
                            </div>
                            <span className="truncate">{module.title}</span>
                          </CardTitle>
                          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                            {module.recordings.length} recording{module.recordings.length !== 1 ? 's' : ''} • {module.recordings.filter(r => r.isWatched).length} completed
                          </p>
                        </div>
                        <div className="flex-shrink-0 ml-2">
                          {expandedModules.has(module.id) ? (
                            <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <CardContent className="p-0">
                      <div className="space-y-1 sm:space-y-2 p-3 sm:p-4">
                        {module.recordings.map((recording, index) => (
                          <div
                            key={recording.id}
                            className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg border transition-all ${
                              recording.isUnlocked && userLMSStatus === 'active'
                                ? 'bg-card border-border hover:border-primary/30 hover:shadow-soft' 
                                : 'bg-muted/30 border-muted'
                            }`}
                          >
                            <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                              <div className="flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-muted text-xs sm:text-sm font-medium flex-shrink-0">
                                {index + 1}
                              </div>
                              
                              <div className="flex-shrink-0">
                                {recording.isUnlocked && userLMSStatus === 'active' ? (
                                  recording.isWatched ? (
                                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-success" />
                                  ) : (
                                    <Play className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                                  )
                                ) : (
                                  <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                                )}
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <h4 className={`font-medium text-sm sm:text-base leading-tight ${!(recording.isUnlocked && userLMSStatus === 'active') ? 'text-muted-foreground' : ''}`}>
                                  {recording.recording_title}
                                </h4>
                                <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground mt-1">
                                  {recording.duration_min && (
                                    <span className="flex items-center gap-1 whitespace-nowrap">
                                      <Clock className="w-3 h-3" />
                                      {recording.duration_min} min
                                    </span>
                                  )}
                                  {recording.hasAssignment && (
                                    <Badge variant="outline" className="text-xs h-5">
                                      <BookOpen className="w-3 h-3 mr-1" />
                                      Assignment
                                    </Badge>
                                  )}
                                  {userLMSStatus !== 'active' && (
                                    <span className="text-orange-600 font-medium text-xs">
                                      Clear fees to access
                                    </span>
                                  )}
                                  {userLMSStatus === 'active' && !recording.isUnlocked && (
                                    <span className="text-orange-600 font-medium text-xs">
                                      Complete previous lesson
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 flex-wrap">
                              <div className="flex items-center gap-2 flex-wrap">
                                {recording.isWatched && (
                                  <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-xs h-6">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Done
                                  </Badge>
                                )}
                                
                                {recording.hasAssignment && recording.assignmentSubmitted && (
                                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs h-6">
                                    <Clock className="w-3 h-3 mr-1" />
                                    Submitted
                                  </Badge>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                {recording.hasAssignment && recording.isUnlocked && userLMSStatus === 'active' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleAssignmentClick(recording)}
                                    className="text-xs sm:text-sm h-8 sm:h-9 min-w-[44px]"
                                  >
                                    <BookOpen className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                                    <span className="hidden sm:inline">Assignment</span>
                                  </Button>
                                )}

                                <Button
                                  variant={recording.isWatched ? "outline" : "default"}
                                  size="sm"
                                  disabled={userLMSStatus !== 'active' || !recording.isUnlocked || !recording.recording_url}
                                  onClick={() => handleWatchRecording(recording)}
                                  className={`text-xs sm:text-sm h-8 sm:h-9 min-w-[44px] ${!(recording.isUnlocked && userLMSStatus === 'active') ? 'opacity-50' : ''}`}
                                >
                                  <Play className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                                  <span className="hidden sm:inline">
                                    {userLMSStatus !== 'active' ? 'Clear Fees' : 
                                      recording.isUnlocked ? (
                                        recording.isWatched ? 'Rewatch' : 'Watch'
                                      ) : (
                                        'Locked'
                                      )}
                                  </span>
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))}
          </div>
        )}

        {selectedRecording && selectedRecording.hasAssignment && (
          <StudentSubmissionDialog
            open={assignmentDialogOpen}
            onOpenChange={(open) => {
              setAssignmentDialogOpen(open);
              if (!open) {
                setSelectedRecording(null);
                // Refresh modules to update unlock status
                setTimeout(refreshData, 500);
              }
            }}
            assignment={{
              id: selectedRecording.id,
              name: `Assignment for ${selectedRecording.recording_title}`
            }}
            userId={user?.id || ""}
            hasSubmitted={selectedRecording.assignmentSubmitted}
            onSubmissionComplete={() => {
              setTimeout(refreshData, 500);
            }}
          />
        )}
        </div>
      </div>
    </RoleGuard>
  );
};

export default Videos;