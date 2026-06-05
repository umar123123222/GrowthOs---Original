import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { Lock, Unlock, Eye, EyeOff, FileText, CheckCircle2, XCircle, Clock, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface VideoItem {
  id: string;
  recording_title: string | null;
  sequence_order: number | null;
  unlocked: boolean;
  unlocked_at: string | null;
  watched: boolean;
  watched_at: string | null;
}

interface AssignmentItem {
  id: string;
  name: string;
  unlocked: boolean;
  status: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  version: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: { id: string; full_name: string; email: string } | null;
}

const assignmentBadge = (unlocked: boolean, status: string) => {
  if (!unlocked && status === 'not_submitted') {
    return <Badge variant="secondary" className="bg-gray-100 text-gray-700"><Lock className="w-3 h-3 mr-1" /> Locked</Badge>;
  }
  switch (status) {
    case 'approved':
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-200"><CheckCircle2 className="w-3 h-3 mr-1" /> Approved</Badge>;
    case 'declined':
    case 'rejected':
      return <Badge className="bg-red-100 text-red-700 hover:bg-red-200"><XCircle className="w-3 h-3 mr-1" /> Declined</Badge>;
    case 'resubmission':
    case 'needs_resubmission':
      return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200"><RotateCcw className="w-3 h-3 mr-1" /> Resubmission</Badge>;
    case 'pending':
    case 'submitted':
      return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200"><Clock className="w-3 h-3 mr-1" /> Pending Review</Badge>;
    case 'not_submitted':
    default:
      return <Badge variant="outline"><FileText className="w-3 h-3 mr-1" /> Unlocked · Not submitted</Badge>;
  }
};

export const StudentEngagementDetail = ({ open, onOpenChange, student }: Props) => {
  const [loading, setLoading] = useState(false);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (!open || !student) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc('get_student_engagement_detail' as any, {
          p_user_id: student.id,
        });
        if (error) throw error;
        if (cancelled) return;
        const payload = (data || {}) as { videos?: VideoItem[]; assignments?: AssignmentItem[] };
        setVideos(payload.videos ?? []);
        setAssignments(payload.assignments ?? []);
      } catch (e: any) {
        console.error(e);
        toast({ title: 'Error', description: 'Failed to load engagement detail', variant: 'destructive' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, student, toast]);

  const unlockedVideos = videos.filter(v => v.unlocked).length;
  const watchedVideos = videos.filter(v => v.watched).length;
  const lockedVideos = videos.length - unlockedVideos;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {student?.full_name}
            <span className="ml-2 text-sm font-normal text-muted-foreground">{student?.email}</span>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : (
          <ScrollArea className="flex-1 pr-4">
            {/* Videos */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Videos</h3>
                <div className="flex gap-2 text-xs">
                  <Badge className="bg-green-100 text-green-700">Watched {watchedVideos}</Badge>
                  <Badge className="bg-blue-100 text-blue-700">Unlocked {unlockedVideos}</Badge>
                  <Badge variant="secondary">Locked {lockedVideos}</Badge>
                </div>
              </div>
              <div className="space-y-2">
                {videos.length === 0 && <p className="text-sm text-muted-foreground">No videos found.</p>}
                {videos.map(v => (
                  <div key={v.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">
                        {v.sequence_order != null ? `${v.sequence_order}. ` : ''}
                        {v.recording_title || 'Untitled'}
                      </div>
                      {v.watched_at && (
                        <div className="text-xs text-muted-foreground">
                          Watched {new Date(v.watched_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {!v.unlocked ? (
                        <Badge variant="secondary" className="bg-gray-100 text-gray-700"><Lock className="w-3 h-3 mr-1" /> Locked</Badge>
                      ) : v.watched ? (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-200"><Eye className="w-3 h-3 mr-1" /> Watched</Badge>
                      ) : (
                        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200"><Unlock className="w-3 h-3 mr-1" /> Unlocked · Not watched</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Assignments */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Assignments</h3>
              <div className="space-y-2">
                {assignments.length === 0 && <p className="text-sm text-muted-foreground">No assignments found.</p>}
                {assignments.map(a => (
                  <div key={a.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{a.name}</div>
                      {a.submitted_at && (
                        <div className="text-xs text-muted-foreground">
                          Submitted {new Date(a.submitted_at).toLocaleDateString()}
                          {a.version ? ` · v${a.version}` : ''}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0">{assignmentBadge(a.unlocked, a.status)}</div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};
