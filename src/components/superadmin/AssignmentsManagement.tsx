import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, FileText, CalendarIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface Assignment {
  assignment_id: string;
  assignment_title: string;
  assignment_description: string;
  due_date: string;
}

interface User {
  id: string;
  full_name: string;
  role: string;
}

export function AssignmentsManagement() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [mentors, setMentors] = useState<User[]>([]);
  const [admins, setAdmins] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  
  const [formData, setFormData] = useState({
    assignment_title: '',
    assignment_description: '',
    assigned_to: '',
    submission_type: 'file',
    due_days_after_unlock: 2
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchAssignments();
    fetchMentorsAndAdmins();
  }, []);

  const fetchAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from('assignment')
        .select('*')
        .order('created_at');

      if (error) throw error;
      setAssignments(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch assignments",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMentorsAndAdmins = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, role')
        .in('role', ['mentor', 'admin']);

      if (error) throw error;
      
      const mentorsList = data?.filter(user => user.role === 'mentor') || [];
      const adminsList = data?.filter(user => user.role === 'admin') || [];
      
      setMentors(mentorsList);
      setAdmins(adminsList);
    } catch (error) {
      console.error('Error fetching mentors and admins:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingAssignment) {
        const { error } = await supabase
          .from('assignment')
          .update({
            assignment_title: formData.assignment_title,
            assignment_description: formData.assignment_description,
            due_date: new Date(Date.now() + formData.due_days_after_unlock * 24 * 60 * 60 * 1000).toISOString()
          })
          .eq('assignment_id', editingAssignment.assignment_id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Assignment updated successfully"
        });
      } else {
        const { error } = await supabase
          .from('assignment')
          .insert({
            assignment_title: formData.assignment_title,
            assignment_description: formData.assignment_description,
            due_date: new Date(Date.now() + formData.due_days_after_unlock * 24 * 60 * 60 * 1000).toISOString(),
            sequence_order: 1,
            created_at: new Date().toISOString()
          });

        if (error) throw error;

        toast({
          title: "Success",
          description: "Assignment created successfully"
        });
      }

      setDialogOpen(false);
      setEditingAssignment(null);
      setFormData({
        assignment_title: '',
        assignment_description: '',
        assigned_to: '',
        submission_type: 'file',
        due_days_after_unlock: 2
      });
      fetchAssignments();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save assignment",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    setFormData({
      assignment_title: assignment.assignment_title,
      assignment_description: assignment.assignment_description,
      assigned_to: '',
      submission_type: 'file',
      due_days_after_unlock: 2
    });
    setDialogOpen(true);
  };

  const handleDelete = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to delete this assignment?')) return;

    try {
      const { error } = await supabase
        .from('assignment')
        .delete()
        .eq('assignment_id', assignmentId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Assignment deleted successfully"
      });
      fetchAssignments();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete assignment",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading assignments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center">
        <div className="animate-fade-in">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-orange-600 bg-clip-text text-transparent">
            Assignments Management
          </h2>
          <p className="text-muted-foreground mt-1 text-lg">Manage course assignments and submissions</p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              onClick={() => {
                setEditingAssignment(null);
                setFormData({
                  assignment_title: '',
                  assignment_description: '',
                  assigned_to: '',
                  submission_type: 'file',
                  due_days_after_unlock: 2
                });
              }}
              className="hover-scale bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Assignment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">
                {editingAssignment ? 'Edit Assignment' : 'Add New Assignment'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Title</label>
                <Input
                  value={formData.assignment_title}
                  onChange={(e) => setFormData({ ...formData, assignment_title: e.target.value })}
                  placeholder="Enter assignment title"
                  className="transition-all duration-200 focus:scale-[1.02]"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Description</label>
                <Textarea
                  value={formData.assignment_description}
                  onChange={(e) => setFormData({ ...formData, assignment_description: e.target.value })}
                  placeholder="Enter assignment description"
                  className="transition-all duration-200 focus:scale-[1.02] min-h-[100px]"
                  required
                />
              </div>
              

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Due Date</label>
                <Select
                  value={formData.due_days_after_unlock.toString()}
                  onValueChange={(value) => setFormData({ ...formData, due_days_after_unlock: parseInt(value) })}
                >
                  <SelectTrigger className="transition-all duration-200 focus:scale-[1.02]">
                    <SelectValue placeholder="Select days after unlock" />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50">
                    <SelectItem value="2">2 days after unlock</SelectItem>
                    <SelectItem value="3">3 days after unlock</SelectItem>
                    <SelectItem value="4">4 days after unlock</SelectItem>
                    <SelectItem value="5">5 days after unlock</SelectItem>
                    <SelectItem value="7">7 days after unlock</SelectItem>
                    <SelectItem value="10">10 days after unlock</SelectItem>
                    <SelectItem value="14">14 days after unlock</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Submission Type</label>
                <Select
                  value={formData.submission_type}
                  onValueChange={(value) => setFormData({ ...formData, submission_type: value })}
                >
                  <SelectTrigger className="transition-all duration-200 focus:scale-[1.02]">
                    <SelectValue placeholder="Select submission type" />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50">
                    <SelectItem value="file">File Upload</SelectItem>
                    <SelectItem value="text">Text Response</SelectItem>
                    <SelectItem value="link">External Link</SelectItem>
                    <SelectItem value="multiple_choice">Multiple Choice (Multiple selections)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Assign to Mentor/Admin</label>
                <Select
                  value={formData.assigned_to}
                  onValueChange={(value) => setFormData({ ...formData, assigned_to: value })}
                >
                  <SelectTrigger className="transition-all duration-200 focus:scale-[1.02]">
                    <SelectValue placeholder="Select mentor or admin" />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50">
                    <optgroup label="Mentors">
                      {mentors.map((mentor) => (
                        <SelectItem key={mentor.id} value={mentor.id}>
                          {mentor.full_name} (Mentor)
                        </SelectItem>
                      ))}
                    </optgroup>
                    <optgroup label="Admins">
                      {admins.map((admin) => (
                        <SelectItem key={admin.id} value={admin.id}>
                          {admin.full_name} (Admin)
                        </SelectItem>
                      ))}
                    </optgroup>
                  </SelectContent>
                </Select>
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
                  {editingAssignment ? 'Update' : 'Create'} Assignment
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50 animate-fade-in">
        <CardHeader className="bg-gradient-to-r from-orange-50 to-red-50 border-b">
          <CardTitle className="flex items-center text-xl">
            <FileText className="w-6 h-6 mr-3 text-orange-600" />
            All Assignments
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {assignments.length === 0 ? (
            <div className="text-center py-16 animate-fade-in">
              <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-muted-foreground mb-2">No assignments found</h3>
              <p className="text-muted-foreground">Create your first assignment to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold">Title</TableHead>
                  <TableHead className="font-semibold">Description</TableHead>
                  <TableHead className="font-semibold">Due Date</TableHead>
                  <TableHead className="font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((assignment, index) => (
                  <TableRow 
                    key={assignment.assignment_id} 
                    className="hover:bg-gray-50 transition-colors animate-fade-in"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <TableCell className="font-medium">{assignment.assignment_title}</TableCell>
                    <TableCell className="max-w-xs">
                      <div className="truncate" title={assignment.assignment_description}>
                        {assignment.assignment_description}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-blue-100 text-blue-800">
                        {assignment.due_date ? format(new Date(assignment.due_date), "PPP") : 'No due date'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(assignment)}
                          className="hover-scale hover:bg-blue-50 hover:border-blue-300"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(assignment.assignment_id)}
                          className="hover-scale hover:bg-red-50 hover:border-red-300 hover:text-red-600"
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