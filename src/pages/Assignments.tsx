
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
  "Assignment ID": string;
  "Assignment Title": string;
  "Assignment Description": string;
  "Due Date": string;
  sequence_order: number;
  Status: string;
}

interface Submission {
  id: string;
  assignment_id: number;
  status: string;
  text_response: string;
  submitted_at: string;
  feedback: string;
  score: number;
}

const Assignments = () => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<string | null>(null);
  const [submission, setSubmission] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchAssignments();
    fetchSubmissions();
  }, []);

  const fetchAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from('Assignment')
        .select('*')
        .order('sequence_order');

      if (error) throw error;
      setAssignments(data || []);
      if (data && data.length > 0) {
        setSelectedAssignment(data[0]["Assignment ID"]);
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const assignment = assignments.find(a => a["Assignment ID"] === selectedAssignment);
      if (!assignment) throw new Error('Assignment not found');

      const { error } = await supabase
        .from('assignment_submissions')
        .insert({
          user_id: user.id,
          assignment_id: assignment.sequence_order,
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

  const getStatusBadge = (assignment: Assignment) => {
    const submissionForAssignment = submissions.find(s => s.assignment_id === assignment.sequence_order);
    const dueDate = new Date(assignment["Due Date"]);
    const today = new Date();
    
    if (submissionForAssignment) {
      return <Badge className="bg-green-100 text-green-800">Submitted</Badge>;
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

  const selectedAssignmentData = assignments.find(a => a["Assignment ID"] === selectedAssignment);
  const selectedSubmission = selectedAssignmentData ? 
    submissions.find(s => s.assignment_id === selectedAssignmentData.sequence_order) : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Assignment List */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Assignments</h2>
        {assignments.map((assignment) => {
          const isSubmitted = submissions.some(s => s.assignment_id === assignment.sequence_order);
          const isOverdue = new Date(assignment["Due Date"]) < new Date() && !isSubmitted;
          
          return (
            <Card 
              key={assignment["Assignment ID"]}
              className={`cursor-pointer transition-all ${
                selectedAssignment === assignment["Assignment ID"] 
                  ? "border-blue-500 shadow-md" 
                  : "hover:shadow-sm"
              }`}
              onClick={() => setSelectedAssignment(assignment["Assignment ID"])}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-sm">{assignment["Assignment Title"]}</h3>
                  {getStatusBadge(assignment)}
                </div>
                
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Assignment {assignment.sequence_order}</span>
                  <span className="flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    Due: {new Date(assignment["Due Date"]).toLocaleDateString()}
                  </span>
                </div>
                
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-gray-600">Status: {assignment.Status}</span>
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
      </div>

      {/* Assignment Details */}
      <div className="lg:col-span-2">
        {selectedAssignmentData && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">{selectedAssignmentData["Assignment Title"]}</CardTitle>
                {getStatusBadge(selectedAssignmentData)}
              </div>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <span>Assignment {selectedAssignmentData.sequence_order}</span>
                <span>•</span>
                <span>Status: {selectedAssignmentData.Status}</span>
                <span>•</span>
                <span>Due: {new Date(selectedAssignmentData["Due Date"]).toLocaleDateString()}</span>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Description */}
              <div>
                <h3 className="font-semibold mb-2">Assignment Description</h3>
                <p className="text-gray-600">{selectedAssignmentData["Assignment Description"]}</p>
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
              {selectedAssignmentData && new Date(selectedAssignmentData["Due Date"]) < new Date() && !selectedSubmission && (
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
