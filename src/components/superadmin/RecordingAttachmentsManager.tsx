import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useResources, useResourceSections, getResourceFileSignedUrl, type Resource } from '@/hooks/useResources';
import { Trash2, FolderOpen, File, FileText, Image as ImageIcon, FileArchive, FileAudio, FileVideo, Search } from 'lucide-react';

interface RecordingAttachmentsManagerProps {
  recordingId: string;
}

interface Attachment {
  id: string;
  file_name: string;
  file_url: string | null;
  uploaded_at: string;
  resource_id: string | null;
}

function getIconForFile(name: string) {
  const n = name.toLowerCase();
  if (n.match(/\.(png|jpe?g|gif|webp|svg)$/)) return <ImageIcon className="w-4 h-4" />;
  if (n.match(/\.(pdf)$/)) return <FileText className="w-4 h-4" />;
  if (n.match(/\.(zip|rar|7z)$/)) return <FileArchive className="w-4 h-4" />;
  if (n.match(/\.(mp3|wav|m4a|ogg)$/)) return <FileAudio className="w-4 h-4" />;
  if (n.match(/\.(mp4|mov|webm|mkv)$/)) return <FileVideo className="w-4 h-4" />;
  if (n.match(/\.(docx?|pptx?|xlsx?)$/)) return <FileText className="w-4 h-4" />;
  return <File className="w-4 h-4" />;
}

export function RecordingAttachmentsManager({ recordingId }: RecordingAttachmentsManagerProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { data: resources = [] } = useResources();
  const { data: sections = [] } = useResourceSections();

  const fetchAttachments = async () => {
    const { data, error } = await supabase
      .from('recording_attachments' as any)
      .select('id, file_name, file_url, uploaded_at, resource_id')
      .eq('recording_id', recordingId)
      .order('uploaded_at', { ascending: false }) as any;
    if (error) {
      console.error('Failed to load attachments', error);
      toast({ title: 'Error', description: 'Failed to load attachments', variant: 'destructive' });
      return;
    }
    setAttachments((data as Attachment[]) || []);
  };

  useEffect(() => {
    fetchAttachments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordingId]);

  // Only file-type resources are pickable
  const fileResources = useMemo(
    () => (resources as Resource[]).filter(r => r.content_type === 'file' && r.is_active && r.content?.storage_path),
    [resources]
  );

  const filteredResources = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return fileResources;
    return fileResources.filter(r =>
      r.title.toLowerCase().includes(q) ||
      (r.content?.file_name || '').toLowerCase().includes(q)
    );
  }, [fileResources, search]);

  const sectionsById = useMemo(() => {
    const m: Record<string, string> = {};
    sections.forEach(s => { m[s.id] = s.name; });
    return m;
  }, [sections]);

  const attachedResourceIds = useMemo(
    () => new Set(attachments.map(a => a.resource_id).filter(Boolean) as string[]),
    [attachments]
  );

  const openPicker = () => {
    setSelectedIds(new Set());
    setSearch('');
    setPickerOpen(true);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const onAttachSelected = async () => {
    if (selectedIds.size === 0) return;
    setSaving(true);
    try {
      const rows = Array.from(selectedIds).map(rid => {
        const r = fileResources.find(x => x.id === rid)!;
        return {
          recording_id: recordingId,
          resource_id: rid,
          file_name: r.content?.file_name || r.title,
          file_url: null,
        };
      });
      const { error } = await supabase.from('recording_attachments' as any).insert(rows as any);
      if (error) throw error;
      toast({ title: 'Attached', description: `${rows.length} file(s) attached from Resources` });
      setPickerOpen(false);
      await fetchAttachments();
    } catch (e: any) {
      console.error('Attach failed', e);
      toast({ title: 'Error', description: e?.message || 'Failed to attach files', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const openAttachment = async (att: Attachment) => {
    try {
      if (att.resource_id) {
        const r = fileResources.find(x => x.id === att.resource_id);
        const path = r?.content?.storage_path;
        if (!path) throw new Error('Source resource no longer available');
        const url = await getResourceFileSignedUrl(path);
        window.open(url, '_blank', 'noopener,noreferrer');
      } else if (att.file_url) {
        window.open(att.file_url, '_blank', 'noopener,noreferrer');
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to open file', variant: 'destructive' });
    }
  };

  const deleteAttachment = async (att: Attachment) => {
    if (!confirm('Remove this attachment from the recording?')) return;
    try {
      const { error } = await supabase.from('recording_attachments' as any).delete().eq('id', att.id);
      if (error) throw error;
      setAttachments((prev) => prev.filter((a) => a.id !== att.id));
      toast({ title: 'Removed', description: 'Attachment removed' });
    } catch (e: any) {
      console.error('Delete failed', e);
      toast({ title: 'Error', description: 'Failed to remove attachment', variant: 'destructive' });
    }
  };

  return (
    <div className="rounded-md border bg-card p-4 space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Attach files from the Resources library to this recording.
        </p>
        <Button type="button" onClick={openPicker} className="hover-scale">
          <FolderOpen className="w-4 h-4 mr-2" /> Select from Resources
        </Button>
      </div>

      {attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No attachments yet.</p>
      ) : (
        <ul className="divide-y">
          {attachments.map((att) => (
            <li key={att.id} className="py-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="shrink-0 text-muted-foreground">{getIconForFile(att.file_name)}</span>
                <button
                  type="button"
                  onClick={() => openAttachment(att)}
                  className="truncate hover:underline text-left"
                  title={att.file_name}
                >
                  {att.file_name}
                </button>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => deleteAttachment(att)} className="hover-scale">
                <Trash2 className="w-4 h-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Select files from Resources</DialogTitle>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search resources by title or file name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-[360px] rounded-md border">
            {filteredResources.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground text-center">
                No file resources found. Upload files in the Resources section first.
              </p>
            ) : (
              <ul className="divide-y">
                {filteredResources.map((r) => {
                  const already = attachedResourceIds.has(r.id);
                  const checked = selectedIds.has(r.id);
                  return (
                    <li key={r.id} className="flex items-center gap-3 p-3">
                      <Checkbox
                        checked={checked}
                        disabled={already}
                        onCheckedChange={() => toggleSelect(r.id)}
                      />
                      <span className="shrink-0 text-muted-foreground">
                        {getIconForFile(r.content?.file_name || r.title)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-sm">{r.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {sectionsById[r.section_id] || 'Resource'}
                          {r.content?.file_name ? ` • ${r.content.file_name}` : ''}
                          {already ? ' • Already attached' : ''}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPickerOpen(false)} disabled={saving}>Cancel</Button>
            <Button type="button" onClick={onAttachSelected} disabled={saving || selectedIds.size === 0}>
              Attach {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
