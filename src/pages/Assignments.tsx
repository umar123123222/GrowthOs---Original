
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
  Upload
} from "lucide-react";

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

  // Filter assignments to show only top 4 to be completed
  const incompleteAssignments = assignments
    .filter(assignment => {
      const submission = submissions.find(s => s.assignment_id === assignment.assignment_id);
      return !submission || submission.status !== 'accepted';
    })
    .slice(0, 4);

  const remainingAssignments = assignments.length - incompleteAssignments.length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Assignment List */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Assignments</h2>
        {assignments.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No Assignments Available</h3>
              <p>Check back later for new assignments or contact your instructor.</p>
            </div>
          </Card>
        ) : (
          <>
            {incompleteAssignments.map((assignment) => {
              const isSubmitted = submissions.some(s => s.assignment_id === assignment.assignment_id);
              const isOverdue = new Date(assignment.due_date) < new Date() && !isSubmitted;
              const isLocked = !assignment.isUnlocked;
              
              return (
                <Card 
                  key={assignment.assignment_id}
                  className={`cursor-pointer transition-all ${
                    selectedAssignment === assignment.assignment_id 
                      ? "border-blue-500 shadow-md" 
                      : "hover:shadow-sm"
                  } ${isLocked ? "opacity-50" : ""}`}
                  onClick={() => !isLocked && setSelectedAssignment(assignment.assignment_id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className={`font-semibold text-sm ${isLocked ? "text-gray-400" : ""}`}>
                        {isLocked ? "🔒 " : ""}{assignment.assignment_title}
                      </h3>
                      {getStatusBadge(assignment)}
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Assignment {assignment.sequence_order}</span>
                      <span className="flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        Due: {assignment.due_date ? new Date(assignment.due_date).toLocaleDateString() : 'No due date'}
                      </span>
                    </div>
                    
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-gray-600">Status: {assignment.Status || 'Pending'}</span>
                      {isOverdue && (
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      )}
                      {isSubmitted && (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            
            {/* Other Assignments Button */}
            {remainingAssignments > 0 && (
              <Card className="border-2 border-dashed border-gray-300 bg-gray-50">
                <CardContent className="p-4 text-center">
                  <div className="flex items-center justify-center space-x-2 text-gray-500">
                    <span className="text-2xl">🔒</span>
                    <div>
                      <h3 className="font-semibold text-sm">Other Assignments</h3>
                      <p className="text-xs">{remainingAssignments} more assignments locked</p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-3 opacity-50 cursor-not-allowed"
                    disabled
                  >
                    🔒 View All Assignments
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Assignment Details */}
      <div className="lg:col-span-2">
        {selectedAssignmentData && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">{selectedAssignmentData.assignment_title}</CardTitle>
                {getStatusBadge(selectedAssignmentData)}
              </div>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <span>Assignment {selectedAssignmentData.sequence_order}</span>
                <span>•</span>
                <span>Status: {selectedAssignmentData.Status}</span>
                <span>•</span>
                <span>Due: {new Date(selectedAssignmentData.due_date).toLocaleDateString()}</span>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Description */}
              <div>
                <h3 className="font-semibold mb-2">Assignment Description</h3>
                <p className="text-gray-600">{selectedAssignmentData.assignment_description}</p>
              </div>

              {/* Requirements */}
              <div>
                <h3 className="font-semibold mb-2">Requirements</h3>
                <ul className="list-disc list-inside text-gray-600 space-y-1">
                  <li>Submit a detailed report with your findings</li>
                  <li>Include screenshots and data to support your analysis</li>
                  <li>Minimum 500 words for written submissions</li>
                  <li>Follow the provided template format</li>
                </ul>
              </div>

              {/* Submission Area */}
              <div>
                <h3 className="font-semibold mb-2">Your Submission</h3>
                {selectedSubmission ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-green-800">Submitted</span>
                        <span className="text-xs text-green-600">
                          {new Date(selectedSubmission.submitted_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{selectedSubmission.text_response}</p>
                      {selectedSubmission.feedback && (
                        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                          <h4 className="text-sm font-medium text-blue-800 mb-1">Feedback</h4>
                          <p className="text-sm text-blue-700">{selectedSubmission.feedback}</p>
                          {selectedSubmission.score && (
                            <p className="text-sm font-medium text-blue-800 mt-2">
                              Score: {selectedSubmission.score}/100
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Textarea
                      placeholder="Write your assignment submission here..."
                      value={submission}
                      onChange={(e) => setSubmission(e.target.value)}
                      className="min-h-32"
                    />
                    
                    <div className="flex items-center space-x-4">
                      <Button 
                        className="bg-blue-600 hover:bg-blue-700"
                        onClick={submitAssignment}
                        disabled={!submission.trim()}
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        Submit Assignment
                      </Button>
                      
                      <Button variant="outline">
                        <Upload className="w-4 h-4 mr-2" />
                        Upload File
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* AI Feedback */}
              {selectedAssignmentData && new Date(selectedAssignmentData.due_date) < new Date() && !selectedSubmission && (
                <Card className="bg-red-50 border-red-200">
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-red-800">Assignment Overdue</h4>
                        <p className="text-red-700 text-sm mt-1">
                          This assignment is past due. Submit as soon as possible to maintain your progress.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Assignments;
