import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Video } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Recording {
  id: string;
  recording_title: string;
  recording_url: string;
  duration_min: number;
  sequence_order: number;
  notes: string;
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
  assignment_id: string;
  assignment_title: string;
}

export function RecordingsManagement() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecording, setEditingRecording] = useState<Recording | null>(null);
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
      const { data, error } = await supabase
        .from('available_lessons')
        .select(`
          *,
          module:modules(id, title)
        `)
        .order('sequence_order');

      if (error) throw error;
      setRecordings(data || []);
    } catch (error) {
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
        .from('assignment')
        .select('assignment_id, assignment_title')
        .order('sequence_order');

      if (error) throw error;
      setAssignments(data || []);
    } catch (error) {
      console.error('Error fetching assignments:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingRecording) {
        const { error } = await supabase
          .from('available_lessons')
          .update({
            recording_title: formData.recording_title,
            recording_url: formData.recording_url,
            duration_min: formData.duration_min,
            sequence_order: formData.sequence_order,
            notes: formData.notes,
            module: formData.module_id,
            assignment_id: formData.assignment_id
          })
          .eq('id', editingRecording.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Recording updated successfully"
        });
      } else {
        const { error } = await supabase
          .from('available_lessons')
          .insert({
            recording_title: formData.recording_title,
            recording_url: formData.recording_url,
            duration_min: formData.duration_min,
            sequence_order: formData.sequence_order,
            notes: formData.notes,
            module: formData.module_id,
            assignment_id: formData.assignment_id
          });

        if (error) throw error;

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
      fetchRecordings();
    } catch (error) {
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
      assignment_id: ''
    });
    setDialogOpen(true);
  };

  const handleDelete = async (recordingId: string) => {
    if (!confirm('Are you sure you want to delete this recording?')) return;

    try {
      const { error } = await supabase
        .from('available_lessons')
        .delete()
        .eq('id', recordingId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Recording deleted successfully"
      });
      fetchRecordings();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete recording",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Recordings Management</h2>
          <p className="text-muted-foreground">Manage video recordings and their assignments</p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
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
            }}>
              <Plus className="w-4 h-4 mr-2" />
              Add Recording
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingRecording ? 'Edit Recording' : 'Add New Recording'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Title</label>
                <Input
                  value={formData.recording_title}
                  onChange={(e) => setFormData({ ...formData, recording_title: e.target.value })}
                  required
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Video URL</label>
                <Input
                  value={formData.recording_url}
                  onChange={(e) => setFormData({ ...formData, recording_url: e.target.value })}
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Duration (minutes)</label>
                  <Input
                    type="number"
                    value={formData.duration_min}
                    onChange={(e) => setFormData({ ...formData, duration_min: parseInt(e.target.value) })}
                    required
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium">Sequence Order</label>
                  <Input
                    type="number"
                    value={formData.sequence_order}
                    onChange={(e) => setFormData({ ...formData, sequence_order: parseInt(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Module</label>
                <Select
                  value={formData.module_id}
                  onValueChange={(value) => setFormData({ ...formData, module_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a module" />
                  </SelectTrigger>
                  <SelectContent>
                    {modules.map((module) => (
                      <SelectItem key={module.id} value={module.id}>
                        {module.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Assignment to Unlock After Watching</label>
                <Select
                  value={formData.assignment_id}
                  onValueChange={(value) => setFormData({ ...formData, assignment_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an assignment" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignments.map((assignment) => (
                      <SelectItem key={assignment.assignment_id} value={assignment.assignment_id}>
                        {assignment.assignment_title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium">Notes</label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingRecording ? 'Update' : 'Create'} Recording
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Video className="w-5 h-5 mr-2" />
            All Recordings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recordings.map((recording) => (
                <TableRow key={recording.id}>
                  <TableCell className="font-medium">{recording.recording_title}</TableCell>
                  <TableCell>{recording.module?.title || 'No Module'}</TableCell>
                  <TableCell>{recording.duration_min} min</TableCell>
                  <TableCell>{recording.sequence_order}</TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(recording)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(recording.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}