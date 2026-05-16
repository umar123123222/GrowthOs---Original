import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BookOpen, Clock, CheckCircle, XCircle, Lock, Search, ArrowRight, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useRecordingUnlocks } from '@/hooks/useRecordingUnlocks';
import { EnhancedStudentSubmissionDialog } from './EnhancedStudentSubmissionDialog';
import { useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
interface Assignment {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  submission_type: 'text' | 'links' | 'attachments';
  recording?: {
    id: string;
    recording_title: string;
    sequence_order: number;
  };
}
interface Submission {
  id: string;
  assignment_id: string;
  status: string;
  notes?: string;
  created_at: string;
  version: number;
}
export function StudentAssignmentList({ filterMode = 'unlocked' }: { filterMode?: 'unlocked' | 'submitted' }) {
  const {
    user
  } = useAuth();
  const {
    toast
  } = useToast();
  const {
    isRecordingUnlocked,
    loading: unlocksLoading
  } = useRecordingUnlocks();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [watchedRecordingIds, setWatchedRecordingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchParams] = useSearchParams();
  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  // Listen for real-time submission updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase.channel('assignment-submissions');
    
    channel
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'submissions',
        filter: `student_id=eq.${user.id}`
      }, (payload) => {
        console.log('Submission change detected:', payload);
        fetchData(); // Refetch all data when submission changes
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);
  useEffect(() => {
    // Handle deep-link to a specific assignmentId if present
    if (!loading && !unlocksLoading && assignments.length > 0) {
      const assignmentId = searchParams.get('assignmentId');
      if (!assignmentId) return;
      const target = assignments.find(a => a.id === assignmentId);
      if (!target) return;
      const submission = getSubmissionStatus(assignmentId);
      // Check if assignment is unlocked (recording watched or no recording required)
      const eligible = submission ? true : isAssignmentUnlocked(target);
      if (eligible) {
        setSelectedAssignment(target);
        setIsDialogOpen(true);
      } else {
        toast({
          title: 'Assignment Locked',
          description: 'Watch the prerequisite recording to unlock this assignment.',
          variant: 'destructive'
        });
      }
    }
  }, [loading, unlocksLoading, assignments, submissions, watchedRecordingIds, searchParams]);
  const fetchData = async () => {
    if (!user) return;
    try {
      // Fetch assignments
      const {
        data: assignmentsData,
        error: assignmentsError
      } = await supabase.from('assignments').select('*, submission_type').order('created_at', {
        ascending: false
      });
      if (assignmentsError) throw assignmentsError;

      // Fetch recordings separately to get assignment linked recordings
      const {
        data: recordingsData,
        error: recordingsError
      } = await supabase.from('available_lessons').select('id, recording_title, sequence_order, assignment_id');
      if (recordingsError) throw recordingsError;

      // Fetch user's submissions with proper ordering
      const {
        data: submissionsData,
        error: submissionsError
      } = await supabase
        .from('submissions')
        .select('*')
        .eq('student_id', user.id)
        .order('version', { ascending: false })
        .order('created_at', { ascending: false });
      if (submissionsError) throw submissionsError;

      // Fetch recording views (watched status)
      const {
        data: viewsData,
        error: viewsError
      } = await supabase.from('recording_views').select('recording_id, watched').eq('user_id', user.id);
      if (viewsError) throw viewsError;
      const watchedIds = new Set<string>((viewsData || []).filter(v => v.watched).map(v => v.recording_id));
      // Combine assignments with their recordings
      const assignmentsWithRecordings = (assignmentsData || []).map(assignment => {
        const recording = recordingsData?.find(r => r.assignment_id === assignment.id);
        return {
          ...assignment,
          submission_type: assignment.submission_type as 'text' | 'links' | 'attachments',
          recording: recording ? {
            id: recording.id,
            recording_title: recording.recording_title,
            sequence_order: recording.sequence_order
          } : null
        };
      });
      
      setAssignments(assignmentsWithRecordings);
      setSubmissions(submissionsData || []);
      setWatchedRecordingIds(watchedIds);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch assignments',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };
  const getSubmissionStatus = (assignmentId: string) => {
    // Get the latest submission for this assignment (highest version or most recent)
    const assignmentSubmissions = submissions.filter(s => s.assignment_id === assignmentId);
    if (assignmentSubmissions.length === 0) return undefined;
    
    // Sort by version descending, then by created_at descending
    return assignmentSubmissions.sort((a, b) => {
      if (a.version !== b.version) {
        return b.version - a.version;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })[0];
  };
  const [search, setSearch] = useState('');

  const handleSubmissionComplete = () => {
    fetchData();
  };

  if (loading || unlocksLoading) {
    return <div className="flex justify-center items-center h-64 text-muted-foreground">Loading assignments...</div>;
  }

  // Build filtered lists based on selected tab
  const isAssignmentUnlocked = (assignment: Assignment) => {
    if (!assignment.recording) return true;
    const linkedRecordingId = assignment.recording.id;
    return isRecordingUnlocked(linkedRecordingId) || watchedRecordingIds.has(linkedRecordingId);
  };

  let availableAssignments: Assignment[] = [];
  if (filterMode === 'submitted') {
    availableAssignments = assignments.filter(a => getSubmissionStatus(a.id)?.status === 'approved');
  } else {
    availableAssignments = assignments.filter(a => {
      if (!isAssignmentUnlocked(a)) return false;
      const status = getSubmissionStatus(a.id)?.status;
      return !status || status === 'declined' || status === 'pending';
    });
  }

  const q = search.trim().toLowerCase();
  const filteredAssignments = !q ? availableAssignments : availableAssignments.filter(a =>
    a.name.toLowerCase().includes(q) ||
    (a.description || '').toLowerCase().includes(q) ||
    (a.recording?.recording_title || '').toLowerCase().includes(q)
  );
  

  type StatusKey = 'no_submission' | 'pending' | 'declined' | 'approved';
  const getStatusKey = (s?: Submission): StatusKey => {
    if (!s) return 'no_submission';
    if (s.status === 'approved') return 'approved';
    if (s.status === 'declined') return 'declined';
    return 'pending';
  };

  const statusMeta: Record<StatusKey, { label: string; chip: string; border: string; hoverTitle: string }> = {
    no_submission: {
      label: 'No Submission',
      chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      border: 'border-border hover:border-primary/40',
      hoverTitle: 'group-hover:text-primary',
    },
    pending: {
      label: 'Pending Review',
      chip: 'bg-primary/10 text-primary border-primary/20',
      border: 'border-border',
      hoverTitle: '',
    },
    declined: {
      label: 'Declined — Action Required',
      chip: 'bg-destructive/10 text-destructive border-destructive/20',
      border: 'border-destructive/30 hover:border-destructive/50',
      hoverTitle: 'group-hover:text-destructive',
    },
    approved: {
      label: 'Approved',
      chip: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30',
      border: 'border-green-500/30',
      hoverTitle: '',
    },
  };

  return (
    <div className="space-y-6">
      {/* Toolbar: title summary + search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight">
            {filterMode === 'submitted' ? 'Approved Assignments' : 'Outstanding Assignments'}
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {filterMode === 'submitted'
              ? 'Coursework you have successfully completed'
              : 'Pending, declined, and ready-to-submit work'}
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search assignments..."
            className="pl-9 bg-muted/40 border-transparent focus-visible:bg-background"
          />
        </div>
      </div>

      {filteredAssignments.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="text-center py-12">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <BookOpen className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold">
              {search
                ? 'No matches found'
                : filterMode === 'submitted'
                  ? 'No approved assignments yet'
                  : 'You\'re all caught up'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              {search
                ? 'Try a different search term.'
                : filterMode === 'submitted'
                  ? 'Submitted assignments will appear here once approved by your instructor.'
                  : 'Watch the prerequisite recordings to unlock new assignments.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {filteredAssignments.map(assignment => {
            const submission = getSubmissionStatus(assignment.id);
            const hasSubmitted = !!submission;
            const statusKey = getStatusKey(submission);
            const meta = statusMeta[statusKey];
            const isApproved = statusKey === 'approved';
            const isDeclined = statusKey === 'declined';
            const isPending = statusKey === 'pending';

            return (
              <Card
                key={assignment.id}
                className={cn(
                  'group transition-all duration-300 shadow-sm hover:shadow-lg p-5 sm:p-6 flex flex-col',
                  meta.border,
                  isApproved && 'bg-green-500/5'
                )}
              >
                {/* Top row: status chip + date */}
                <div className="flex justify-between items-start gap-3 mb-4">
                  <span className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border',
                    meta.chip
                  )}>
                    {isApproved && <CheckCircle className="w-3 h-3" />}
                    {isDeclined && <AlertCircle className="w-3 h-3" />}
                    {isPending && <Clock className="w-3 h-3" />}
                    {meta.label}
                  </span>
                  <div className="flex flex-col items-end shrink-0">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-tight">
                      {isApproved || isPending ? 'Submitted' : 'Assigned'}
                    </span>
                    <span className="text-sm font-bold text-foreground">
                      {new Date((submission?.created_at) || assignment.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Title + description */}
                <h3 className={cn(
                  'text-lg sm:text-xl font-bold text-foreground transition-colors line-clamp-2',
                  meta.hoverTitle
                )}>
                  {assignment.name}
                </h3>
                {assignment.description && (
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed line-clamp-3">
                    {assignment.description}
                  </p>
                )}

                {/* Instructor notes for declined */}
                {isDeclined && submission?.notes && (
                  <div className="mt-4 p-3 rounded-xl bg-destructive/5 border border-destructive/20">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-destructive mb-1">
                      Instructor Feedback
                    </p>
                    <p className="text-sm text-foreground/80 leading-relaxed">{submission.notes}</p>
                  </div>
                )}

                {/* Prerequisite block */}
                {assignment.recording && !isApproved && (
                  <div className="mt-4 p-3 rounded-xl bg-muted/50 border border-border/60">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <Lock className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase leading-none">
                          Unlocked after
                        </p>
                        <p className="text-sm font-semibold text-foreground truncate">
                          {assignment.recording.recording_title}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-auto pt-5">
                  {isApproved ? (
                    <Button
                      variant="ghost"
                      onClick={() => { setSelectedAssignment(assignment); setIsDialogOpen(true); }}
                      className="px-0 text-green-700 dark:text-green-400 hover:bg-transparent hover:text-green-800 dark:hover:text-green-300 font-bold group/btn"
                    >
                      View Submission
                      <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover/btn:translate-x-1" />
                    </Button>
                  ) : isDeclined ? (
                    <Button
                      onClick={() => { setSelectedAssignment(assignment); setIsDialogOpen(true); }}
                      variant="outline"
                      className="w-full font-bold border-2 border-foreground text-foreground hover:bg-foreground hover:text-background"
                    >
                      Resubmit Assignment
                    </Button>
                  ) : isPending ? (
                    <Button
                      onClick={() => { setSelectedAssignment(assignment); setIsDialogOpen(true); }}
                      variant="outline"
                      className="w-full font-semibold"
                    >
                      View Submission
                    </Button>
                  ) : (
                    <Button
                      onClick={() => { setSelectedAssignment(assignment); setIsDialogOpen(true); }}
                      className="w-full font-bold shadow-md shadow-primary/20 transition-all group-hover:scale-[1.02] active:scale-95"
                    >
                      Submit Assignment
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {selectedAssignment && (
        <EnhancedStudentSubmissionDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          assignment={selectedAssignment}
          userId={user?.id || ''}
          hasSubmitted={!!getSubmissionStatus(selectedAssignment.id) && getSubmissionStatus(selectedAssignment.id)?.status !== 'declined'}
          onSubmissionComplete={handleSubmissionComplete}
        />
      )}
    </div>
  );
}