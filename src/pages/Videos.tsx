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
        .maybeSingle();
      
      if (data) {
        setUserLMSStatus(data.lms_status || 'active');
      }
    };
    
    fetchUserLMSStatus();
  }, [user?.id]);

const handleWatchRecording = async (recording: any) => {
  if (userLMSStatus !== 'active') return;
  if (!recording.isUnlocked || !recording.recording_url) return;

  await markRecordingWatched(recording.id);
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
      <div className="space-y-6 animate-fade-in">
        <InactiveLMSBanner show={user?.role === 'student' && userLMSStatus === 'inactive'} />
        
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-foreground">Available Lessons</h1>
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
          <div className="space-y-4">
            {modules.map((module) => (
              <Card key={module.id} className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50">
                <Collapsible
                  open={expandedModules.has(module.id)}
                  onOpenChange={() => toggleModule(module.id)}
                >
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-gray-50/50 transition-colors border-b">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-xl font-semibold flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                              {module.order}
                            </div>
                            {module.title}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">
                            {module.recordings.length} recordings • {module.recordings.filter(r => r.isWatched).length} completed
                          </p>
                        </div>
                        {expandedModules.has(module.id) ? (
                          <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <CardContent className="p-0">
                      <div className="space-y-2 p-4">
                        {module.recordings.map((recording, index) => (
                          <div
                            key={recording.id}
                            className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                              recording.isUnlocked && userLMSStatus === 'active'
                                ? 'bg-white border-border hover:border-primary/30 hover:shadow-sm' 
                                : 'bg-muted/30 border-muted'
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-medium">
                                {index + 1}
                              </div>
                              
                              {recording.isUnlocked && userLMSStatus === 'active' ? (
                                recording.isWatched ? (
                                  <CheckCircle className="w-5 h-5 text-success" />
                                ) : (
                                  <Play className="w-5 h-5 text-primary" />
                                )
                              ) : (
                                <Lock className="w-5 h-5 text-muted-foreground" />
                              )}
                              
                              <div className="flex-1">
                                <h4 className={`font-medium ${!(recording.isUnlocked && userLMSStatus === 'active') ? 'text-muted-foreground' : ''}`}>
                                  {recording.recording_title}
                                </h4>
                                <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                                  {recording.duration_min && (
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {recording.duration_min} minutes
                                    </span>
                                  )}
                                  {recording.hasAssignment && (
                                    <Badge variant="outline" className="text-xs">
                                      <BookOpen className="w-3 h-3 mr-1" />
                                      Assignment Required
                                    </Badge>
                                  )}
                                  {userLMSStatus !== 'active' && (
                                    <span className="text-orange-600 font-medium text-xs">
                                      Please clear your fees to access content
                                    </span>
                                  )}
                                  {userLMSStatus === 'active' && !recording.isUnlocked && (
                                    <span className="text-orange-600 font-medium text-xs">
                                      Complete previous assignment to unlock
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {recording.isWatched && (
                                <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Completed
                                </Badge>
                              )}
                              
                              {recording.hasAssignment && recording.assignmentSubmitted && (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                  <Clock className="w-3 h-3 mr-1" />
                                  Assignment Submitted
                                </Badge>
                              )}

                              {recording.hasAssignment && recording.isUnlocked && userLMSStatus === 'active' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleAssignmentClick(recording)}
                                  className="mr-2"
                                >
                                  <BookOpen className="w-4 h-4 mr-1" />
                                  Assignment
                                </Button>
                              )}

                              <Button
                                variant={recording.isWatched ? "outline" : "default"}
                                size="sm"
                                disabled={userLMSStatus !== 'active' || !recording.isUnlocked || !recording.recording_url}
                                onClick={() => handleWatchRecording(recording)}
                                className={!(recording.isUnlocked && userLMSStatus === 'active') ? 'opacity-50' : ''}
                              >
                                <Play className="w-4 h-4 mr-1" />
                                {userLMSStatus !== 'active' ? 'Clear Fees' : 
                                  recording.isUnlocked ? (
                                    recording.isWatched ? 'Rewatch' : 'Watch Now'
                                  ) : (
                                    'Locked'
                                  )}
                              </Button>
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
              id: selectedRecording.assignmentId,
              name: selectedRecording.assignmentTitle || `Assignment for ${selectedRecording.recording_title}`
            }}
            userId={user?.id || ""}
            hasSubmitted={selectedRecording.assignmentSubmitted}
            onSubmissionComplete={() => {
              setTimeout(refreshData, 500);
            }}
          />
        )}
      </div>
    </RoleGuard>
  );
};

export default Videos;