import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Send, Loader2, ShieldAlert, CalendarClock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

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

export function StudentNotesDialog({ open, onOpenChange, studentId, studentName }: StudentNotesDialogProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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

      // Resolve creator names from both sources
      const creatorIds = [
        ...new Set([
          ...activityData.map(d => {
            const meta = d.metadata as any;
            return meta?.created_by || meta?.suspended_by;
          }),
          ...extensionData.map(e => e.performed_by),
        ].filter(Boolean)),
      ];
      let creatorMap: Record<string, string> = {};
      if (creatorIds.length > 0) {
        const { data: creators } = await supabase
          .from('users')
          .select('id, full_name')
          .in('id', creatorIds);
        creatorMap = Object.fromEntries((creators || []).map(c => [c.id, c.full_name]));
      }

      const activityNotes: Note[] = activityData.map(d => {
        const meta = d.metadata as any;
        const isSuspension = d.activity_type === 'lms_suspended';
        return {
          id: d.id,
          note: isSuspension ? (meta?.suspension_note || meta?.reason || 'No reason provided') : (meta?.note || ''),
          created_at: d.occurred_at,
          created_by_name: creatorMap[meta?.created_by || meta?.suspended_by] || 'System',
          type: isSuspension ? 'suspension' as const : 'note' as const,
          autoUnsuspendDate: isSuspension ? meta?.auto_unsuspend_date : undefined,
        };
      });

      const extensionNotes: Note[] = extensionData.map(e => {
        const d = (e.data as any) || {};
        const reason = d.reason ? ` Reason: ${d.reason}` : '';
        const instLabel = d.installment_number ? ` (Installment #${d.installment_number})` : '';
        return {
          id: e.id,
          note: `Fee due date extended${instLabel}.${reason}`,
          created_at: e.created_at,
          created_by_name: e.performed_by ? (creatorMap[e.performed_by] || 'Admin') : 'System',
          type: 'fee_extension' as const,
          previousDueDate: d.previous_due_date,
          newDueDate: d.new_due_date,
        };
      });

      const merged = [...activityNotes, ...extensionNotes].sort(
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
    if (!newNote.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('user_activity_logs').insert({
        user_id: studentId,
        activity_type: 'admin_note',
        occurred_at: new Date().toISOString(),
        metadata: {
          note: newNote.trim(),
          created_by: user?.id || null
        }
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Notes — {studentName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add note */}
          <div className="flex gap-2">
            <Textarea
              placeholder="Add a note about this student..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={2}
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAddNote();
              }}
            />
            <Button
              size="sm"
              onClick={handleAddNote}
              disabled={submitting || !newNote.trim()}
              className="self-end"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>

          {/* Notes list */}
          <ScrollArea className="max-h-[350px]">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : notes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No notes yet.</p>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div key={note.id} className={`rounded-lg border p-3 space-y-1 ${note.type === 'suspension' ? 'border-red-200 bg-red-50' : note.type === 'fee_extension' ? 'border-amber-200 bg-amber-50' : ''}`}>
                    {note.type === 'suspension' && (
                      <div className="flex items-center gap-1.5 text-xs font-medium text-red-600 mb-1">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Suspension
                      </div>
                    )}
                    {note.type === 'fee_extension' && (
                      <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 mb-1">
                        <CalendarClock className="w-3.5 h-3.5" />
                        Fee Extension
                      </div>
                    )}
                    <p className="text-sm whitespace-pre-wrap">{note.note}</p>
                    {note.type === 'fee_extension' && (note.previousDueDate || note.newDueDate) && (
                      <p className="text-xs text-amber-700">
                        {note.previousDueDate && <span className="line-through opacity-70">{format(new Date(note.previousDueDate), 'MMM d, yyyy')}</span>}
                        {note.previousDueDate && note.newDueDate && ' → '}
                        {note.newDueDate && <span className="font-medium">{format(new Date(note.newDueDate), 'MMM d, yyyy')}</span>}
                      </p>
                    )}
                    {note.autoUnsuspendDate && (
                      <p className="text-xs text-red-500">Auto-unsuspend: {format(new Date(note.autoUnsuspendDate), 'MMM d, yyyy')}</p>
                    )}
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{note.created_by_name}</span>
                      <span>{format(new Date(note.created_at), 'MMM d, yyyy h:mm a')}</span>
                    </div>
                  </div>

                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
