import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, Video, Radio, ArrowLeft, BookOpen
} from 'lucide-react';
import { useBatchTimeline, type TimelineItem, type TimelineItemFormData, type TimelineItemType } from '@/hooks/useBatchTimeline';
import { useBatches } from '@/hooks/useBatches';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, addDays } from 'date-fns';
import { ImportCourseDialog } from './timeline/ImportCourseDialog';
import { TimelineGroupedList } from './timeline/TimelineGroupedList';

interface Recording {
  id: string;
  recording_title: string;
  module: string | null;
}

interface Assignment {
  id: string;
  name: string;
}

interface BatchTimelineManagerProps {
  batchId: string;
  onBack?: () => void;
}

export function BatchTimelineManager({ batchId, onBack }: BatchTimelineManagerProps) {
  const { timelineItems, loading, createTimelineItem, updateTimelineItem, deleteTimelineItem } = useBatchTimeline(batchId);
  const { batches } = useBatches();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TimelineItem | null>(null);
  const [formData, setFormData] = useState<TimelineItemFormData>({
    type: 'RECORDING',
    title: '',
    description: '',
    drip_offset_days: 0,
    sequence_order: 0
  });
  const { toast } = useToast();

  const batch = batches.find(b => b.id === batchId);

  useEffect(() => {
    fetchRecordings();
    fetchAssignments();
  }, []);

  const fetchRecordings = async () => {
    const { data } = await supabase
      .from('available_lessons')
      .select('id, recording_title, module')
      .order('sequence_order');
    if (data) setRecordings(data);
  };

  const fetchAssignments = async () => {
    const { data } = await supabase
      .from('assignments')
      .select('id, name')
      .order('name');
    if (data) setAssignments(data);
  };

  const resetForm = () => {
    setFormData({
      type: 'RECORDING',
      title: '',
      description: '',
      drip_offset_days: 0,
      sequence_order: timelineItems.length
    });
    setEditingItem(null);
  };

  const handleOpenDialog = (item?: TimelineItem, type?: TimelineItemType) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        type: item.type,
        title: item.title,
        description: item.description || '',
        drip_offset_days: item.drip_offset_days,
        sequence_order: item.sequence_order,
        recording_id: item.recording_id || undefined,
        start_datetime: item.start_datetime || undefined,
        end_datetime: item.end_datetime || undefined,
        meeting_link: item.meeting_link || undefined,
        zoom_username: item.zoom_username || undefined,
        zoom_password: item.zoom_password || undefined,
        recording_url: item.recording_url || undefined,
        assignment_id: item.assignment_id || undefined
      });
    } else {
      resetForm();
      if (type) setFormData(prev => ({ ...prev, type }));
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await updateTimelineItem(editingItem.id, formData);
      } else {
        await createTimelineItem(formData);
      }
      handleCloseDialog();
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this timeline item?')) return;
    await deleteTimelineItem(itemId);
  };

  const handleImportCourse = async (items: TimelineItemFormData[]) => {
    for (const item of items) {
      await createTimelineItem(item);
    }
  };

  const getDeployDate = (offsetDays: number) => {
    if (!batch?.start_date) return '-';
    return format(addDays(new Date(batch.start_date), offsetDays), 'MMM dd, yyyy');
  };

  const existingRecordingIds = timelineItems
    .filter(item => item.recording_id)
    .map(item => item.recording_id!);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          <div>
            <h2 className="text-2xl font-bold">Timeline Manager</h2>
            <p className="text-muted-foreground">
              {batch?.name} • Starts {batch?.start_date ? format(new Date(batch.start_date), 'MMM dd, yyyy') : '-'}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button onClick={() => setImportDialogOpen(true)} variant="outline">
            <BookOpen className="w-4 h-4 mr-2" />
            Import Course
          </Button>
          <Button onClick={() => handleOpenDialog(undefined, 'RECORDING')} variant="outline">
            <Video className="w-4 h-4 mr-2" />
            Add Recording
          </Button>
          <Button onClick={() => handleOpenDialog(undefined, 'LIVE_SESSION')}>
            <Radio className="w-4 h-4 mr-2" />
            Add Live Session
          </Button>
        </div>
      </div>

      {/* Grouped Timeline List */}
      <TimelineGroupedList
        timelineItems={timelineItems}
        batchStartDate={batch?.start_date}
        onEdit={(item) => handleOpenDialog(item)}
        onDelete={handleDelete}
      />

      {/* Import Course Dialog */}
      <ImportCourseDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImport={handleImportCourse}
        existingRecordingIds={existingRecordingIds}
        currentItemCount={timelineItems.length}
        timelineItems={timelineItems}
      />

      {/* Add/Edit Item Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Edit Timeline Item' : `Add ${formData.type === 'RECORDING' ? 'Recording' : 'Live Session'}`}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <Tabs value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v as TimelineItemType })}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="RECORDING">
                  <Video className="w-4 h-4 mr-2" />
                  Recording
                </TabsTrigger>
                <TabsTrigger value="LIVE_SESSION">
                  <Radio className="w-4 h-4 mr-2" />
                  Live Session
                </TabsTrigger>
              </TabsList>

              <div className="pt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Title *</label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Enter title"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Enter description"
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Drip Offset (Days) *</label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.drip_offset_days}
                      onChange={(e) => setFormData({ ...formData, drip_offset_days: parseInt(e.target.value) || 0 })}
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Deploys on: {getDeployDate(formData.drip_offset_days)}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Sequence Order</label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.sequence_order}
                      onChange={(e) => setFormData({ ...formData, sequence_order: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <TabsContent value="RECORDING" className="space-y-4 mt-0">
                  <div>
                    <label className="block text-sm font-medium mb-1">Select Recording</label>
                    <Select
                      value={formData.recording_id}
                      onValueChange={(value) => {
                        const recording = recordings.find(r => r.id === value);
                        setFormData({ 
                          ...formData, 
                          recording_id: value,
                          title: recording?.recording_title || formData.title
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a recording" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border z-50 max-h-60">
                        {recordings.map((recording) => (
                          <SelectItem key={recording.id} value={recording.id}>
                            {recording.recording_title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Gate with Assignment</label>
                    <Select
                      value={formData.assignment_id || "none"}
                      onValueChange={(value) => setFormData({ ...formData, assignment_id: value === "none" ? undefined : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="No assignment gating" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border z-50 max-h-60">
                        <SelectItem value="none">No assignment gating</SelectItem>
                        {assignments.map((assignment) => (
                          <SelectItem key={assignment.id} value={assignment.id}>
                            {assignment.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Students must get this assignment approved to unlock the next recording
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="LIVE_SESSION" className="space-y-4 mt-0">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Start Date & Time *</label>
                      <Input
                        type="datetime-local"
                        value={formData.start_datetime?.slice(0, 16) || ''}
                        onChange={(e) => setFormData({ ...formData, start_datetime: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">End Date & Time</label>
                      <Input
                        type="datetime-local"
                        value={formData.end_datetime?.slice(0, 16) || ''}
                        onChange={(e) => setFormData({ ...formData, end_datetime: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Meeting Link *</label>
                    <Input
                      type="url"
                      value={formData.meeting_link || ''}
                      onChange={(e) => setFormData({ ...formData, meeting_link: e.target.value })}
                      placeholder="https://zoom.us/j/..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Zoom Username (Admin Only)</label>
                      <Input
                        value={formData.zoom_username || ''}
                        onChange={(e) => setFormData({ ...formData, zoom_username: e.target.value })}
                        placeholder="host@email.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Zoom Password (Admin Only)</label>
                      <Input
                        type="password"
                        value={formData.zoom_password || ''}
                        onChange={(e) => setFormData({ ...formData, zoom_password: e.target.value })}
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Session Recording URL (Post-Session)</label>
                    <Input
                      type="url"
                      value={formData.recording_url || ''}
                      onChange={(e) => setFormData({ ...formData, recording_url: e.target.value })}
                      placeholder="https://..."
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Add after session ends. Students will see "Watch Now" button.
                    </p>
                  </div>
                </TabsContent>
              </div>
            </Tabs>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button type="submit">
                {editingItem ? 'Update' : 'Add to Timeline'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
