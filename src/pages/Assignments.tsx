import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { StudentSubmissionDialog } from "@/components/assignments/StudentSubmissionDialog";
import { SubmissionsManagement } from "@/components/assignments/SubmissionsManagement";
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Upload
} from "lucide-react";

interface Assignment {
  id: string;
  name: string;
  description: string;
  mentor_id: string;
  created_at: string;
  isUnlocked?: boolean;
}

interface Submission {
  id: string;
  assignment_id: string;
  status: string;
  content: string;
  created_at: string;
  notes: string;
}

interface AssignmentsProps {
  user?: any;
}

const Assignments = ({ user }: AssignmentsProps = {}) => {
  // If user is a mentor, admin, or superadmin, show submissions management instead
  if (user?.role === 'mentor' || user?.role === 'admin' || user?.role === 'superadmin') {
    return <SubmissionsManagement userRole={user.role} />;
  }

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<string | null>(null);
  const [submission, setSubmission] = useState("");
  const [loading, setLoading] = useState(true);
  const [submissionDialogOpen, setSubmissionDialogOpen] = useState(false);
  const [userLMSStatus, setUserLMSStatus] = useState('active');
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

      // Fetch user's LMS status
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('lms_status')
        .eq('id', user.id)
        .single();
      
      if (userError) throw userError;
      setUserLMSStatus(userData?.lms_status || 'active');

      // Fetch all assignments
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('assignments')
        .select('*')
        .order('name');

      if (assignmentsError) throw assignmentsError;

      // Fetch user's submissions
      const { data: submissions, error: submissionsError } = await supabase
        .from('submissions')
        .select('*')
        .eq('student_id', user.id);

      if (submissionsError) throw submissionsError;

      // For now, all assignments are unlocked (simplified version)
      const processedAssignments = assignmentsData?.map(assignment => ({
        ...assignment,
        isUnlocked: userLMSStatus === 'active'
      })) || [];

      setAssignments(processedAssignments);
      if (processedAssignments && processedAssignments.length > 0) {
        setSelectedAssignment(processedAssignments[0].id);
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
        .from('submissions')
        .select('*')
        .eq('student_id', user.id);

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

      const assignment = assignments.find(a => a.id === selectedAssignment);
      if (!assignment) throw new Error('Assignment not found');

      const { error } = await supabase
        .from('submissions')
        .insert({
          student_id: user.id,
          assignment_id: assignment.id,
          content: submission,
          status: 'pending'
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
    const submissionForAssignment = submissions.find(s => s.assignment_id === assignment.id);
    
    if (!assignment.isUnlocked) {
      return <Badge variant="secondary">Locked</Badge>;
    }
    
    if (submissionForAssignment) {
      if (submissionForAssignment.status === 'approved') {
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      }
      if (submissionForAssignment.status === 'declined') {
        return <Badge variant="destructive">Declined</Badge>;
      }
      return <Badge className="bg-blue-100 text-blue-800">Pending</Badge>;
    }
    
    return <Badge variant="outline">Not Started</Badge>;
  };

  const selectedAssignmentData = assignments.find(a => a.id === selectedAssignment);
  const selectedSubmission = selectedAssignmentData ? 
    submissions.find(s => s.assignment_id === selectedAssignmentData.id) : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Filter assignments to show only incomplete ones
  const incompleteAssignments = assignments
    .filter(assignment => {
      const submission = submissions.find(s => s.assignment_id === assignment.id);
      return !submission || submission.status !== 'approved';
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
              const isSubmitted = submissions.some(s => s.assignment_id === assignment.id);
              const isLocked = !assignment.isUnlocked;
              
              return (
                <Card 
                  key={assignment.id}
                  className={`cursor-pointer transition-all ${
                    selectedAssignment === assignment.id 
                      ? "border-blue-500 shadow-md" 
                      : "hover:shadow-sm"
                  } ${isLocked ? "opacity-50" : ""}`}
                  onClick={() => !isLocked && setSelectedAssignment(assignment.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className={`font-semibold text-sm ${isLocked ? "text-gray-400" : ""}`}>
                        {isLocked ? "🔒 " : ""}{assignment.name}
                      </h3>
                      {getStatusBadge(assignment)}
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Created: {new Date(assignment.created_at).toLocaleDateString()}</span>
                    </div>
                    
                    <div className="mt-2 flex items-center justify-between">
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
                    <span className="text-2xl">✅</span>
                    <div>
                      <h3 className="font-semibold text-sm">Completed Assignments</h3>
                      <p className="text-xs">{remainingAssignments} assignments completed</p>
                    </div>
                  </div>
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
                <CardTitle className="text-xl">{selectedAssignmentData.name}</CardTitle>
                {getStatusBadge(selectedAssignmentData)}
              </div>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <span>Created: {new Date(selectedAssignmentData.created_at).toLocaleDateString()}</span>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Description */}
              <div>
                <h3 className="font-semibold mb-2">Assignment Description</h3>
                <p className="text-gray-600">{selectedAssignmentData.description || 'No description provided'}</p>
              </div>

              {/* Submission Area */}
              <div>
                <h3 className="font-semibold mb-2">Your Submission</h3>
                {selectedSubmission ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-green-800">
                          Status: {selectedSubmission.status}
                        </span>
                        <span className="text-xs text-green-600">
                          {new Date(selectedSubmission.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{selectedSubmission.content}</p>
                      {selectedSubmission.notes && (
                        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                          <h4 className="text-sm font-medium text-blue-800 mb-1">Feedback</h4>
                          <p className="text-sm text-blue-700">{selectedSubmission.notes}</p>
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
                        disabled={!submission.trim() || userLMSStatus !== 'active'}
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        Submit Assignment
                      </Button>
                      
                      <Button 
                        variant="outline"
                        onClick={() => setSubmissionDialogOpen(true)}
                        disabled={!selectedAssignmentData?.isUnlocked || userLMSStatus !== 'active'}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Submit with File
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {userLMSStatus !== 'active' && (
                <Card className="bg-red-50 border-red-200">
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-red-800">Access Suspended</h4>
                        <p className="text-red-700 text-sm mt-1">
                          Your LMS access has been suspended. Please contact support to restore access.
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

      {/* Assignment Submission Dialog */}
      {selectedAssignmentData && (
        <StudentSubmissionDialog
          open={submissionDialogOpen}
          onOpenChange={setSubmissionDialogOpen}
          assignment={{
            id: selectedAssignmentData.id,
            name: selectedAssignmentData.name
          }}
          userId={user?.id || ""}
          onSubmissionComplete={() => {
            fetchSubmissions();
            fetchAssignments();
          }}
        />
      )}
    </div>
  );
};

export default Assignments;
