import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  MessageSquare,
  Send,
  Loader2,
  ShieldAlert,
  CalendarClock,
  StickyNote,
  Inbox,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface Note {
  id: string;
  note: string;
  created_at: string;
  created_by_name: string;
  type: 'note' | 'suspension' | 'fee_extension' | 'scheduled_suspension';
  autoUnsuspendDate?: string;
  previousDueDate?: string;
  newDueDate?: string;
  scheduleSuspendDate?: string;
  scheduledStatus?: string;
}

interface StudentNotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
}

type FilterKey = 'all' | 'note' | 'suspension' | 'fee_extension' | 'scheduled_suspension';

const MAX_NOTE_LENGTH = 1000;

const getInitials = (name?: string | null) => {
  if (!name) return '?';
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join('') || '?'
  );
};

const typeMeta = (note: Note) => {
  switch (note.type) {
    case 'suspension':
      return {
        label: 'Suspension',
        icon: ShieldAlert,
        tone: 'border-l-destructive bg-destructive/5',
        chip: 'bg-destructive/10 text-destructive border-destructive/20',
        iconColor: 'text-destructive',
      };
    case 'fee_extension':
      return {
        label: 'Fee Extension',
        icon: CalendarClock,
        tone: 'border-l-amber-500 bg-amber-500/5',
        chip: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
        iconColor: 'text-amber-600',
      };
    case 'scheduled_suspension': {
      const status = note.scheduledStatus;
      if (status === 'cancelled') {
        return {
          label: 'Scheduled Suspension (Cancelled)',
          icon: CalendarClock,
          tone: 'border-l-muted-foreground bg-muted/40',
          chip: 'bg-muted text-muted-foreground border-border',
          iconColor: 'text-muted-foreground',
        };
      }
      if (status === 'executed') {
        return {
          label: 'Scheduled Suspension (Executed)',
          icon: CalendarClock,
          tone: 'border-l-destructive bg-destructive/5',
          chip: 'bg-destructive/10 text-destructive border-destructive/20',
          iconColor: 'text-destructive',
        };
      }
      return {
        label: 'Scheduled Suspension (Pending)',
        icon: CalendarClock,
        tone: 'border-l-amber-500 bg-amber-500/5',
        chip: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
        iconColor: 'text-amber-600',
      };
    }
    default:
      return {
        label: 'Note',
        icon: StickyNote,
        tone: 'border-l-primary bg-primary/5',
        chip: 'bg-primary/10 text-primary border-primary/20',
        iconColor: 'text-primary',
      };
  }
};

export function StudentNotesDialog({ open, onOpenChange, studentId, studentName }: StudentNotesDialogProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (open && studentId) {
      fetchNotes();
    }
  }, [open, studentId]);

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const [activityRes, extensionRes, scheduledRes] = await Promise.all([
        supabase
          .from('user_activity_logs')
          .select('id, metadata, occurred_at, activity_type')
          .eq('user_id', studentId)
          .in('activity_type', ['admin_note', 'lms_suspended'])
          .order('occurred_at', { ascending: false }),
        supabase
          .from('admin_logs')
          .select('id, data, created_at, performed_by, action')
          .eq('action', 'fee_extension_granted')
          .filter('data->>target_user_id', 'eq', studentId)
          .order('created_at', { ascending: false }),
        supabase
          .from('scheduled_suspensions' as any)
          .select('id, schedule_suspend_date, auto_unsuspend_date, reason, status, created_by, created_at, executed_at, cancelled_at')
          .eq('user_id', studentId)
          .order('created_at', { ascending: false }),
      ]);

      if (activityRes.error) throw activityRes.error;

      const activityData = activityRes.data || [];
      const extensionData = extensionRes.data || [];
      const scheduledData = (scheduledRes.data as any[]) || [];

      const creatorIds = [
        ...new Set([
          ...activityData.map((d) => {
            const meta = d.metadata as any;
            return meta?.created_by || meta?.suspended_by;
          }),
          ...extensionData.map((e) => e.performed_by),
          ...scheduledData.map((s) => s.created_by),
        ].filter(Boolean)),
      ];
      let creatorMap: Record<string, string> = {};
      if (creatorIds.length > 0) {
        const { data: creators } = await supabase
          .from('users')
          .select('id, full_name')
          .in('id', creatorIds);
        creatorMap = Object.fromEntries((creators || []).map((c) => [c.id, c.full_name]));
      }

      const activityNotes: Note[] = activityData.map((d) => {
        const meta = d.metadata as any;
        const isSuspension = d.activity_type === 'lms_suspended';
        return {
          id: d.id,
          note: isSuspension
            ? meta?.suspension_note || meta?.reason || 'No reason provided'
            : meta?.note || '',
          created_at: d.occurred_at,
          created_by_name: creatorMap[meta?.created_by || meta?.suspended_by] || 'System',
          type: isSuspension ? 'suspension' : 'note',
          autoUnsuspendDate: isSuspension ? meta?.auto_unsuspend_date : undefined,
        };
      });

      const extensionNotes: Note[] = extensionData.map((e) => {
        const d = (e.data as any) || {};
        const reason = d.reason ? ` Reason: ${d.reason}` : '';
        const instLabel = d.installment_number ? ` (Installment #${d.installment_number})` : '';
        return {
          id: e.id,
          note: `Fee due date extended${instLabel}.${reason}`,
          created_at: e.created_at,
          created_by_name: e.performed_by ? creatorMap[e.performed_by] || 'Admin' : 'System',
          type: 'fee_extension',
          previousDueDate: d.previous_due_date,
          newDueDate: d.new_due_date,
        };
      });

      const scheduledNotes: Note[] = scheduledData.map((s) => {
        const status = s.cancelled_at ? 'cancelled' : s.executed_at ? 'executed' : s.status || 'pending';
        const reasonStr = s.reason ? ` Reason: ${s.reason}` : '';
        const label =
          status === 'cancelled'
            ? 'Scheduled suspension cancelled.'
            : status === 'executed'
              ? 'Scheduled suspension executed.'
              : `Suspension scheduled for ${format(new Date(s.schedule_suspend_date), 'MMM d, yyyy h:mm a')}.${s.auto_unsuspend_date ? ` Auto-unsuspend on ${format(new Date(s.auto_unsuspend_date), 'MMM d, yyyy')}.` : ''}`;
        return {
          id: `sched-${s.id}`,
          note: `${label}${reasonStr}`,
          created_at: s.created_at,
          created_by_name: s.created_by ? creatorMap[s.created_by] || 'Admin' : 'System',
          type: 'scheduled_suspension',
          scheduleSuspendDate: s.schedule_suspend_date,
          autoUnsuspendDate: s.auto_unsuspend_date,
          scheduledStatus: status,
        };
      });

      const merged = [...activityNotes, ...extensionNotes, ...scheduledNotes].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setNotes(merged);
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    const value = newNote.trim();
    if (!value) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('user_activity_logs').insert({
        user_id: studentId,
        activity_type: 'admin_note',
        occurred_at: new Date().toISOString(),
        metadata: { note: value, created_by: user?.id || null },
      });
      if (error) throw error;
      setNewNote('');
      fetchNotes();
      toast({ title: 'Note added', description: 'Student note saved successfully.' });
    } catch (error) {
      console.error('Error adding note:', error);
      toast({ title: 'Error', description: 'Failed to add note', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const counts = useMemo(() => {
    return notes.reduce<Record<FilterKey, number>>(
      (acc, n) => {
        acc.all += 1;
        acc[n.type] += 1;
        return acc;
      },
      { all: 0, note: 0, suspension: 0, fee_extension: 0, scheduled_suspension: 0 }
    );
  }, [notes]);

  const filteredNotes = useMemo(
    () => (filter === 'all' ? notes : notes.filter((n) => n.type === filter)),
    [notes, filter]
  );

  const filters: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'note', label: 'Notes' },
    { key: 'suspension', label: 'Suspensions' },
    { key: 'scheduled_suspension', label: 'Scheduled' },
    { key: 'fee_extension', label: 'Fee Extensions' },
  ];

  const charCount = newNote.length;
  const overLimit = charCount > MAX_NOTE_LENGTH;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden h-[85vh] max-h-[85vh] flex flex-col">
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b bg-muted/40 space-y-0 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
              {getInitials(studentName)}
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-semibold truncate">{studentName}</DialogTitle>
              <DialogDescription className="text-xs mt-0.5 flex items-center gap-1.5">
                <MessageSquare className="w-3 h-3" />
                Notes & history timeline
              </DialogDescription>
            </div>
            <Badge variant="secondary" className="rounded-full font-medium">
              {counts.all} {counts.all === 1 ? 'entry' : 'entries'}
            </Badge>
          </div>
        </DialogHeader>

        {/* Composer */}
        <div className="px-6 py-4 border-b bg-background shrink-0">
          <div className="rounded-lg border bg-card focus-within:ring-2 focus-within:ring-ring focus-within:border-ring transition-all">
            <Textarea
              placeholder="Add a note about this student..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={2}
              className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 resize-none text-sm bg-transparent"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAddNote();
              }}
            />
            <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/30">
              <span className="text-[11px] text-muted-foreground">
                <kbd className="px-1.5 py-0.5 rounded border bg-background font-mono text-[10px]">⌘</kbd>
                <span className="mx-1">+</span>
                <kbd className="px-1.5 py-0.5 rounded border bg-background font-mono text-[10px]">↵</kbd>
                <span className="ml-1.5">to send</span>
              </span>
              <div className="flex items-center gap-3">
                <span className={cn('text-[11px] tabular-nums', overLimit ? 'text-destructive font-medium' : 'text-muted-foreground')}>
                  {charCount}/{MAX_NOTE_LENGTH}
                </span>
                <Button size="sm" onClick={handleAddNote} disabled={submitting || !newNote.trim() || overLimit} className="h-8">
                  {submitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Add Note
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Filter chips */}
        {notes.length > 0 && (
          <div className="px-6 py-3 border-b bg-background flex flex-wrap gap-1.5 shrink-0">
            {filters.map((f) => {
              const count = counts[f.key];
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  disabled={count === 0 && f.key !== 'all'}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                    active
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed'
                  )}
                >
                  {f.label}
                  <span
                    className={cn(
                      'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold',
                      active ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Timeline */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="px-6 py-4">

            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Loading history...</p>
              </div>
            ) : filteredNotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-12 px-4">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Inbox className="w-5 h-5 text-muted-foreground" />
                </div>
                <h3 className="text-sm font-semibold">
                  {notes.length === 0 ? 'No notes yet' : 'No matching entries'}
                </h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  {notes.length === 0
                    ? 'Add your first note above to start building a history for this student.'
                    : 'Try a different filter to see other entries.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredNotes.map((note) => {
                  const meta = typeMeta(note);
                  const Icon = meta.icon;
                  const date = new Date(note.created_at);
                  return (
                    <div
                      key={note.id}
                      className={cn(
                        'rounded-lg border border-l-4 p-3.5 transition-colors hover:shadow-sm',
                        meta.tone
                      )}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Icon className={cn('w-3.5 h-3.5 shrink-0', meta.iconColor)} />
                          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border', meta.chip)}>
                            {meta.label}
                          </span>
                        </div>
                        <time
                          className="text-[11px] text-muted-foreground shrink-0 tabular-nums"
                          title={format(date, 'PPpp')}
                        >
                          {formatDistanceToNow(date, { addSuffix: true })}
                        </time>
                      </div>

                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{note.note}</p>

                      {note.type === 'fee_extension' && (note.previousDueDate || note.newDueDate) && (
                        <p className="text-xs text-amber-700 dark:text-amber-400 mt-2 flex items-center gap-1.5">
                          {note.previousDueDate && (
                            <span className="line-through opacity-70">
                              {format(new Date(note.previousDueDate), 'MMM d, yyyy')}
                            </span>
                          )}
                          {note.previousDueDate && note.newDueDate && <span className="opacity-60">→</span>}
                          {note.newDueDate && (
                            <span className="font-semibold">
                              {format(new Date(note.newDueDate), 'MMM d, yyyy')}
                            </span>
                          )}
                        </p>
                      )}
                      {note.autoUnsuspendDate && note.type === 'suspension' && (
                        <p className="text-xs text-destructive/80 mt-2">
                          Auto-unsuspend: {format(new Date(note.autoUnsuspendDate), 'MMM d, yyyy')}
                        </p>
                      )}

                      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/50">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="w-5 h-5 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-[9px] font-bold shrink-0">
                            {getInitials(note.created_by_name)}
                          </div>
                          <span className="text-xs text-muted-foreground truncate">{note.created_by_name}</span>
                        </div>
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          {format(date, 'MMM d, h:mm a')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
