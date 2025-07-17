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

interface AssignmentSubmission {
  id: string;
  user_id: string;
  assignment_id: string;
  text_response?: string;
  file_url?: string;
  external_link?: string;
  status: string;
  submitted_at: string;
  score?: number;
  feedback?: string;
  users: {
    full_name: string;
    email: string;
    student_id?: string;
  };
  assignment: {
    assignment_title: string;
    assignment_description: string;
  };
}

export function SubmissionsManagement() {
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<AssignmentSubmission | null>(null);
  const [feedback, setFeedback] = useState('');
  const [score, setScore] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const { toast } = useToast();

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from('assignment_submissions')
        .select(`
          *,
          users!assignment_submissions_user_id_fkey (
            full_name,
            email,
            student_id
          ),
          assignment!assignment_submissions_assignment_id_fkey (
            assignment_title,
            assignment_description
          )
        `)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      setSubmissions((data as any) || []);
    } catch (error) {
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
      const { error } = await supabase
        .from('assignment_submissions')
        .update({
          status,
          feedback,
          score: score ? parseInt(score) : null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', submissionId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Assignment ${status} successfully`
      });

      setSelectedSubmission(null);
      setFeedback('');
      setScore('');
      fetchSubmissions();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to review submission',
        variant: 'destructive'
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'submitted': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredSubmissions = submissions.filter(submission => 
    filterStatus === 'all' || submission.status === filterStatus
  );

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading submissions...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Assignment Submissions</h1>
          <p className="text-muted-foreground">Review and grade student submissions</p>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Assignment</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSubmissions.map((submission) => (
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
                    {new Date(submission.submitted_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(submission.status)}>
                      {submission.status}
                    </Badge>
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
                          onClick={() => setSelectedSubmission(submission)}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Review
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

                            {selectedSubmission.status === 'submitted' && (
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
                                  <label className="block text-sm font-medium mb-2">Feedback</label>
                                  <Textarea
                                    value={feedback}
                                    onChange={(e) => setFeedback(e.target.value)}
                                    placeholder="Provide feedback for the student..."
                                    rows={4}
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    onClick={() => handleReviewSubmission(selectedSubmission.id, 'accepted')}
                                    className="bg-green-600 hover:bg-green-700"
                                  >
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Accept
                                  </Button>
                                  <Button
                                    onClick={() => handleReviewSubmission(selectedSubmission.id, 'rejected')}
                                    variant="destructive"
                                  >
                                    <XCircle className="w-4 h-4 mr-2" />
                                    Reject
                                  </Button>
                                </div>
                              </div>
                            )}

                            {selectedSubmission.feedback && (
                              <div className="p-4 bg-blue-50 rounded-lg">
                                <h4 className="font-medium mb-2">Previous Feedback:</h4>
                                <p>{selectedSubmission.feedback}</p>
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
        </CardContent>
      </Card>
    </div>
  );
}