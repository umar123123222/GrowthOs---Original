import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Send, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

interface Note {
  id: string;
  note: string;
  created_at: string;
  created_by_name: string;
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
      const { data, error } = await supabase
        .from('user_activity_logs')
        .select('id, metadata, occurred_at, reference_id')
        .eq('user_id', studentId)
        .eq('activity_type', 'admin_note')
        .order('occurred_at', { ascending: false });

      if (error) throw error;

      // Resolve creator names
      const creatorIds = [...new Set((data || []).map(d => (d.metadata as any)?.created_by).filter(Boolean))];
      let creatorMap: Record<string, string> = {};
      if (creatorIds.length > 0) {
        const { data: creators } = await supabase
          .from('users')
          .select('id, full_name')
          .in('id', creatorIds);
        creatorMap = Object.fromEntries((creators || []).map(c => [c.id, c.full_name]));
      }

      setNotes((data || []).map(d => ({
        id: d.id,
        note: (d.metadata as any)?.note || '',
        created_at: d.occurred_at,
        created_by_name: creatorMap[(d.metadata as any)?.created_by] || 'System'
      })));
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
                  <div key={note.id} className="rounded-lg border p-3 space-y-1">
                    <p className="text-sm whitespace-pre-wrap">{note.note}</p>
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
