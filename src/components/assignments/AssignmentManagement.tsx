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
import { Plus, Edit, Trash2, FileText, MessageSquare, Play, Clock } from 'lucide-react';
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto p-6">
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full mr-4">
              <FileText className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Assignment Management
            </h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-3xl mx-auto">
            Create and manage course assignments to guide student learning and track progress
          </p>
        </div>
        
        <div className="space-y-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                <Plus className="w-4 h-4 text-primary" />
              </div>
              <h2 className="text-2xl font-semibold">Assignment Controls</h2>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreateDialog} className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl transition-all">
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Assignment
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader className="pb-4">
                  <DialogTitle className="text-2xl font-bold flex items-center space-x-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                      <FileText className="w-4 h-4 text-primary" />
                    </div>
                    <span>{editingAssignment ? 'Edit Assignment' : 'Create New Assignment'}</span>
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="col-span-2 bg-muted/30 rounded-xl p-5">
                      <label className="block text-sm font-semibold mb-3 flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-primary" />
                        <span>Assignment Name</span>
                      </label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Enter assignment name..."
                        required
                        className="border-2 bg-background/50 focus:bg-background transition-colors"
                      />
                    </div>
                
                    <div className="col-span-2 bg-muted/30 rounded-xl p-5">
                      <label className="block text-sm font-semibold mb-3 flex items-center space-x-2">
                        <MessageSquare className="w-4 h-4 text-primary" />
                        <span>Description</span>
                      </label>
                      <Textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Enter assignment description..."
                        rows={3}
                        className="border-2 bg-background/50 focus:bg-background transition-colors"
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

                  <div className="flex gap-4 pt-6">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1 border-2">
                      Cancel
                    </Button>
                    <Button type="submit" className="flex-1 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-md hover:shadow-lg transition-all">
                      {editingAssignment ? 'Update' : 'Create'} Assignment
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card className="shadow-lg border-0 bg-card/80 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-primary/30 rounded-xl flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <CardTitle className="text-xl">All Assignments</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {assignments.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <FileText className="w-10 h-10 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">No assignments found</h3>
                  <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">Create your first assignment to get started with student assessments and progress tracking.</p>
                </div>
              ) : (
                <div className="rounded-lg border-2 border-border/60 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="font-semibold">Name</TableHead>
                        <TableHead className="font-semibold">Recording</TableHead>
                        <TableHead className="font-semibold">Due Days</TableHead>
                        <TableHead className="font-semibold">Type</TableHead>
                        <TableHead className="font-semibold">Mentor</TableHead>
                        <TableHead className="font-semibold">Created</TableHead>
                        <TableHead className="font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assignments.map((assignment) => (
                        <TableRow key={assignment.id} className="hover:bg-muted/20 transition-colors">
                          <TableCell className="font-semibold">{assignment.name}</TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Play className="w-4 h-4 text-muted-foreground" />
                              <span>{assignment.recording?.recording_title || 'Available immediately'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Clock className="w-4 h-4 text-muted-foreground" />
                              <span>{assignment.due_days || 7} days</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="capitalize font-medium bg-primary/10 text-primary">
                              {assignment.submission_type || 'text'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {assignment.mentor?.full_name || (
                              <span className="text-muted-foreground italic">No mentor assigned</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Clock className="w-4 h-4 text-muted-foreground" />
                              <span>{new Date(assignment.created_at).toLocaleDateString()}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEdit(assignment)}
                                className="hover:bg-primary/10 hover:border-primary/30"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete(assignment.id)}
                                className="hover:bg-destructive/10 hover:border-destructive/30"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}