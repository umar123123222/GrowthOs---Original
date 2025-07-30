import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, XCircle, Eye, FileText, Clock, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface AssignmentSubmission {
  id: string;
  user_id: string;
  assignment_id: string;
  text_response?: string;
  file_url?: string;
  external_link?: string;
  submission_type: string;
  status: string;
  submitted_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  reviewed_note?: string;
  score?: number;
  feedback?: string;
  users: {
    full_name: string;
    email: string;
    student_id?: string;
    mentor_id?: string;
  };
  assignment: {
    assignment_title: string;
    assignment_description: string;
  };
  mentor?: {
    full_name: string;
    email: string;
  } | null;
  reviewer?: {
    full_name: string;
    email: string;
  } | null;
}

interface SubmissionsManagementProps {
  userRole?: 'mentor' | 'admin' | 'superadmin';
}

export function SubmissionsManagement({ userRole }: SubmissionsManagementProps) {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<AssignmentSubmission | null>(null);
  const [feedback, setFeedback] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [score, setScore] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'submitted' | 'under_review' | 'accepted' | 'rejected' | 'resubmit'>('all');
  const { toast } = useToast();

  useEffect(() => {
    fetchSubmissions();
  }, [user, filterStatus]);

  const fetchSubmissions = async () => {
    if (!user) return;
    
    try {
      let query = supabase
        .from('assignment_submissions')
        .select(`
          *,
          users!assignment_submissions_user_id_fkey (
            full_name,
            email,
            student_id,
            mentor_id
          ),
          assignment!assignment_submissions_assignment_id_fkey (
            assignment_title,
            assignment_description
          ),
          reviewer:users!assignment_submissions_reviewed_by_fkey (
            full_name,
            email
          )
        `)
        .order('submitted_at', { ascending: false });

      // Apply status filter if not 'all'
      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus as 'submitted' | 'under_review' | 'accepted' | 'rejected' | 'resubmit');
      }

      // For mentors, the RLS policies will automatically filter to show only their assigned submissions
      // For admins and superadmins, they can see all submissions
      
      const { data, error } = await query;

      if (error) {
        console.error('Error fetching submissions:', error);
        throw error;
      }
      
      setSubmissions((data as any) || []);
    } catch (error) {
      console.error('Fetch submissions error:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch submissions',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReviewSubmission = async (submissionId: string, status: 'accepted' | 'rejected') => {
    try {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Use the new function that runs your exact SQL
      const { data, error } = await supabase
        .rpc('approve_assignment_submission', {
          p_submission_id: submissionId,
          p_new_status: status,
          p_mentor_id: user.id
        });

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error('No data returned from update');
      }

      // Log the updated row data
      console.log('Updated submission:', data[0]);

      toast({
        title: 'Success',
        description: `Assignment ${status} successfully`
      });

      setSelectedSubmission(null);
      setFeedback('');
      setReviewNote('');
      setScore('');
      fetchSubmissions();
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to review submission: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive'
      });
    }
  };

  // Check if current user can review this submission
  const canReviewSubmission = (submission: AssignmentSubmission) => {
    if (!user) return false;
    
    if (user.role === 'admin' || user.role === 'superadmin') {
      return true;
    }
    
    if (user.role === 'mentor') {
      return submission.users.mentor_id === user.id;
    }
    
    return false;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'submitted': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Submissions are already filtered by the server query

  const getTitle = () => {
    switch (userRole) {
      case 'mentor': return 'My Students\' Submissions';
      case 'admin': return 'Assignment Submissions';
      case 'superadmin': return 'Assignment Submissions';
      default: return 'Assignment Submissions';
    }
  };

  const getDescription = () => {
    switch (userRole) {
      case 'mentor': return 'Review and grade submissions from your assigned students';
      case 'admin': return 'Review and grade all student submissions';
      case 'superadmin': return 'Review and grade all student submissions';
      default: return 'Review and grade student submissions';
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading submissions...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{getTitle()}</h1>
          <p className="text-muted-foreground">{getDescription()}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={filterStatus === 'all' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('all')}
          >
            All
          </Button>
          <Button
            variant={filterStatus === 'submitted' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('submitted')}
          >
            Pending
          </Button>
          <Button
            variant={filterStatus === 'accepted' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('accepted')}
          >
            Accepted
          </Button>
          <Button
            variant={filterStatus === 'rejected' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('rejected')}
          >
            Rejected
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Submissions</CardTitle>
        </CardHeader>
        <CardContent>
          {submissions.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No submissions found</h3>
              <p className="text-muted-foreground">
                {userRole === 'mentor' 
                  ? "No submissions from your assigned students yet."
                  : "No submissions available to review."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Assignment</TableHead>
                  <TableHead>Mentor</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reviewed by</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((submission) => (
                  <TableRow key={submission.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{submission.users.full_name}</div>
                        <div className="text-sm text-muted-foreground">{submission.users.student_id}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{submission.assignment?.assignment_title}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {submission.mentor?.full_name || '—'}
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(submission.submitted_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(submission.status)}>
                        {submission.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {submission.reviewer?.full_name ? (
                          <div>
                            <div className="font-medium">{submission.reviewer.full_name}</div>
                            {submission.reviewed_at && (
                              <div className="text-xs text-muted-foreground">
                                {new Date(submission.reviewed_at).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        ) : '—'}
                      </div>
                    </TableCell>
                    <TableCell>
                      {submission.score ? `${submission.score}/100` : '-'}
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedSubmission(submission);
                              setFeedback(submission.feedback || '');
                              setReviewNote(submission.reviewed_note || '');
                              setScore(submission.score?.toString() || '');
                            }}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            {canReviewSubmission(submission) ? 'Review' : 'View'}
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Review Submission</DialogTitle>
                          </DialogHeader>
                          {selectedSubmission && (
                            <div className="space-y-6">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <h3 className="font-semibold">Student Information</h3>
                                  <p>{selectedSubmission.users.full_name}</p>
                                  <p className="text-sm text-muted-foreground">{selectedSubmission.users.email}</p>
                                  <p className="text-sm text-muted-foreground">{selectedSubmission.users.student_id}</p>
                                </div>
                                <div>
                                  <h3 className="font-semibold">Assignment</h3>
                                  <p>{selectedSubmission.assignment?.assignment_title}</p>
                                  <p className="text-sm text-muted-foreground">
                                    Submitted: {new Date(selectedSubmission.submitted_at).toLocaleString()}
                                  </p>
                                </div>
                              </div>

                              <div>
                                <h3 className="font-semibold mb-2">Submission Content</h3>
                                {selectedSubmission.text_response && (
                                  <div className="p-4 bg-gray-50 rounded-lg">
                                    <h4 className="font-medium mb-2">Text Response:</h4>
                                    <p className="whitespace-pre-wrap">{selectedSubmission.text_response}</p>
                                  </div>
                                )}
                                {selectedSubmission.file_url && (
                                  <div className="mt-2">
                                    <h4 className="font-medium mb-2">File Submission:</h4>
                                    <a
                                      href={selectedSubmission.file_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:underline flex items-center"
                                    >
                                      <FileText className="w-4 h-4 mr-2" />
                                      View Submitted File
                                    </a>
                                  </div>
                                )}
                                {selectedSubmission.external_link && (
                                  <div className="mt-2">
                                    <h4 className="font-medium mb-2">External Link:</h4>
                                    <a
                                      href={selectedSubmission.external_link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:underline"
                                    >
                                      {selectedSubmission.external_link}
                                    </a>
                                  </div>
                                )}
                              </div>

                              {selectedSubmission.status === 'submitted' && canReviewSubmission(selectedSubmission) && (
                                <div className="space-y-4">
                                  <div>
                                    <label className="block text-sm font-medium mb-2">Score (out of 100)</label>
                                    <Input
                                      type="number"
                                      min="0"
                                      max="100"
                                      value={score}
                                      onChange={(e) => setScore(e.target.value)}
                                      placeholder="Enter score..."
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium mb-2">Feedback for Student</label>
                                    <Textarea
                                      value={feedback}
                                      onChange={(e) => setFeedback(e.target.value)}
                                      placeholder="Provide feedback for the student..."
                                      rows={3}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium mb-2">Review Note (Internal)</label>
                                    <Textarea
                                      value={reviewNote}
                                      onChange={(e) => setReviewNote(e.target.value)}
                                      placeholder="Add internal review notes (optional)..."
                                      rows={2}
                                    />
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      onClick={() => handleReviewSubmission(selectedSubmission.id, 'accepted')}
                                      className="bg-green-600 hover:bg-green-700"
                                    >
                                      <CheckCircle className="w-4 h-4 mr-2" />
                                      Approve
                                    </Button>
                                    <Button
                                      onClick={() => handleReviewSubmission(selectedSubmission.id, 'rejected')}
                                      variant="destructive"
                                    >
                                      <XCircle className="w-4 h-4 mr-2" />
                                      Decline
                                    </Button>
                                  </div>
                                </div>
                              )}

                              {(selectedSubmission.feedback || selectedSubmission.reviewed_note) && (
                                <div className="space-y-3">
                                  {selectedSubmission.feedback && (
                                    <div className="p-4 bg-blue-50 rounded-lg">
                                      <h4 className="font-medium mb-2">Feedback for Student:</h4>
                                      <p>{selectedSubmission.feedback}</p>
                                    </div>
                                  )}
                                  {selectedSubmission.reviewed_note && (
                                    <div className="p-4 bg-gray-50 rounded-lg">
                                      <h4 className="font-medium mb-2">Review Notes (Internal):</h4>
                                      <p>{selectedSubmission.reviewed_note}</p>
                                    </div>
                                  )}
                                  {selectedSubmission.reviewer && (
                                    <div className="text-sm text-muted-foreground">
                                      Reviewed by: <span className="font-medium">{selectedSubmission.reviewer.full_name}</span>
                                      {selectedSubmission.reviewed_at && (
                                        <span> on {new Date(selectedSubmission.reviewed_at).toLocaleString()}</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}