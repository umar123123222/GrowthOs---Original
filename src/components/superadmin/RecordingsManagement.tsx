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
import { Plus, Edit, Trash2, Video, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RecordingRatingDetails } from './RecordingRatingDetails';

interface Recording {
  id: string;
  recording_title: string;
  recording_url: string;
  duration_min: number;
  sequence_order: number;
  notes: string;
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

export function RecordingsManagement() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecording, setEditingRecording] = useState<Recording | null>(null);
  const [expandedRecordings, setExpandedRecordings] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    recording_title: '',
    recording_url: '',
    duration_min: 0,
    sequence_order: 0,
    notes: '',
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
      console.log('Fetching recordings...');
      const { data, error } = await supabase
        .from('available_lessons')
        .select(`
          *,
          module:modules(id, title)
        `)
        .order('sequence_order');

      if (error) {
        console.error('Error fetching recordings:', error);
        throw error;
      }
      
      console.log('Recordings fetched:', data);
      setRecordings(data || []);
    } catch (error) {
      console.error('Failed to fetch recordings:', error);
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
      console.error('Error fetching modules:', error);
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
      console.error('Error fetching assignments:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('Form submission started with data:', formData);
    
    try {
      const recordingData = {
        recording_title: formData.recording_title,
        recording_url: formData.recording_url,
        duration_min: formData.duration_min || null,
        sequence_order: formData.sequence_order || null,
        notes: formData.notes || null,
        module: formData.module_id || null,
        assignment_id: formData.assignment_id || null
      };

      console.log('Prepared recording data:', recordingData);

      if (editingRecording) {
        console.log('Updating recording with ID:', editingRecording.id);
        const { error } = await supabase
          .from('available_lessons')
          .update(recordingData)
          .eq('id', editingRecording.id);

        if (error) {
          console.error('Update error:', error);
          throw error;
        }

        toast({
          title: "Success",
          description: "Recording updated successfully"
        });
      } else {
        console.log('Creating new recording...');
        const { error } = await supabase
          .from('available_lessons')
          .insert(recordingData);

        if (error) {
          console.error('Insert error:', error);
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
        module_id: '',
        assignment_id: ''
      });
      
      // Refresh recordings
      await fetchRecordings();
    } catch (error) {
      console.error('Error saving recording:', error);
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
      console.log('Deleting recording with ID:', recordingId);
      const { error } = await supabase
        .from('available_lessons')
        .delete()
        .eq('id', recordingId);

      if (error) {
        console.error('Delete error:', error);
        throw error;
      }

      toast({
        title: "Success",
        description: "Recording deleted successfully"
      });
      
      await fetchRecordings();
    } catch (error) {
      console.error('Error deleting recording:', error);
      toast({
        title: "Error",
        description: "Failed to delete recording",
        variant: "destructive"
      });
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
                <label className="text-sm font-medium text-foreground">Title</label>
                <Input
                  value={formData.recording_title}
                  onChange={(e) => setFormData({ ...formData, recording_title: e.target.value })}
                  placeholder="Enter recording title"
                  className="transition-all duration-200 focus:scale-[1.02]"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Video URL</label>
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
                  <label className="text-sm font-medium text-foreground">Duration (minutes)</label>
                  <Input
                    type="number"
                    value={formData.duration_min}
                    onChange={(e) => setFormData({ ...formData, duration_min: parseInt(e.target.value) || 0 })}
                    placeholder="Duration"
                    className="transition-all duration-200 focus:scale-[1.02]"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Sequence Order</label>
                  <Input
                    type="number"
                    value={formData.sequence_order}
                    onChange={(e) => setFormData({ ...formData, sequence_order: parseInt(e.target.value) || 0 })}
                    placeholder="Order"
                    className="transition-all duration-200 focus:scale-[1.02]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Module</label>
                <Select
                  value={formData.module_id}
                  onValueChange={(value) => setFormData({ ...formData, module_id: value })}
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
                <label className="text-sm font-medium text-foreground">Notes</label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes or instructions"
                  className="transition-all duration-200 focus:scale-[1.02] min-h-[100px]"
                />
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
              <div className="grid grid-cols-[24px_1fr_220px_100px_80px_120px] items-center gap-4 p-4 bg-gray-50 border-b font-semibold text-sm">
                <div></div>
                <div>Title</div>
                <div className="text-center">Module</div>
                <div className="text-center">Duration</div>
                <div className="text-center">Order</div>
                <div className="text-center">Actions</div>
              </div>
              
              {/* Body */}
              <div className="divide-y">
                {recordings.map((recording, index) => (
                  <Collapsible
                    key={recording.id}
                    open={expandedRecordings.has(recording.id)}
                    onOpenChange={() => toggleRecordingExpansion(recording.id)}
                  >
                    {/* Main Row */}
                    <div 
                      className="grid grid-cols-[24px_1fr_220px_100px_80px_120px] items-center gap-4 p-4 hover:bg-gray-50 transition-colors animate-fade-in"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <div className="flex justify-center">
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-6 h-6 p-0"
                            aria-label={`${expandedRecordings.has(recording.id) ? 'Collapse' : 'Expand'} details for ${recording.recording_title}`}
                          >
                            <ChevronDown 
                              className={`w-4 h-4 transition-transform duration-200 ${
                                expandedRecordings.has(recording.id) ? 'rotate-180' : ''
                              }`} 
                            />
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                      
                      <div className="font-medium truncate">
                        {recording.recording_title}
                      </div>
                      
                      <div className="flex justify-center">
                        <Badge variant="outline" className="bg-purple-100 text-purple-800">
                          {recording.module?.title || 'No Module'}
                        </Badge>
                      </div>
                      
                      <div className="flex justify-center">
                        <Badge variant="secondary">{recording.duration_min} min</Badge>
                      </div>
                      
                      <div className="flex justify-center">
                        <Badge variant="outline">{recording.sequence_order}</Badge>
                      </div>
                      
                      <div className="flex justify-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(recording)}
                          className="hover-scale hover:bg-blue-50 hover:border-blue-300"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {/* Expanded Content */}
                    <CollapsibleContent>
                      <div className="border-t">
                        <RecordingRatingDetails
                          recordingId={recording.id}
                          recordingTitle={recording.recording_title}
                          onDelete={() => handleRecordingDeleted(recording.id)}
                        />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
