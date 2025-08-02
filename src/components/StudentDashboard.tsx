import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Lock, CheckCircle, Clock, BookOpen } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useStudentRecordings } from '@/hooks/useStudentRecordings';
import { useProgressTracker } from '@/hooks/useProgressTracker';
import { useNavigate } from 'react-router-dom';

export function StudentDashboard() {
  const { user } = useAuth();
  const { recordings, loading } = useStudentRecordings();
  const { markRecordingWatched } = useProgressTracker(user);
  const navigate = useNavigate();

  const handleWatchRecording = async (recording: any) => {
    if (!recording.isUnlocked || !recording.recording_url) return;

    // Mark as watched
    await markRecordingWatched(recording.id);
    
    // Navigate to video player
    navigate(`/video-player?id=${recording.id}`);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading dashboard...</div>;
  }

  console.log('StudentDashboard: Total recordings:', recordings.length);
  console.log('StudentDashboard: User:', user?.role);

  const unlockedRecordings = recordings.filter(r => r.isUnlocked);
  const nextRecording = unlockedRecordings.find(r => !r.isWatched);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Student Dashboard</h1>
        <p className="text-muted-foreground">Continue your learning journey</p>
      </div>

      {/* Progress Overview */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Unlocked Recordings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unlockedRecordings.length}</div>
            <p className="text-xs text-muted-foreground">
              Available to watch
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {recordings.filter(r => r.isWatched).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Recordings watched
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Assignments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {recordings.filter(r => r.hasAssignment && r.assignmentSubmitted).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Assignments submitted
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Next Recording */}
      {nextRecording && (
        <Card>
          <CardHeader>
            <CardTitle>Continue Learning</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{nextRecording.recording_title}</h3>
                <p className="text-sm text-muted-foreground">
                  {nextRecording.duration_min ? `${nextRecording.duration_min} minutes` : 'Duration not specified'}
                </p>
              </div>
              <Button onClick={() => handleWatchRecording(nextRecording)}>
                <Play className="w-4 h-4 mr-2" />
                Watch Now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Recordings */}
      <Card>
        <CardHeader>
          <CardTitle>All Recordings ({recordings.length} total)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Progress through recordings sequentially. Complete assignments to unlock the next recording.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recordings.map((recording, index) => (
              <div
                key={recording.id}
                className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                  recording.isUnlocked 
                    ? 'bg-background border-border hover:border-primary/30' 
                    : 'bg-muted/30 border-muted'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-medium">
                    {index + 1}
                  </div>
                  
                  {recording.isUnlocked ? (
                    recording.isWatched ? (
                      <CheckCircle className="w-5 h-5 text-success" />
                    ) : (
                      <Play className="w-5 h-5 text-primary" />
                    )
                  ) : (
                    <Lock className="w-5 h-5 text-muted-foreground" />
                  )}
                  
                  <div className="flex-1">
                    <h4 className={`font-medium ${!recording.isUnlocked ? 'text-muted-foreground' : ''}`}>
                      {recording.recording_title}
                    </h4>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                      {recording.duration_min && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {recording.duration_min} min
                        </span>
                      )}
                      {recording.hasAssignment && (
                        <Badge variant="outline" className="text-xs">
                          <BookOpen className="w-3 h-3 mr-1" />
                          Assignment Required
                        </Badge>
                      )}
                      {!recording.isUnlocked && (
                        <span className="text-xs text-orange-600 font-medium">
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

                  <Button
                    variant={recording.isWatched ? "outline" : "default"}
                    size="sm"
                    disabled={!recording.isUnlocked || !recording.recording_url}
                    onClick={() => handleWatchRecording(recording)}
                    className={!recording.isUnlocked ? 'opacity-50' : ''}
                  >
                    {recording.isUnlocked ? (
                      recording.isWatched ? 'Rewatch' : 'Watch'
                    ) : (
                      'Locked'
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {recordings.length === 0 && (
            <div className="text-center py-12">
              <Play className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No recordings available</h3>
              <p className="text-muted-foreground">
                Contact your instructor for course content.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}