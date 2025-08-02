import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { StudentSubmissionDialog } from './StudentSubmissionDialog';

interface Assignment {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

interface Submission {
  id: string;
  assignment_id: string;
  status: string;
  notes?: string;
  created_at: string;
}

export function StudentAssignmentList() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    try {
      // Fetch all assignments
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('assignments')
        .select('*')
        .order('created_at', { ascending: false });

      if (assignmentsError) throw assignmentsError;

      // Fetch user's submissions
      const { data: submissionsData, error: submissionsError } = await supabase
        .from('submissions')
        .select('*')
        .eq('student_id', user.id);

      if (submissionsError) throw submissionsError;

      setAssignments(assignmentsData || []);
      setSubmissions(submissionsData || []);
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
      return (
        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
          <Clock className="w-3 h-3 mr-1" />
          Not Submitted
        </Badge>
      );
    }

    switch (submission.status) {
      case 'approved':
        return (
          <Badge variant="outline" className="bg-success/10 text-success border-success/20">
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved
          </Badge>
        );
      case 'declined':
        return (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
            <XCircle className="w-3 h-3 mr-1" />
            Declined
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
            <Clock className="w-3 h-3 mr-1" />
            Under Review
          </Badge>
        );
      default:
        return null;
    }
  };

  const handleSubmissionComplete = () => {
    fetchData();
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading assignments...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Assignments</h1>
        <p className="text-muted-foreground">Complete and submit your course assignments</p>
      </div>

      {assignments.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No assignments available</h3>
            <p className="text-muted-foreground">
              Check back later for new assignments from your instructors.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {assignments.map((assignment) => {
            const submission = getSubmissionStatus(assignment.id);
            const hasSubmitted = !!submission;
            
            return (
              <Card key={assignment.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl">{assignment.name}</CardTitle>
                      {assignment.description && (
                        <p className="text-muted-foreground mt-1">{assignment.description}</p>
                      )}
                      <p className="text-sm text-muted-foreground mt-2">
                        Assigned: {new Date(assignment.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {getStatusBadge(submission)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <div>
                      {submission?.notes && (
                        <div className="text-sm">
                          <p className="font-medium">Instructor Notes:</p>
                          <p className="text-muted-foreground">{submission.notes}</p>
                        </div>
                      )}
                    </div>
                    <Button
                      onClick={() => {
                        setSelectedAssignment(assignment);
                        setIsDialogOpen(true);
                      }}
                      variant={hasSubmitted ? "outline" : "default"}
                      disabled={submission?.status === 'approved'}
                    >
                      {submission?.status === 'approved' 
                        ? 'Completed' 
                        : submission?.status === 'declined'
                        ? 'Resubmit'
                        : hasSubmitted 
                        ? 'View Submission' 
                        : 'Submit Assignment'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {selectedAssignment && (
        <StudentSubmissionDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          assignment={selectedAssignment}
          userId={user?.id || ''}
          hasSubmitted={!!getSubmissionStatus(selectedAssignment.id) && getSubmissionStatus(selectedAssignment.id)?.status !== 'declined'}
          onSubmissionComplete={handleSubmissionComplete}
        />
      )}
    </div>
  );
}