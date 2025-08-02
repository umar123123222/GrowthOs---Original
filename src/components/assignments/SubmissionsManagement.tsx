import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, XCircle, Eye, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  content: string;
  status: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  assignment: {
    name: string;
    description?: string;
    mentor_id?: string;
  };
  student: {
    full_name: string;
    email: string;
    student_id?: string;
  };
}

interface SubmissionsManagementProps {
  userRole?: 'mentor' | 'admin' | 'superadmin';
}

export function SubmissionsManagement({ userRole }: SubmissionsManagementProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    fetchSubmissions();
  }, [user, filterStatus]);

  const fetchSubmissions = async () => {
    if (!user) return;
    
    try {
      let query = supabase
        .from('submissions')
        .select(`
          *,
          assignment:assignments!submissions_assignment_id_fkey (
            name,
            description,
            mentor_id
          ),
          student:users!submissions_student_id_fkey (
            full_name,
            email,
            student_id
          )
        `)
        .order('created_at', { ascending: false });

      // Apply mentor-specific filtering based on role
      if (userRole === 'mentor') {
        // Only show submissions for assignments assigned to this mentor
        query = query.eq('assignments.mentor_id', user.id);
      }

      // Apply status filter if not 'all'
      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching submissions:', error);
        throw error;
      }
      
      setSubmissions(data || []);
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

  const handleReviewSubmission = async (submissionId: string, status: 'approved' | 'declined') => {
    try {
      const { error } = await supabase
        .from('submissions')
        .update({
          status,
          notes: reviewNotes.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', submissionId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Submission ${status} successfully`
      });

      setSelectedSubmission(null);
      setReviewNotes('');
      fetchSubmissions();
    } catch (error) {
      console.error('Error reviewing submission:', error);
      toast({
        title: 'Error',
        description: 'Failed to review submission',
        variant: 'destructive'
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-success/10 text-success border-success/20';
      case 'declined': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'pending': return 'bg-warning/10 text-warning border-warning/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

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
      case 'mentor': return 'Review and approve submissions from your assigned students';
      case 'admin': return 'Review and approve all student submissions';
      case 'superadmin': return 'Review and approve all student submissions';
      default: return 'Review and approve student submissions';
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
            variant={filterStatus === 'pending' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('pending')}
          >
            Pending
          </Button>
          <Button
            variant={filterStatus === 'approved' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('approved')}
          >
            Approved
          </Button>
          <Button
            variant={filterStatus === 'declined' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('declined')}
          >
            Declined
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
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((submission) => (
                  <TableRow key={submission.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{submission.student.full_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {submission.student.student_id || submission.student.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{submission.assignment.name}</div>
                    </TableCell>
                    <TableCell>
                      {new Date(submission.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(submission.status)}>
                        {submission.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedSubmission(submission);
                              setReviewNotes(submission.notes || '');
                            }}
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
                                  <p>{selectedSubmission.student.full_name}</p>
                                  <p className="text-sm text-muted-foreground">{selectedSubmission.student.email}</p>
                                  <p className="text-sm text-muted-foreground">{selectedSubmission.student.student_id}</p>
                                </div>
                                <div>
                                  <h3 className="font-semibold">Assignment</h3>
                                  <p>{selectedSubmission.assignment.name}</p>
                                  <p className="text-sm text-muted-foreground">
                                    Submitted: {new Date(selectedSubmission.created_at).toLocaleString()}
                                  </p>
                                </div>
                              </div>

                              <div>
                                <h3 className="font-semibold mb-2">Submission Content</h3>
                                <div className="p-4 bg-muted rounded-lg">
                                  <p className="whitespace-pre-wrap">{selectedSubmission.content}</p>
                                </div>
                              </div>

                              {selectedSubmission.status === 'pending' && (
                                <div className="space-y-4">
                                  <div>
                                    <label className="block text-sm font-medium mb-2">Review Notes</label>
                                    <Textarea
                                      value={reviewNotes}
                                      onChange={(e) => setReviewNotes(e.target.value)}
                                      placeholder="Add notes for the student..."
                                      rows={3}
                                    />
                                  </div>
                                   <div className="flex gap-2">
                                     <Button
                                       onClick={() => handleReviewSubmission(selectedSubmission.id, 'approved')}
                                       className="bg-green-600 text-white hover:bg-green-700"
                                     >
                                       <CheckCircle className="w-4 h-4 mr-2" />
                                       Approve
                                     </Button>
                                     <Button
                                       onClick={() => handleReviewSubmission(selectedSubmission.id, 'declined')}
                                       variant="destructive"
                                     >
                                       <XCircle className="w-4 h-4 mr-2" />
                                       Decline
                                     </Button>
                                   </div>
                                </div>
                              )}

                              {selectedSubmission.status !== 'pending' && (
                                <div>
                                  <h3 className="font-semibold mb-2">Review Status</h3>
                                  <Badge className={getStatusColor(selectedSubmission.status)}>
                                    {selectedSubmission.status}
                                  </Badge>
                                  {selectedSubmission.notes && (
                                    <div className="mt-2">
                                      <p className="text-sm font-medium">Notes:</p>
                                      <p className="text-sm text-muted-foreground">{selectedSubmission.notes}</p>
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