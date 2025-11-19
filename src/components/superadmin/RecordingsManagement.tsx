import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Edit, Trash2, Video, ChevronDown, RefreshCw, GripVertical } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RecordingRatingDetails } from './RecordingRatingDetails';
import { RecordingAttachmentsManager } from './RecordingAttachmentsManager';
import { safeLogger } from '@/lib/safe-logger';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Recording {
  id: string;
  recording_title: string;
  recording_url: string;
  duration_min: number;
  sequence_order: number;
  notes: string;
  description?: string | null;
  assignment_id: string | null;
  module: {
    id: string;
    title: string;
  };
}

interface Module {
  id: string;
  title: string;
}

interface Assignment {
  id: string;
  name: string;
}

// Sortable Recording Row Component
function SortableRecordingRow({ 
  recording, 
  index, 
  isExpanded, 
  onToggleExpand, 
  onEdit, 
  onDelete,
  onRefresh
}: {
  recording: Recording;
  index: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: (recording: Recording) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: recording.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
      <div 
        ref={setNodeRef}
        style={style}
        className="grid grid-cols-[24px_24px_1fr_220px_100px_80px_120px] items-center gap-4 p-4 hover:bg-gray-50 transition-colors animate-fade-in"
      >
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing hover:text-primary transition-colors flex justify-center"
        >
          <GripVertical className="w-5 h-5" />
        </div>
        <div className="flex justify-center">
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="p-0 h-6 w-6 hover:bg-transparent"
            >
              <ChevronDown className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
        </div>
        <div className="font-medium truncate">{recording.recording_title}</div>
        <div className="text-center">
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
            {recording.module?.title || 'Unassigned'}
          </Badge>
        </div>
        <div className="text-center text-sm text-muted-foreground">
          {recording.duration_min} min
        </div>
        <div className="text-center">
          <Badge variant="outline">{recording.sequence_order || 0}</Badge>
        </div>
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(recording)}
            className="hover-scale hover:bg-blue-50 hover:border-blue-300"
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(recording.id)}
            className="hover-scale hover:bg-red-50 hover:border-red-300"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      <CollapsibleContent>
        <div className="px-4 pb-4 space-y-4 bg-gray-50/50">
          {recording.description && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Description:</p>
              <p className="text-sm text-gray-600">{recording.description}</p>
            </div>
          )}
          {recording.notes && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Notes:</p>
              <p className="text-sm text-gray-600">{recording.notes}</p>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">Video URL:</p>
            <a 
              href={recording.recording_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline break-all"
            >
              {recording.recording_url}
            </a>
          </div>
          <div className="pt-2">
            <RecordingRatingDetails 
              recordingId={recording.id} 
              recordingTitle={recording.recording_title}
              onDelete={onRefresh}
            />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function RecordingsManagement() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingUnlocks, setSyncingUnlocks] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecording, setEditingRecording] = useState<Recording | null>(null);
  const [expandedRecordings, setExpandedRecordings] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    recording_title: '',
    recording_url: '',
    duration_min: 0,
    sequence_order: 0,
    notes: '',
    description: '',
    module_id: '',
    assignment_id: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchRecordings();
    fetchModules();
    fetchAssignments();
  }, []);

  const fetchRecordings = async () => {
    try {
      safeLogger.info('Fetching recordings...');
      const { data, error } = await supabase
        .from('available_lessons')
        .select(`
          *,
          module:modules(id, title)
        `)
        .order('sequence_order');

      if (error) {
        safeLogger.error('Error fetching recordings:', error);
        throw error;
      }
      
      safeLogger.info('Recordings fetched:', { data });
      setRecordings(data || []);
    } catch (error) {
      safeLogger.error('Failed to fetch recordings:', error);
      toast({
        title: "Error",
        description: "Failed to fetch recordings",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchModules = async () => {
    try {
      const { data, error } = await supabase
        .from('modules')
        .select('id, title')
        .order('order');

      if (error) throw error;
      setModules(data || []);
    } catch (error) {
      safeLogger.error('Error fetching modules:', error);
    }
  };

  const fetchAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from('assignments')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setAssignments(data || []);
    } catch (error) {
      safeLogger.error('Error fetching assignments:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    safeLogger.info('Form submission started with data:', { formData });
    
    try {
      const recordingData = {
        recording_title: formData.recording_title,
        recording_url: formData.recording_url,
        duration_min: formData.duration_min || null,
        sequence_order: formData.sequence_order || null,
        notes: formData.notes || null,
        description: formData.description || null,
        module: formData.module_id || null,
        assignment_id: formData.assignment_id || null
      };

      safeLogger.info('Prepared recording data:', { recordingData });

      if (editingRecording) {
        safeLogger.info('Updating recording with ID:', { recordingId: editingRecording.id });
        const { error } = await supabase
          .from('available_lessons')
          .update(recordingData)
          .eq('id', editingRecording.id);

        if (error) {
          safeLogger.error('Update error:', error);
          throw error;
        }

        toast({
          title: "Success",
          description: "Recording updated successfully"
        });
      } else {
        safeLogger.info('Creating new recording...');
        const { error } = await supabase
          .from('available_lessons')
          .insert(recordingData);

        if (error) {
          safeLogger.error('Insert error:', error);
          throw error;
        }

        toast({
          title: "Success",
          description: "Recording created successfully"
        });
      }

      setDialogOpen(false);
      setEditingRecording(null);
      setFormData({
        recording_title: '',
        recording_url: '',
        duration_min: 0,
        sequence_order: 0,
        notes: '',
        description: '',
        module_id: '',
        assignment_id: ''
      });
      
      // Refresh recordings
      await fetchRecordings();
    } catch (error) {
      safeLogger.error('Error saving recording:', error);
      toast({
        title: "Error",
        description: "Failed to save recording",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (recording: Recording) => {
    setEditingRecording(recording);
    setFormData({
      recording_title: recording.recording_title,
      recording_url: recording.recording_url,
      duration_min: recording.duration_min,
      sequence_order: recording.sequence_order,
      notes: recording.notes,
      description: recording.description || '',
      module_id: recording.module?.id || '',
      assignment_id: recording.assignment_id || ''
    });
    setDialogOpen(true);
  };

  const toggleRecordingExpansion = (recordingId: string) => {
    setExpandedRecordings(prev => {
      const newSet = new Set(prev);
      if (newSet.has(recordingId)) {
        newSet.delete(recordingId);
      } else {
        newSet.add(recordingId);
      }
      return newSet;
    });
  };

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle recording reordering
  const handleRecordingDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = recordings.findIndex((r) => r.id === active.id);
    const newIndex = recordings.findIndex((r) => r.id === over.id);

    const newRecordings = arrayMove(recordings, oldIndex, newIndex);
    
    // Update order numbers sequentially
    const updatedRecordings = newRecordings.map((recording, index) => ({
      ...recording,
      sequence_order: index + 1
    }));
    
    // Update UI immediately
    setRecordings(updatedRecordings);

    // Update order in database
    try {
      const updates = updatedRecordings.map((recording, index) => ({
        id: recording.id,
        sequence_order: index + 1
      }));

      for (const update of updates) {
        await supabase
          .from('available_lessons')
          .update({ sequence_order: update.sequence_order })
          .eq('id', update.id);
      }

      toast({
        title: "Success",
        description: "Recording order updated"
      });
    } catch (error) {
      safeLogger.error('Error updating recording order:', error);
      toast({
        title: "Error",
        description: "Failed to update recording order",
        variant: "destructive"
      });
      // Revert on error
      fetchRecordings();
    }
  };

  const handleRecordingDeleted = (recordingId: string) => {
    setRecordings(prev => prev.filter(r => r.id !== recordingId));
    setExpandedRecordings(prev => {
      const newSet = new Set(prev);
      newSet.delete(recordingId);
      return newSet;
    });
  };

  const handleDelete = async (recordingId: string) => {
    if (!confirm('Are you sure you want to delete this recording?')) return;

    try {
      safeLogger.info('Deleting recording with ID:', { recordingId });
      const { error } = await supabase
        .from('available_lessons')
        .delete()
        .eq('id', recordingId);

      if (error) {
        safeLogger.error('Delete error:', error);
        throw error;
      }

      toast({
        title: "Success",
        description: "Recording deleted successfully"
      });
      
      await fetchRecordings();
    } catch (error) {
      safeLogger.error('Error deleting recording:', error);
      toast({
        title: "Error",
        description: "Failed to delete recording",
        variant: "destructive"
      });
    }
  };

  const handleSyncAllUsersUnlocks = async () => {
    setSyncingUnlocks(true);
    try {
      const { data, error } = await supabase.rpc('sync_all_users_unlock_progress');
      
      if (error) throw error;
      
      toast({
        title: "Success",
        description: data || "Synced unlock progress for all users"
      });
    } catch (error) {
      safeLogger.error('Error syncing user unlocks:', error);
      toast({
        title: "Error",
        description: "Failed to sync user unlock progress",
        variant: "destructive"
      });
    } finally {
      setSyncingUnlocks(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading recordings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center">
        <div className="animate-fade-in">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            Recordings Management
          </h2>
          <p className="text-muted-foreground mt-1 text-lg">Manage video recordings and their assignments</p>
        </div>
        <div className="flex gap-3">
          <Button 
            onClick={handleSyncAllUsersUnlocks}
            disabled={syncingUnlocks}
            variant="outline"
            className="hover-scale bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white hover:text-white border-0"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncingUnlocks ? 'animate-spin' : ''}`} />
            {syncingUnlocks ? 'Syncing...' : 'Sync All User Unlocks'}
          </Button>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                onClick={() => {
                  setEditingRecording(null);
                  setFormData({
                    recording_title: '',
                    recording_url: '',
                    duration_min: 0,
                    sequence_order: 0,
                    notes: '',
                    description: '',
                    module_id: '',
                    assignment_id: ''
                  });
                }}
                className="hover-scale bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Recording
              </Button>
            </DialogTrigger>
          <DialogContent className="w-[95vw] sm:max-w-4xl h-[85vh] sm:h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">
                {editingRecording ? 'Edit Recording' : 'Add New Recording'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Title <span className="text-destructive">*</span></label>
                <Input
                  value={formData.recording_title}
                  onChange={(e) => setFormData({ ...formData, recording_title: e.target.value })}
                  placeholder="Enter recording title"
                  className="transition-all duration-200 focus:scale-[1.02]"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Video URL <span className="text-destructive">*</span></label>
                <Input
                  value={formData.recording_url}
                  onChange={(e) => setFormData({ ...formData, recording_url: e.target.value })}
                  placeholder="Enter video URL"
                  className="transition-all duration-200 focus:scale-[1.02]"
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Duration (minutes) <span className="text-destructive">*</span></label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={formData.duration_min}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 0;
                      setFormData({ ...formData, duration_min: Math.max(0, value) });
                    }}
                    placeholder="Duration"
                    className="transition-all duration-200 focus:scale-[1.02]"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Overall Sequence <span className="text-destructive">*</span></label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={formData.sequence_order}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 0;
                      setFormData({ ...formData, sequence_order: Math.max(0, value) });
                    }}
                    placeholder="Order"
                    className="transition-all duration-200 focus:scale-[1.02]"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Module <span className="text-destructive">*</span></label>
                <Select
                  value={formData.module_id}
                  onValueChange={(value) => setFormData({ ...formData, module_id: value })}
                  required
                >
                  <SelectTrigger className="transition-all duration-200 focus:scale-[1.02]">
                    <SelectValue placeholder="Select a module" />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50">
                    {modules.map((module) => (
                      <SelectItem key={module.id} value={module.id}>
                        {module.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Assignment to Unlock After Watching</label>
                <Select
                  value={formData.assignment_id}
                  onValueChange={(value) => setFormData({ ...formData, assignment_id: value })}
                >
                  <SelectTrigger className="transition-all duration-200 focus:scale-[1.02]">
                    <SelectValue placeholder="Select an assignment" />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50">
                    {assignments.map((assignment) => (
                      <SelectItem key={assignment.id} value={assignment.id}>
                        {assignment.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Description</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detailed description of this recording (visible to students)"
                  className="transition-all duration-200 focus:scale-[1.02] min-h-[160px]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Notes</label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Internal notes or instructions (optional)"
                  className="transition-all duration-200 focus:scale-[1.02] min-h-[100px]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Attachments</label>
                {editingRecording?.id ? (
                  <RecordingAttachmentsManager recordingId={editingRecording.id} />
                ) : (
                  <p className="text-sm text-muted-foreground">Save the recording first to upload attachments.</p>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setDialogOpen(false)}
                  className="hover-scale"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  className="hover-scale bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600"
                >
                  {editingRecording ? 'Update' : 'Create'} Recording
                </Button>
              </div>
            </form>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50 animate-fade-in">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b">
          <CardTitle className="flex items-center text-xl">
            <Video className="w-6 h-6 mr-3 text-purple-600" />
            All Recordings
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recordings.length === 0 ? (
            <div className="text-center py-16 animate-fade-in">
              <Video className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-muted-foreground mb-2">No recordings found</h3>
              <p className="text-muted-foreground">Upload your first recording to get started</p>
            </div>
          ) : (
            <div data-testid="recordings-table" className="w-full">
              {/* Header */}
              <div className="grid grid-cols-[24px_24px_1fr_220px_100px_80px_120px] items-center gap-4 p-4 bg-gray-50 border-b font-semibold text-sm">
                <div></div>
                <div></div>
                <div>Title <span className="text-xs font-normal text-muted-foreground ml-2">Drag to reorder</span></div>
                <div className="text-center">Module</div>
                <div className="text-center">Duration</div>
                <div className="text-center">Order</div>
                <div className="text-center">Actions</div>
              </div>
              
              {/* Body */}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleRecordingDragEnd}
              >
                <div className="divide-y">
                  <SortableContext
                    items={recordings.map(r => r.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {recordings.map((recording, index) => (
                      <SortableRecordingRow
                        key={recording.id}
                        recording={recording}
                        index={index}
                        isExpanded={expandedRecordings.has(recording.id)}
                        onToggleExpand={() => toggleRecordingExpansion(recording.id)}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onRefresh={fetchRecordings}
                      />
                    ))}
                  </SortableContext>
                </div>
              </DndContext>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
