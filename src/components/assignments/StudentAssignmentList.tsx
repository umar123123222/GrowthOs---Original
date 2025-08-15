import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Clock, CheckCircle, XCircle, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useRecordingUnlocks } from '@/hooks/useRecordingUnlocks';
import { StudentSubmissionDialog } from './StudentSubmissionDialog';
import { useSearchParams } from 'react-router-dom';
interface Assignment {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  recording_id?: string;
  recording?: {
    recording_title: string;
    sequence_order: number;
  };
}
interface Submission {
  id: string;
  assignment_id: string;
  status: string;
  notes?: string;
  created_at: string;
}
export function StudentAssignmentList({ filterMode = 'unlocked' }: { filterMode?: 'unlocked' | 'submitted' }) {
  const {
    user
  } = useAuth();
  const {
    toast
  } = useToast();
  const {
    isRecordingUnlocked,
    loading: unlocksLoading
  } = useRecordingUnlocks();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [watchedRecordingIds, setWatchedRecordingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchParams] = useSearchParams();
  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  // Listen for real-time submission updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase.channel('assignment-submissions');
    
    channel
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'submissions',
        filter: `student_id=eq.${user.id}`
      }, (payload) => {
        console.log('Submission change detected:', payload);
        fetchData(); // Refetch all data when submission changes
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);
  useEffect(() => {
    // Handle deep-link to a specific assignmentId if present
    if (!loading && !unlocksLoading && assignments.length > 0) {
      const assignmentId = searchParams.get('assignmentId');
      if (!assignmentId) return;
      const target = assignments.find(a => a.id === assignmentId);
      if (!target) return;
      const submission = getSubmissionStatus(assignmentId);
      const isWatched = target.recording_id ? watchedRecordingIds.has(target.recording_id) : false;
      const isUnlocked = target.recording_id ? isRecordingUnlocked(target.recording_id) : false;
      const eligible = submission ? true : target.recording_id ? isWatched && isUnlocked : false;
      if (eligible) {
        setSelectedAssignment(target);
        setIsDialogOpen(true);
      } else {
        toast({
          title: 'Assignment Locked',
          description: 'Watch the prerequisite recording to unlock this assignment.',
          variant: 'destructive'
        });
      }
    }
  }, [loading, unlocksLoading, assignments, submissions, watchedRecordingIds, searchParams]);
  const fetchData = async () => {
    if (!user) return;
    try {
      // Fetch assignments with recording details
      const {
        data: assignmentsData,
        error: assignmentsError
      } = await supabase.from('assignments').select(`
          *,
          recording:available_lessons!assignments_recording_id_fkey (
            recording_title,
            sequence_order
          )
        `).order('created_at', {
        ascending: false
      });
      if (assignmentsError) throw assignmentsError;

      // Fetch user's submissions
      const {
        data: submissionsData,
        error: submissionsError
      } = await supabase.from('submissions').select('*').eq('student_id', user.id);
      if (submissionsError) throw submissionsError;

      // Fetch recording views (watched status)
      const {
        data: viewsData,
        error: viewsError
      } = await supabase.from('recording_views').select('recording_id, watched').eq('user_id', user.id);
      if (viewsError) throw viewsError;
      const watchedIds = new Set<string>((viewsData || []).filter(v => v.watched).map(v => v.recording_id));
      setAssignments(assignmentsData || []);
      setSubmissions(submissionsData || []);
      setWatchedRecordingIds(watchedIds);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch assignments',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };
  const getSubmissionStatus = (assignmentId: string) => {
    return submissions.find(s => s.assignment_id === assignmentId);
  };
  const getStatusBadge = (submission?: Submission) => {
    if (!submission) {
      return;
    }
    switch (submission.status) {
      case 'approved':
        return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved
          </Badge>;
      case 'declined':
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
            <XCircle className="w-3 h-3 mr-1" />
            Declined
          </Badge>;
      case 'pending':
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
            <Clock className="w-3 h-3 mr-1" />
            Under Review
          </Badge>;
      default:
        return null;
    }
  };
  const handleSubmissionComplete = () => {
    fetchData();
  };
  if (loading || unlocksLoading) {
    return <div className="flex justify-center items-center h-64">Loading assignments...</div>;
  }

  // Build filtered lists based on selected tab
  const isAssignmentUnlocked = (assignment: Assignment) => {
    if (!assignment.recording_id) return false;
    const watched = watchedRecordingIds.has(assignment.recording_id);
    const unlocked = isRecordingUnlocked(assignment.recording_id);
    return watched && unlocked;
  };

  let availableAssignments: Assignment[] = [];
  if (filterMode === 'submitted') {
    availableAssignments = assignments.filter(a => !!getSubmissionStatus(a.id));
  } else {
    // Unlocked
    availableAssignments = assignments.filter(a => isAssignmentUnlocked(a));
  }
  return <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Assignments</h1>
        <p className="text-muted-foreground">Complete and submit your course assignments</p>
      </div>

      {availableAssignments.length === 0 ? <Card>
          <CardContent className="text-center py-8">
            <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No assignments available</h3>
            <p className="text-muted-foreground">
              Complete the required recording to unlock assignments.
            </p>
          </CardContent>
        </Card> : <div className="grid gap-6">
          {availableAssignments.map(assignment => {
        const submission = getSubmissionStatus(assignment.id);
        const hasSubmitted = !!submission;
        return <Card key={assignment.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl">{assignment.name}</CardTitle>
                      {assignment.description && <p className="text-muted-foreground mt-1">{assignment.description}</p>}
                      <p className="text-sm text-muted-foreground mt-2">
                        Assigned: {new Date(assignment.created_at).toLocaleDateString()}
                      </p>
                      {assignment.recording && <p className="text-sm text-muted-foreground">
                          <Lock className="w-3 h-3 inline mr-1" />
                          Unlocked after: {assignment.recording.recording_title}
                        </p>}
                    </div>
                    {getStatusBadge(submission)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <div>
                      {submission?.notes && <div className="text-sm">
                          <p className="font-medium">Instructor Notes:</p>
                          <p className="text-muted-foreground">{submission.notes}</p>
                        </div>}
                    </div>
                    <Button onClick={() => {
                setSelectedAssignment(assignment);
                setIsDialogOpen(true);
              }} variant={hasSubmitted ? "outline" : "default"} disabled={submission?.status === 'approved'}>
                      {submission?.status === 'approved' ? 'Completed' : submission?.status === 'declined' ? 'Resubmit' : hasSubmitted ? 'View Submission' : 'Submit Assignment'}
                    </Button>
                  </div>
                </CardContent>
              </Card>;
      })}
        </div>}

      {selectedAssignment && <StudentSubmissionDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} assignment={selectedAssignment} userId={user?.id || ''} hasSubmitted={!!getSubmissionStatus(selectedAssignment.id) && getSubmissionStatus(selectedAssignment.id)?.status !== 'declined'} onSubmissionComplete={handleSubmissionComplete} />}
    </div>;
}