
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Upload,
  BookOpen,
  Lock
} from "lucide-react";
import { format } from "date-fns";

interface Assignment {
  assignment_id: string;
  assignment_title: string;
  assignment_description: string;
  due_date: string;
  sequence_order: number;
  Status: string;
  isUnlocked?: boolean;
}

interface Submission {
  id: string;
  assignment_id: string;
  status: string;
  text_response: string;
  submitted_at: string;
  feedback: string;
  score: number;
}

interface AssignmentsProps {
  user?: any;
}

const Assignments = ({ user }: AssignmentsProps = {}) => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<string | null>(null);
  const [submission, setSubmission] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    console.log('Assignments useEffect triggered, user:', user);
    if (user?.id) {
      fetchAssignments();
      fetchSubmissions();
    }
  }, [user?.id]);

  const fetchAssignments = async () => {
    console.log('fetchAssignments called, user:', user);
    try {
      if (!user?.id) {
        console.log('No user ID, returning');
        return;
      }

      // Fetch all assignments
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('assignment')
        .select('*')
        .order('sequence_order');

      if (assignmentsError) throw assignmentsError;

      // Fetch user's submissions
      const { data: submissions, error: submissionsError } = await supabase
        .from('assignment_submissions')
        .select('*')
        .eq('user_id', user.id);

      if (submissionsError) throw submissionsError;

      // Determine which assignments are unlocked based on sequence
      const processedAssignments = assignmentsData?.map(assignment => {
        // Check if all previous assignments are completed
        const previousAssignments = assignmentsData.filter(a => a.sequence_order < assignment.sequence_order);
        const allPreviousCompleted = previousAssignments.every(prevAssignment => {
          const submission = submissions?.find(s => s.assignment_id === prevAssignment.assignment_id);
          return submission && submission.status === 'accepted';
        });

        // First assignment is always unlocked, others need previous ones completed
        const isUnlocked = assignment.sequence_order === 1 || allPreviousCompleted;

        return {
          ...assignment,
          isUnlocked
        };
      }) || [];

      setAssignments(processedAssignments);
      if (processedAssignments && processedAssignments.length > 0) {
        setSelectedAssignment(processedAssignments[0].assignment_id);
      }
    } catch (error) {
      console.error('Error fetching assignments:', error);
      toast({
        title: "Error",
        description: "Failed to load assignments",
        variant: "destructive",
      });
    }
  };

  const fetchSubmissions = async () => {
    try {
      if (!user?.id) return;

      const { data, error } = await supabase
        .from('assignment_submissions')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      setSubmissions(data || []);
    } catch (error) {
      console.error('Error fetching submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const submitAssignment = async () => {
    if (!submission.trim() || !selectedAssignment) return;

    try {
      if (!user?.id) throw new Error('No authenticated user');

      const assignment = assignments.find(a => a.assignment_id === selectedAssignment);
      if (!assignment) throw new Error('Assignment not found');

      const { error } = await supabase
        .from('assignment_submissions')
        .insert({
          user_id: user.id,
          assignment_id: assignment.assignment_id,
          submission_type: 'text',
          text_response: submission,
          status: 'submitted'
        });

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Assignment submitted successfully",
      });

      setSubmission("");
      fetchSubmissions();
    } catch (error) {
      console.error('Error submitting assignment:', error);
      toast({
        title: "Error",
        description: "Failed to submit assignment",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (assignment: Assignment & { isUnlocked?: boolean }) => {
    const submissionForAssignment = submissions.find(s => s.assignment_id === assignment.assignment_id);
    const dueDate = new Date(assignment.due_date);
    const today = new Date();
    
    if (!assignment.isUnlocked) {
      return <Badge variant="secondary">Locked</Badge>;
    }
    
    if (submissionForAssignment) {
      if (submissionForAssignment.status === 'accepted') {
        return <Badge className="bg-green-100 text-green-800">Accepted</Badge>;
      }
      return <Badge className="bg-blue-100 text-blue-800">Submitted</Badge>;
    }
    
    if (dueDate < today) {
      return <Badge variant="destructive">Overdue</Badge>;
    }
    
    const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilDue <= 3) {
      return <Badge className="bg-orange-100 text-orange-800">Due Soon</Badge>;
    }
    
    return <Badge variant="outline">Upcoming</Badge>;
  };

  const selectedAssignmentData = assignments.find(a => a.assignment_id === selectedAssignment);
  const selectedSubmission = selectedAssignmentData ? 
    submissions.find(s => s.assignment_id === selectedAssignmentData.assignment_id) : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {assignments.length === 0 ? (
        <Card className="shadow-lg">
          <CardContent className="p-8 text-center">
            <div className="text-gray-500">
              <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No Assignments Available</h3>
              <p>Check back later for new assignments or contact your instructor.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex h-[calc(100vh-120px)] gap-6">
          {/* Assignment List */}
          <div className="w-1/3 space-y-4 overflow-y-auto">
            {assignments.map((assignment) => {
              const submission = submissions.find(s => s.assignment_id === assignment.assignment_id);
              const isOverdue = assignment.due_date && new Date(assignment.due_date) < new Date() && !submission;
              
              return (
                <Card 
                  key={assignment.assignment_id} 
                  className={`cursor-pointer transition-all hover:shadow-md p-4 ${
                    selectedAssignment === assignment.assignment_id 
                      ? 'ring-2 ring-primary shadow-md' 
                      : ''
                  }`}
                  onClick={() => setSelectedAssignment(assignment.assignment_id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 pr-2">
                      <div className="flex items-start gap-2 mb-2">
                        <h3 className="font-medium text-sm leading-tight flex-1">{assignment.assignment_title}</h3>
                        {isOverdue && (
                          <Badge variant="destructive" className="text-xs px-1.5 py-0.5">
                            Overdue
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Assignment {assignment.sequence_order}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>Due: {assignment.due_date ? format(new Date(assignment.due_date), 'M/d/yyyy') : 'No due date'}</span>
                      </div>
                      <p className="text-xs mt-1 text-muted-foreground">
                        Status: {submission ? 'Submitted' : 'Pending'}
                      </p>
                    </div>
                    {!assignment.isUnlocked && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Lock className="w-3 h-3" />
                        <span className="text-xs">Locked</span>
                      </div>
                    )}
                    {submission && (
                      <AlertTriangle className="w-3 h-3 text-orange-500" />
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Assignment Detail */}
          <div className="flex-1 overflow-y-auto">
            {selectedAssignmentData ? (
              <Card className="h-full">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-start gap-3 mb-2">
                        <h2 className="text-xl font-semibold">{selectedAssignmentData.assignment_title}</h2>
                        {selectedAssignmentData.due_date && 
                         new Date(selectedAssignmentData.due_date) < new Date() && 
                         !submissions.find(s => s.assignment_id === selectedAssignmentData.assignment_id) && (
                          <Badge variant="destructive">Overdue</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                        <span>Assignment {selectedAssignmentData.sequence_order}</span>
                        <span>•</span>
                        <span>Status: {submissions.find(s => s.assignment_id === selectedAssignmentData.assignment_id) ? 'Submitted' : 'Pending'}</span>
                        <span>•</span>
                        <span>Due: {selectedAssignmentData.due_date ? format(new Date(selectedAssignmentData.due_date), 'M/d/yyyy') : 'No due date'}</span>
                      </div>
                    </div>
                  </div>

                  {selectedAssignmentData.assignment_description && (
                    <div className="mb-6">
                      <h3 className="font-semibold mb-2">Assignment Description</h3>
                      <p className="text-muted-foreground">{selectedAssignmentData.assignment_description}</p>
                    </div>
                  )}

                  <div className="mb-6">
                    <h3 className="font-semibold mb-3">Requirements</h3>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-start gap-2">
                        <div className="w-1 h-1 bg-current rounded-full mt-2 flex-shrink-0"></div>
                        <span>Submit a detailed report with your findings</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-1 h-1 bg-current rounded-full mt-2 flex-shrink-0"></div>
                        <span>Include screenshots and data to support your analysis</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-1 h-1 bg-current rounded-full mt-2 flex-shrink-0"></div>
                        <span>Minimum 500 words for written submissions</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-1 h-1 bg-current rounded-full mt-2 flex-shrink-0"></div>
                        <span>Follow the provided template format</span>
                      </div>
                    </div>
                  </div>

                  {selectedAssignmentData.isUnlocked ? (
                    <div className="space-y-4">
                      <h3 className="font-semibold">Your Submission</h3>
                      
                      <div className="space-y-4">
                        <Textarea
                          placeholder="Write your assignment submission here..."
                          value={submission}
                          onChange={(e) => setSubmission(e.target.value)}
                          className="min-h-[200px] resize-none"
                          disabled={!!submissions.find(s => s.assignment_id === selectedAssignmentData.assignment_id)}
                        />
                        
                        <div className="flex gap-3">
                          <Button 
                            onClick={submitAssignment}
                            disabled={!submission.trim() || !!submissions.find(s => s.assignment_id === selectedAssignmentData.assignment_id)}
                            className="flex-1"
                          >
                            <FileText className="w-4 h-4 mr-2" />
                            Submit Assignment
                          </Button>
                          <Button variant="outline" className="flex-1">
                            <Upload className="w-4 h-4 mr-2" />
                            Upload File
                          </Button>
                        </div>
                      </div>

                      {/* Show submission if exists */}
                      {(() => {
                        const existingSubmission = submissions.find(s => s.assignment_id === selectedAssignmentData.assignment_id);
                        if (existingSubmission) {
                          return (
                            <div className="mt-6 p-4 bg-muted rounded-lg">
                              <h4 className="font-medium mb-2">Your Submission</h4>
                              <p className="text-sm text-muted-foreground mb-2">
                                Submitted: {format(new Date(existingSubmission.submitted_at || ''), 'PPp')}
                              </p>
                              <p className="text-sm">{existingSubmission.text_response}</p>
                              {existingSubmission.feedback && (
                                <div className="mt-3 p-3 bg-background rounded border">
                                  <h5 className="font-medium mb-1">Feedback</h5>
                                  <p className="text-sm">{existingSubmission.feedback}</p>
                                  {existingSubmission.score && (
                                    <p className="text-sm mt-1">Score: {existingSubmission.score}/100</p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {/* Overdue warning */}
                      {selectedAssignmentData.due_date && 
                       new Date(selectedAssignmentData.due_date) < new Date() && 
                       !submissions.find(s => s.assignment_id === selectedAssignmentData.assignment_id) && (
                        <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                          <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                          <div>
                            <h4 className="font-medium text-destructive">Assignment Overdue</h4>
                            <p className="text-sm text-destructive/80">
                              This assignment is past due. Submit as soon as possible to maintain your progress.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Lock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="font-medium mb-2">Assignment Locked</h3>
                      <p className="text-sm text-muted-foreground">
                        Complete previous assignments to unlock this one.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="h-full">
                <CardContent className="p-8 text-center h-full flex flex-col items-center justify-center">
                  <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="font-medium mb-2">Select an Assignment</h3>
                  <p className="text-sm text-muted-foreground">
                    Choose an assignment from the list to view details and submit your work.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Assignments;
