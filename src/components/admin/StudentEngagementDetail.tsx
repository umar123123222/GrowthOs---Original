import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import {
  Lock, Unlock, Eye, EyeOff, FileText, CheckCircle2, XCircle, Clock,
  RotateCcw, PlayCircle, MonitorPlay, ClipboardList, BarChart3, BookOpen
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface VideoItem {
  id: string;
  recording_title: string | null;
  sequence_order: number | null;
  unlocked: boolean;
  unlocked_at: string | null;
  watched: boolean;
  watched_at: string | null;
  course_id: string | null;
  course_title: string | null;
}

interface AssignmentItem {
  id: string;
  name: string;
  unlocked: boolean;
  status: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  version: number | null;
  course_id: string | null;
  course_title: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: { id: string; full_name: string; email: string } | null;
}

const statusConfig: Record<string, { label: string; icon: React.ReactNode; badgeClass: string; barClass: string }> = {
  approved: {
    label: 'Approved',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    badgeClass: 'bg-success/15 text-success border-success/30',
    barClass: 'bg-success',
  },
  declined: {
    label: 'Declined',
    icon: <XCircle className="w-3.5 h-3.5" />,
    badgeClass: 'bg-destructive/15 text-destructive border-destructive/30',
    barClass: 'bg-destructive',
  },
  rejected: {
    label: 'Declined',
    icon: <XCircle className="w-3.5 h-3.5" />,
    badgeClass: 'bg-destructive/15 text-destructive border-destructive/30',
    barClass: 'bg-destructive',
  },
  resubmission: {
    label: 'Resubmission',
    icon: <RotateCcw className="w-3.5 h-3.5" />,
    badgeClass: 'bg-warning/20 text-warning-foreground border-warning/40',
    barClass: 'bg-warning',
  },
  needs_resubmission: {
    label: 'Resubmission',
    icon: <RotateCcw className="w-3.5 h-3.5" />,
    badgeClass: 'bg-warning/20 text-warning-foreground border-warning/40',
    barClass: 'bg-warning',
  },
  pending: {
    label: 'Pending Review',
    icon: <Clock className="w-3.5 h-3.5" />,
    badgeClass: 'bg-primary/15 text-primary border-primary/30',
    barClass: 'bg-primary',
  },
  submitted: {
    label: 'Pending Review',
    icon: <Clock className="w-3.5 h-3.5" />,
    badgeClass: 'bg-primary/15 text-primary border-primary/30',
    barClass: 'bg-primary',
  },
  not_submitted: {
    label: 'Not Submitted',
    icon: <FileText className="w-3.5 h-3.5" />,
    badgeClass: 'bg-muted text-muted-foreground border-border',
    barClass: 'bg-muted-foreground/40',
  },
};

const assignmentBadge = (unlocked: boolean, status: string) => {
  if (!unlocked && status === 'not_submitted') {
    return (
      <Badge variant="outline" className="bg-secondary/60 text-muted-foreground border-border/60 gap-1.5 px-2.5 py-0.5">
        <Lock className="w-3.5 h-3.5" /> Locked
      </Badge>
    );
  }
  const cfg = statusConfig[status] || statusConfig.not_submitted;
  return (
    <Badge variant="outline" className={`gap-1.5 px-2.5 py-0.5 font-medium ${cfg.badgeClass}`}>
      {cfg.icon} {cfg.label}
    </Badge>
  );
};

function groupByCourse<T extends { course_id: string | null; course_title: string | null }>(items: T[]) {
  const map = new Map<string, { course_id: string | null; course_title: string; items: T[] }>();
  for (const item of items) {
    const key = item.course_id || '__uncategorized__';
    if (!map.has(key)) {
      map.set(key, {
        course_id: item.course_id,
        course_title: item.course_title || 'Uncategorized',
        items: [],
      });
    }
    map.get(key)!.items.push(item);
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.course_id === null) return 1;
    if (b.course_id === null) return -1;
    return a.course_title.localeCompare(b.course_title);
  });
}

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

  const watchedVideos = videos.filter(v => v.watched).length;
  const unlockedVideos = videos.filter(v => v.unlocked).length;
  const lockedVideos = videos.length - unlockedVideos;
  const totalVideoProgress = videos.length ? Math.round((watchedVideos / videos.length) * 100) : 0;

  const approvedAssignments = assignments.filter(a => a.status === 'approved').length;
  const pendingAssignments = assignments.filter(a => a.status === 'pending' || a.status === 'submitted').length;
  const declinedAssignments = assignments.filter(a => a.status === 'declined' || a.status === 'rejected').length;
  const resubmissionAssignments = assignments.filter(a => a.status === 'resubmission' || a.status === 'needs_resubmission').length;
  const totalAssignmentProgress = assignments.length ? Math.round((approvedAssignments / assignments.length) * 100) : 0;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] p-0 flex flex-col gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
              {student?.full_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div>
              <DialogTitle className="text-lg leading-tight">{student?.full_name}</DialogTitle>
              <p className="text-sm text-muted-foreground">{student?.email}</p>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              Loading engagement data…
            </div>
          </div>
        ) : (
          <Tabs defaultValue="videos" className="flex flex-col min-h-0">
            <div className="px-6 pt-4 pb-0 shrink-0">
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="videos" className="gap-2">
                  <MonitorPlay className="w-4 h-4" /> Videos
                </TabsTrigger>
                <TabsTrigger value="assignments" className="gap-2">
                  <ClipboardList className="w-4 h-4" /> Assignments
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ─── Videos Tab ─── */}
            <TabsContent value="videos" className="flex flex-col min-h-0 m-0 mt-0 px-6 pb-6 pt-4 data-[state=inactive]:hidden">
              {/* Video Stats */}
              <div className="grid grid-cols-4 gap-3 mb-4 shrink-0">
                <div className="rounded-xl border bg-card p-3 relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-success rounded-l-xl" />
                  <div className="text-2xl font-bold text-success">{watchedVideos}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><Eye className="w-3 h-3" /> Watched</div>
                </div>
                <div className="rounded-xl border bg-card p-3 relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-xl" />
                  <div className="text-2xl font-bold text-primary">{unlockedVideos}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><Unlock className="w-3 h-3" /> Unlocked</div>
                </div>
                <div className="rounded-xl border bg-card p-3 relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-muted-foreground/40 rounded-l-xl" />
                  <div className="text-2xl font-bold text-muted-foreground">{lockedVideos}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><Lock className="w-3 h-3" /> Locked</div>
                </div>
                <div className="rounded-xl border bg-card p-3 relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/60 rounded-l-xl" />
                  <div className="text-2xl font-bold text-primary">{totalVideoProgress}%</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><BarChart3 className="w-3 h-3" /> Progress</div>
                </div>
              </div>

              {/* Video List */}
              <div className="max-h-[55vh] overflow-y-auto custom-scrollbar pr-1 space-y-2">
                {videos.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <MonitorPlay className="w-10 h-10 mb-3 opacity-30" />
                    <p className="text-sm">No videos found.</p>
                  </div>
                )}
                {groupByCourse(videos).map(group => {
                  const groupWatched = group.items.filter(v => v.watched).length;
                  return (
                    <div key={group.course_id ?? 'uncat'} className="space-y-2">
                      <div className="sticky top-0 z-10 -mx-1 px-3 py-2 bg-background/95 backdrop-blur border-b border-border/60 flex items-center justify-between rounded-md">
                        <div className="flex items-center gap-2 min-w-0">
                          <BookOpen className="w-4 h-4 text-primary shrink-0" />
                          <span className="font-semibold text-sm truncate">{group.course_title}</span>
                        </div>
                        <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30 shrink-0">
                          {groupWatched}/{group.items.length} watched
                        </Badge>
                      </div>
                      {group.items.map(v => {
                        const isWatched = v.watched;
                        const isUnlockedNotWatched = v.unlocked && !v.watched;
                        return (
                          <div
                            key={v.id}
                            className={`group relative flex items-center gap-4 rounded-xl border p-4 transition-all hover:shadow-soft ${
                              isWatched
                                ? 'bg-success/5 border-success/20'
                                : isUnlockedNotWatched
                                ? 'bg-primary/5 border-primary/20'
                                : 'bg-card border-border'
                            }`}
                          >
                            <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-full ${
                              isWatched ? 'bg-success' : isUnlockedNotWatched ? 'bg-primary' : 'bg-muted-foreground/30'
                            }`} />
                            <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
                              isWatched ? 'bg-success/15 text-success' : isUnlockedNotWatched ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                            }`}>
                              {isWatched ? <Eye className="w-4 h-4" /> : isUnlockedNotWatched ? <PlayCircle className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">
                                {v.sequence_order != null ? (
                                  <span className="text-muted-foreground mr-1">#{v.sequence_order}</span>
                                ) : null}
                                {v.recording_title || 'Untitled'}
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                {v.watched_at && (
                                  <span className="flex items-center gap-1 text-success">
                                    <Eye className="w-3 h-3" /> Watched {formatDate(v.watched_at)}
                                  </span>
                                )}
                                {v.unlocked_at && !v.watched && (
                                  <span className="flex items-center gap-1 text-primary">
                                    <Unlock className="w-3 h-3" /> Unlocked {formatDate(v.unlocked_at)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="shrink-0">
                              {isWatched ? (
                                <Badge variant="outline" className="bg-success/15 text-success border-success/30 gap-1.5 px-2.5 py-0.5 font-medium">
                                  <Eye className="w-3.5 h-3.5" /> Watched
                                </Badge>
                              ) : isUnlockedNotWatched ? (
                                <Badge variant="outline" className="bg-primary/15 text-primary border-primary/30 gap-1.5 px-2.5 py-0.5 font-medium">
                                  <PlayCircle className="w-3.5 h-3.5" /> Unlocked
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-secondary/60 text-muted-foreground border-border/60 gap-1.5 px-2.5 py-0.5">
                                  <Lock className="w-3.5 h-3.5" /> Locked
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            {/* ─── Assignments Tab ─── */}
            <TabsContent value="assignments" className="flex flex-col min-h-0 m-0 mt-0 px-6 pb-6 pt-4 data-[state=inactive]:hidden">
              {/* Assignment Stats */}
              <div className="grid grid-cols-5 gap-3 mb-4 shrink-0">
                <div className="rounded-xl border bg-card p-3 relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-success rounded-l-xl" />
                  <div className="text-2xl font-bold text-success">{approvedAssignments}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Approved</div>
                </div>
                <div className="rounded-xl border bg-card p-3 relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-xl" />
                  <div className="text-2xl font-bold text-primary">{pendingAssignments}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Pending</div>
                </div>
                <div className="rounded-xl border bg-card p-3 relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-destructive rounded-l-xl" />
                  <div className="text-2xl font-bold text-destructive">{declinedAssignments}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><XCircle className="w-3 h-3" /> Declined</div>
                </div>
                <div className="rounded-xl border bg-card p-3 relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-warning rounded-l-xl" />
                  <div className="text-2xl font-bold text-warning-foreground">{resubmissionAssignments}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><RotateCcw className="w-3 h-3" /> Resubmit</div>
                </div>
                <div className="rounded-xl border bg-card p-3 relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/60 rounded-l-xl" />
                  <div className="text-2xl font-bold text-primary">{totalAssignmentProgress}%</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><BarChart3 className="w-3 h-3" /> Progress</div>
                </div>
              </div>

              {/* Assignment List */}
              <div className="max-h-[55vh] overflow-y-auto custom-scrollbar pr-1 space-y-2">
                {assignments.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <ClipboardList className="w-10 h-10 mb-3 opacity-30" />
                    <p className="text-sm">No assignments found.</p>
                  </div>
                )}
                {groupByCourse(assignments).map(group => {
                  const groupApproved = group.items.filter(a => a.status === 'approved').length;
                  return (
                    <div key={group.course_id ?? 'uncat'} className="space-y-2">
                      <div className="sticky top-0 z-10 -mx-1 px-3 py-2 bg-background/95 backdrop-blur border-b border-border/60 flex items-center justify-between rounded-md">
                        <div className="flex items-center gap-2 min-w-0">
                          <BookOpen className="w-4 h-4 text-primary shrink-0" />
                          <span className="font-semibold text-sm truncate">{group.course_title}</span>
                        </div>
                        <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30 shrink-0">
                          {groupApproved}/{group.items.length} approved
                        </Badge>
                      </div>
                      {group.items.map(a => {
                        const cfg = !a.unlocked && a.status === 'not_submitted'
                          ? null
                          : statusConfig[a.status] || statusConfig.not_submitted;
                        return (
                          <div
                            key={a.id}
                            className={`group relative flex items-center gap-4 rounded-xl border p-4 transition-all hover:shadow-soft ${
                              cfg ? `border-l-4` : ''
                            } ${
                              a.status === 'approved' ? 'bg-success/5 border-success/20'
                              : a.status === 'declined' || a.status === 'rejected' ? 'bg-destructive/5 border-destructive/20'
                              : a.status === 'resubmission' || a.status === 'needs_resubmission' ? 'bg-warning/5 border-warning/30'
                              : a.status === 'pending' || a.status === 'submitted' ? 'bg-primary/5 border-primary/20'
                              : a.unlocked ? 'bg-card border-border'
                              : 'bg-secondary/30 border-border'
                            }`}
                          >
                            {cfg && (
                              <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-full ${cfg.barClass}`} />
                            )}
                            <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
                              a.status === 'approved' ? 'bg-success/15 text-success'
                              : a.status === 'declined' || a.status === 'rejected' ? 'bg-destructive/15 text-destructive'
                              : a.status === 'resubmission' || a.status === 'needs_resubmission' ? 'bg-warning/20 text-warning-foreground'
                              : a.status === 'pending' || a.status === 'submitted' ? 'bg-primary/15 text-primary'
                              : a.unlocked ? 'bg-muted text-muted-foreground'
                              : 'bg-secondary text-muted-foreground'
                            }`}>
                              {a.status === 'approved' ? <CheckCircle2 className="w-4 h-4" />
                              : a.status === 'declined' || a.status === 'rejected' ? <XCircle className="w-4 h-4" />
                              : a.status === 'resubmission' || a.status === 'needs_resubmission' ? <RotateCcw className="w-4 h-4" />
                              : a.status === 'pending' || a.status === 'submitted' ? <Clock className="w-4 h-4" />
                              : a.unlocked ? <FileText className="w-4 h-4" />
                              : <Lock className="w-4 h-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">{a.name}</div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                {a.submitted_at && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> Submitted {formatDate(a.submitted_at)}
                                    {a.version ? <span className="text-primary font-medium">· v{a.version}</span> : null}
                                  </span>
                                )}
                                {a.reviewed_at && (
                                  <span className="flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> Reviewed {formatDate(a.reviewed_at)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="shrink-0">{assignmentBadge(a.unlocked, a.status)}</div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};
