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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto p-6">
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full mr-4">
              <FileText className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              My Assignments
            </h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Complete your assignments to unlock new content and progress in your learning journey
          </p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Assignment List */}
          <div className="space-y-6">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                <FileText className="w-4 h-4 text-primary" />
              </div>
              <h2 className="text-2xl font-bold">Assignment List</h2>
            </div>
            {assignments.length === 0 ? (
              <Card className="p-8 text-center border-dashed border-2 bg-muted/20">
                <div className="text-muted-foreground">
                  <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No Assignments Available</h3>
                  <p className="text-sm">Check back later for new assignments or contact your instructor.</p>
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
                    className={`group cursor-pointer transition-all duration-300 border-2 ${
                      selectedAssignment === assignment.id 
                        ? "border-primary shadow-lg bg-primary/5 ring-2 ring-primary/20" 
                        : "border-border/60 hover:border-primary/30 hover:shadow-md"
                    } ${isLocked ? "opacity-60" : ""}`}
                    onClick={() => !isLocked && setSelectedAssignment(assignment.id)}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          {isLocked ? (
                            <div className="w-8 h-8 bg-muted/50 rounded-lg flex items-center justify-center">
                              <Lock className="w-4 h-4 text-muted-foreground" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                              <FileText className="w-4 h-4 text-primary" />
                            </div>
                          )}
                          <h3 className={`font-semibold ${isLocked ? "text-muted-foreground" : "text-foreground"}`}>
                            {assignment.name}
                          </h3>
                        </div>
                        {getStatusBadge(assignment)}
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(assignment.created_at).toLocaleDateString()}</span>
                        </div>
                        
                        {isSubmitted && (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
            })}
            
              {/* Completed Assignments Summary */}
              {remainingAssignments > 0 && (
                <Card className="border-2 border-dashed border-green-200 bg-green-50/50">
                  <CardContent className="p-5 text-center">
                    <div className="flex items-center justify-center space-x-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-green-800">Completed Assignments</h3>
                        <p className="text-sm text-green-600">{remainingAssignments} assignments completed successfully</p>
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
              <Card className="shadow-lg border-0 bg-card/80 backdrop-blur-sm">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-primary/30 rounded-xl flex items-center justify-center">
                        <FileText className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-2xl font-bold">{selectedAssignmentData.name}</CardTitle>
                        <div className="flex items-center space-x-3 mt-2">
                          <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                            <Clock className="w-4 h-4" />
                            <span>{new Date(selectedAssignmentData.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    {getStatusBadge(selectedAssignmentData)}
                  </div>
                </CardHeader>
            
                <CardContent className="space-y-8">
                  {/* Description */}
                  <div className="bg-muted/30 rounded-xl p-6">
                    <div className="flex items-center space-x-2 mb-4">
                      <div className="w-6 h-6 bg-primary/10 rounded-lg flex items-center justify-center">
                        <FileText className="w-4 h-4 text-primary" />
                      </div>
                      <h3 className="font-semibold text-lg">Assignment Description</h3>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">{selectedAssignmentData.description || 'No description provided'}</p>
                  </div>

                  {/* Submission Area */}
                  <div>
                    <div className="flex items-center space-x-2 mb-6">
                      <div className="w-6 h-6 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Upload className="w-4 h-4 text-primary" />
                      </div>
                      <h3 className="font-semibold text-lg">Your Submission</h3>
                    </div>
                    {selectedSubmission ? (
                      <div className="space-y-4">
                        <div className="p-6 bg-gradient-to-r from-green-50 to-green-50/50 border-2 border-green-200 rounded-xl">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-2">
                              <CheckCircle className="w-5 h-5 text-green-600" />
                              <span className="font-semibold text-green-800">
                                Status: {selectedSubmission.status.toUpperCase()}
                              </span>
                            </div>
                            <span className="text-sm text-green-600 bg-green-100 px-3 py-1 rounded-full">
                              {new Date(selectedSubmission.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="bg-white/60 p-4 rounded-lg">
                            <p className="text-gray-700 leading-relaxed">{selectedSubmission.content}</p>
                          </div>
                          {selectedSubmission.notes && (
                            <div className="mt-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
                              <div className="flex items-center space-x-2 mb-2">
                                <MessageSquare className="w-4 h-4 text-blue-600" />
                                <h4 className="font-semibold text-blue-800">Instructor Feedback</h4>
                              </div>
                              <p className="text-blue-700 leading-relaxed">{selectedSubmission.notes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="bg-muted/30 rounded-xl p-6">
                          <Textarea
                            placeholder="Write your assignment submission here..."
                            value={submission}
                            onChange={(e) => setSubmission(e.target.value)}
                            className="min-h-32 border-2 bg-background/50 focus:bg-background transition-colors"
                          />
                        </div>
                        
                        <div className="flex items-center space-x-4">
                          <Button 
                            className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-md hover:shadow-lg transition-all"
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
                            className="border-2 hover:bg-muted/50"
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            Submit with File
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
                </CardContent>
              </Card>
            )}
          </div>
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
    </div>
  );
};

export default Assignments;
