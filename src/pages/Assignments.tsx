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
  Upload,
  Lock,
  MessageSquare
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-700">Assignments Management</h1>
        <p className="text-gray-500 mt-1">Manage assignment assignments and their assignments</p>
      </div>
        
      {/* All Assignments Section */}
      <div className="bg-white rounded-lg border">
        <div className="p-6 border-b">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-purple-600" />
            </div>
            <h2 className="text-xl font-semibold">All Assignments</h2>
          </div>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Assignment List */}
            <div className="space-y-4">
              {assignments.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No Assignments Available</h3>
                  <p className="text-gray-500 text-sm">Check back later for new assignments.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {incompleteAssignments.map((assignment) => {
                    const isSubmitted = submissions.some(s => s.assignment_id === assignment.id);
                    const isLocked = !assignment.isUnlocked;
                    
                    return (
                      <div 
                        key={assignment.id}
                        className={`p-4 border rounded-lg cursor-pointer transition-all ${
                          selectedAssignment === assignment.id 
                            ? "border-purple-200 bg-purple-50" 
                            : "border-gray-200 hover:border-purple-200"
                        } ${isLocked ? "opacity-60" : ""}`}
                        onClick={() => !isLocked && setSelectedAssignment(assignment.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            {isLocked ? (
                              <Lock className="w-4 h-4 text-gray-400" />
                            ) : (
                              <FileText className="w-4 h-4 text-purple-600" />
                            )}
                            <span className={`font-medium ${isLocked ? "text-gray-400" : "text-gray-900"}`}>
                              {assignment.name}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            {getStatusBadge(assignment)}
                            {isSubmitted && (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Completed Assignments Summary */}
                  {remainingAssignments > 0 && (
                    <div className="p-4 border-2 border-dashed border-green-200 bg-green-50 rounded-lg text-center">
                      <div className="flex items-center justify-center space-x-3">
                        <CheckCircle className="w-6 h-6 text-green-600" />
                        <div>
                          <h3 className="font-semibold text-green-800">Completed</h3>
                          <p className="text-sm text-green-600">{remainingAssignments} assignments completed</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Assignment Details */}
            <div className="lg:col-span-2">
              {selectedAssignmentData && (
                <div className="space-y-6">
                  <div className="border rounded-lg p-6 bg-white">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <h2 className="text-xl font-semibold">{selectedAssignmentData.name}</h2>
                          <div className="flex items-center space-x-2 text-sm text-gray-500 mt-1">
                            <Clock className="w-4 h-4" />
                            <span>{new Date(selectedAssignmentData.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      {getStatusBadge(selectedAssignmentData)}
                    </div>
                    
                    {/* Description */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-semibold mb-2">Assignment Description</h3>
                      <p className="text-gray-600">{selectedAssignmentData.description || 'No description provided'}</p>
                    </div>
                  </div>

                  {/* Submission Area */}
                  <div className="border rounded-lg p-6 bg-white">
                    <div className="flex items-center space-x-2 mb-4">
                      <Upload className="w-5 h-5 text-purple-600" />
                      <h3 className="font-semibold">Your Submission</h3>
                    </div>
                    {selectedSubmission ? (
                      <div className="space-y-4">
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-2">
                              <CheckCircle className="w-4 h-4 text-green-600" />
                              <span className="font-medium text-green-800">
                                Status: {selectedSubmission.status.toUpperCase()}
                              </span>
                            </div>
                            <span className="text-sm text-green-600">
                              {new Date(selectedSubmission.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="bg-white p-3 rounded border">
                            <p className="text-gray-700">{selectedSubmission.content}</p>
                          </div>
                          {selectedSubmission.notes && (
                            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                              <div className="flex items-center space-x-2 mb-2">
                                <MessageSquare className="w-4 h-4 text-blue-600" />
                                <h4 className="font-medium text-blue-800">Feedback</h4>
                              </div>
                              <p className="text-blue-700">{selectedSubmission.notes}</p>
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
                        
                        <div className="flex items-center space-x-3">
                          <Button 
                            className="bg-purple-600 hover:bg-purple-700 text-white"
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
                            Advanced Submission
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {userLMSStatus !== 'active' && (
                    <Card className="bg-gradient-to-r from-red-50 to-red-50/50 border-2 border-red-200">
                      <CardContent className="p-6">
                        <div className="flex items-start space-x-4">
                          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-red-800 mb-2">Access Suspended</h4>
                            <p className="text-red-700 leading-relaxed">
                              Your LMS access has been suspended. Please contact support to restore access and continue with your assignments.
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        
        <StudentSubmissionDialog
          open={submissionDialogOpen}
          onClose={() => setSubmissionDialogOpen(false)}
          assignment={selectedAssignmentData}
          onSubmissionSuccess={() => {
            fetchSubmissions();
            setSubmissionDialogOpen(false);
          }}
        />
      </div>
    </div>
  );
};

export default Assignments;