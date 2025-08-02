import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface Assignment {
  id: string;
  name: string;
  description: string;
  mentor_id?: string;
  created_at: string;
  due_days?: number;
  recording_id?: string;
  submission_type?: 'text' | 'file' | 'link';
  instructions?: string;
  mentor?: {
    full_name: string;
  };
  recording?: {
    recording_title: string;
  };
}

interface Mentor {
  id: string;
  full_name: string;
  email: string;
}

interface Recording {
  id: string;
  recording_title: string;
  sequence_order?: number;
}

export function AssignmentManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    mentor_id: '',
    due_days: 7,
    recording_id: '',
    submission_type: 'text' as 'text' | 'file' | 'link',
    instructions: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch assignments with recording details
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('assignments')
        .select(`
          *,
          mentor:users!assignments_mentor_id_fkey(full_name),
          recording:available_lessons!assignments_recording_id_fkey(recording_title)
        `)
        .order('created_at', { ascending: false });

      if (assignmentsError) throw assignmentsError;

      // Fetch mentors
      const { data: mentorsData, error: mentorsError } = await supabase
        .from('users')
        .select('id, full_name, email')
        .eq('role', 'mentor')
        .order('full_name');

      if (mentorsError) throw mentorsError;

      // Fetch recordings
      const { data: recordingsData, error: recordingsError } = await supabase
        .from('available_lessons')
        .select('id, recording_title, sequence_order')
        .order('sequence_order');

      if (recordingsError) throw recordingsError;

      setAssignments((assignmentsData || []).map(assignment => ({
        ...assignment,
        submission_type: (assignment.submission_type as 'text' | 'file' | 'link') || 'text'
      })));
      setMentors(mentorsData || []);
      setRecordings(recordingsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch assignments data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: 'Error',
        description: 'Assignment name is required',
        variant: 'destructive'
      });
      return;
    }

    try {
      const assignmentData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        mentor_id: formData.mentor_id || null,
        due_days: formData.due_days,
        recording_id: formData.recording_id || null,
        submission_type: formData.submission_type,
        instructions: formData.instructions.trim() || null
      };

      if (editingAssignment) {
        // Update existing assignment
        const { error } = await supabase
          .from('assignments')
          .update(assignmentData)
          .eq('id', editingAssignment.id);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Assignment updated successfully'
        });
      } else {
        // Create new assignment
        const { error } = await supabase
          .from('assignments')
          .insert(assignmentData);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Assignment created successfully'
        });
      }

      setIsDialogOpen(false);
      setEditingAssignment(null);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving assignment:', error);
      toast({
        title: 'Error',
        description: 'Failed to save assignment',
        variant: 'destructive'
      });
    }
  };

  const handleEdit = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    setFormData({
      name: assignment.name,
      description: assignment.description || '',
      mentor_id: assignment.mentor_id || '',
      due_days: assignment.due_days || 7,
      recording_id: assignment.recording_id || '',
      submission_type: assignment.submission_type || 'text',
      instructions: assignment.instructions || ''
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this assignment? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('assignments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Assignment deleted successfully'
      });

      fetchData();
    } catch (error) {
      console.error('Error deleting assignment:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete assignment',
        variant: 'destructive'
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      mentor_id: '',
      due_days: 7,
      recording_id: '',
      submission_type: 'text',
      instructions: ''
    });
  };

  const openCreateDialog = () => {
    setEditingAssignment(null);
    resetForm();
    setIsDialogOpen(true);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading assignments...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Assignment Management</h1>
          <p className="text-muted-foreground">Create and manage course assignments</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Create Assignment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingAssignment ? 'Edit Assignment' : 'Create New Assignment'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-2">Assignment Name</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter assignment name..."
                    required
                  />
                </div>
                
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Enter assignment description..."
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Due After (Days)</label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.due_days}
                    onChange={(e) => setFormData({ ...formData, due_days: parseInt(e.target.value) || 7 })}
                    placeholder="7"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Submission Type</label>
                  <Select value={formData.submission_type} onValueChange={(value: 'text' | 'file' | 'link') => setFormData({ ...formData, submission_type: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select submission type..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text Response</SelectItem>
                      <SelectItem value="file">File Upload</SelectItem>
                      <SelectItem value="link">Link Submission</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Unlocked After Recording</label>
                  <Select value={formData.recording_id} onValueChange={(value) => setFormData({ ...formData, recording_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select recording..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Available immediately</SelectItem>
                      {recordings.map((recording) => (
                        <SelectItem key={recording.id} value={recording.id}>
                          {recording.recording_title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Assigned Mentor (Optional)</label>
                  <Select value={formData.mentor_id} onValueChange={(value) => setFormData({ ...formData, mentor_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a mentor..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No mentor assigned</SelectItem>
                      {mentors.map((mentor) => (
                        <SelectItem key={mentor.id} value={mentor.id}>
                          {mentor.full_name} ({mentor.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-2">Instructions</label>
                  <Textarea
                    value={formData.instructions}
                    onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                    placeholder="Enter detailed instructions for students..."
                    rows={4}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" className="flex-1">
                  {editingAssignment ? 'Update' : 'Create'} Assignment
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <div className="text-center py-8">
              <h3 className="text-lg font-medium">No assignments found</h3>
              <p className="text-muted-foreground">Create your first assignment to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Recording</TableHead>
                  <TableHead>Due Days</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Mentor</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell className="font-medium">{assignment.name}</TableCell>
                    <TableCell>
                      {assignment.recording?.recording_title || 'Available immediately'}
                    </TableCell>
                    <TableCell>{assignment.due_days || 7} days</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {assignment.submission_type || 'text'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {assignment.mentor?.full_name || 'No mentor assigned'}
                    </TableCell>
                    <TableCell>
                      {new Date(assignment.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(assignment)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(assignment.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}