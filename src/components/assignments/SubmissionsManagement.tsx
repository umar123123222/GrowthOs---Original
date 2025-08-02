import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, XCircle, Eye, MessageSquare, Clock, FileText } from 'lucide-react';
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-700">Submissions Management</h1>
          <p className="text-gray-500 mt-1">Manage assignment submissions and their assignments</p>
        </div>
        <div className="flex gap-3">
          <Button
            variant={filterStatus === 'all' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('all')}
            className={filterStatus === 'all' ? 'bg-purple-600 text-white' : ''}
          >
            All
          </Button>
          <Button
            variant={filterStatus === 'pending' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('pending')}
            className={filterStatus === 'pending' ? 'bg-purple-600 text-white' : ''}
          >
            Pending
          </Button>
          <Button
            variant={filterStatus === 'approved' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('approved')}
            className={filterStatus === 'approved' ? 'bg-purple-600 text-white' : ''}
          >
            Approved
          </Button>
          <Button
            variant={filterStatus === 'declined' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('declined')}
            className={filterStatus === 'declined' ? 'bg-purple-600 text-white' : ''}
          >
            Declined
          </Button>
        </div>
      </div>

      {/* All Submissions Section */}
      <div className="bg-white rounded-lg border">
        <div className="p-6 border-b">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-purple-600" />
            </div>
            <h2 className="text-xl font-semibold">All Submissions</h2>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          {submissions.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No submissions found</h3>
              <p className="text-gray-500">
                {userRole === 'mentor' 
                  ? "No submissions from your assigned students yet."
                  : "No submissions available to review at the moment."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold">Student</TableHead>
                  <TableHead className="font-semibold">Assignment</TableHead>
                  <TableHead className="font-semibold">Submitted</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((submission) => (
                  <TableRow key={submission.id} className="hover:bg-gray-50">
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                          <span className="text-xs font-semibold text-gray-600">
                            {submission.student.full_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium">{submission.student.full_name}</div>
                          <div className="text-sm text-gray-500">
                            {submission.student.student_id || submission.student.email}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">
                        {submission.assignment.name}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(submission.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge className={`${getStatusColor(submission.status)} font-medium`}>
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
                            className="hover:bg-gray-50"
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            Review
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                          <DialogHeader className="pb-4">
                            <DialogTitle className="text-2xl font-bold flex items-center space-x-3">
                              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                                <Eye className="w-4 h-4 text-primary" />
                              </div>
                              <span>Review Submission</span>
                            </DialogTitle>
                          </DialogHeader>
                          {selectedSubmission && (
                            <div className="space-y-8">
                              <div className="grid grid-cols-2 gap-6">
                                <div className="bg-muted/30 rounded-xl p-5">
                                  <div className="flex items-center space-x-2 mb-4">
                                    <div className="w-6 h-6 bg-primary/10 rounded-lg flex items-center justify-center">
                                      <span className="text-xs font-semibold text-primary">
                                        {selectedSubmission.student.full_name.charAt(0).toUpperCase()}
                                      </span>
                                    </div>
                                    <h3 className="font-semibold text-lg">Student Information</h3>
                                  </div>
                                  <div className="space-y-2">
                                    <p className="font-medium">{selectedSubmission.student.full_name}</p>
                                    <p className="text-sm text-muted-foreground">{selectedSubmission.student.email}</p>
                                    <p className="text-sm text-muted-foreground">{selectedSubmission.student.student_id}</p>
                                  </div>
                                </div>
                                <div className="bg-muted/30 rounded-xl p-5">
                                  <div className="flex items-center space-x-2 mb-4">
                                    <div className="w-6 h-6 bg-primary/10 rounded-lg flex items-center justify-center">
                                      <FileText className="w-4 h-4 text-primary" />
                                    </div>
                                    <h3 className="font-semibold text-lg">Assignment Details</h3>
                                  </div>
                                  <div className="space-y-2">
                                    <p className="font-medium">{selectedSubmission.assignment.name}</p>
                                    <div className="flex items-center space-x-2">
                                      <Clock className="w-4 h-4 text-muted-foreground" />
                                      <p className="text-sm text-muted-foreground">
                                        Submitted: {new Date(selectedSubmission.created_at).toLocaleString()}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="bg-card/50 rounded-xl p-6 border-2 border-border/60">
                                <div className="flex items-center space-x-2 mb-4">
                                  <div className="w-6 h-6 bg-primary/10 rounded-lg flex items-center justify-center">
                                    <MessageSquare className="w-4 h-4 text-primary" />
                                  </div>
                                  <h3 className="font-semibold text-lg">Submission Content</h3>
                                </div>
                                <div className="bg-muted/50 rounded-lg p-5">
                                  <p className="whitespace-pre-wrap leading-relaxed text-foreground">{selectedSubmission.content}</p>
                                </div>
                              </div>

                              {selectedSubmission.status === 'pending' && (
                                <div className="space-y-6">
                                  <div className="bg-muted/30 rounded-xl p-5">
                                    <label className="block text-sm font-semibold mb-3 flex items-center space-x-2">
                                      <MessageSquare className="w-4 h-4 text-primary" />
                                      <span>Review Notes</span>
                                    </label>
                                    <Textarea
                                      value={reviewNotes}
                                      onChange={(e) => setReviewNotes(e.target.value)}
                                      placeholder="Add feedback and notes for the student..."
                                      rows={4}
                                      className="border-2 bg-background/50 focus:bg-background transition-colors"
                                    />
                                  </div>
                                  <div className="flex gap-4">
                                    <Button
                                      onClick={() => handleReviewSubmission(selectedSubmission.id, 'approved')}
                                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                                    >
                                      <CheckCircle className="w-4 h-4 mr-2" />
                                      Approve
                                    </Button>
                                    <Button
                                      onClick={() => handleReviewSubmission(selectedSubmission.id, 'declined')}
                                      variant="outline"
                                      className="flex-1 border-red-200 hover:border-red-300 text-red-700 hover:bg-red-50"
                                    >
                                      <XCircle className="w-4 h-4 mr-2" />
                                      Decline
                                    </Button>
                                  </div>
                                </div>
                              )}

                              {selectedSubmission.status !== 'pending' && (
                                <div className="bg-muted/30 rounded-xl p-6">
                                  <div className="flex items-center space-x-2 mb-4">
                                    <div className="w-6 h-6 bg-primary/10 rounded-lg flex items-center justify-center">
                                      <CheckCircle className="w-4 h-4 text-primary" />
                                    </div>
                                    <h3 className="font-semibold text-lg">Review Status</h3>
                                  </div>
                                  <Badge className={`${getStatusColor(selectedSubmission.status)} font-medium text-base px-4 py-2`}>
                                    {selectedSubmission.status.toUpperCase()}
                                  </Badge>
                                  {selectedSubmission.notes && (
                                    <div className="mt-4 p-4 bg-background/50 rounded-lg border">
                                      <p className="font-medium mb-2 flex items-center space-x-2">
                                        <MessageSquare className="w-4 h-4" />
                                        <span>Feedback Notes:</span>
                                      </p>
                                      <p className="text-muted-foreground leading-relaxed">{selectedSubmission.notes}</p>
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
        </div>
      </div>
    </div>
  );
}