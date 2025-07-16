import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Search, Edit, Trash2, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Student {
  id: string;
  email: string;
  role: string;
  lms_access_status: string;
  join_date: string;
  lms_start_date: string;
  lms_end_date: string;
}

export const StudentManagement = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'student')
        .order('join_date', { ascending: false });

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error('Error fetching students:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch students',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const createStudent = async (email: string, password: string) => {
    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });

      if (authError) throw authError;

      // Update user role and join date
      const { error: updateError } = await supabase
        .from('users')
        .update({
          role: 'student',
          join_date: new Date().toISOString().split('T')[0]
        })
        .eq('id', authData.user.id);

      if (updateError) throw updateError;

      toast({
        title: 'Success',
        description: 'Student created successfully'
      });

      fetchStudents();
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error('Error creating student:', error);
      toast({
        title: 'Error',
        description: 'Failed to create student',
        variant: 'destructive'
      });
    }
  };

  const updateAccessStatus = async (studentId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ lms_access_status: status })
        .eq('id', studentId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Access status updated'
      });

      fetchStudents();
    } catch (error) {
      console.error('Error updating access status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update access status',
        variant: 'destructive'
      });
    }
  };

  const filteredStudents = students.filter(student =>
    student.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const statusColors = {
      active: 'bg-green-500',
      suspended: 'bg-yellow-500',
      blocked: 'bg-red-500',
      pending: 'bg-gray-500'
    };
    return statusColors[status as keyof typeof statusColors] || 'bg-gray-500';
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading students...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Student Management</CardTitle>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Student
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Student</DialogTitle>
              </DialogHeader>
              <CreateStudentForm onSubmit={createStudent} />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-2 mb-4">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search students..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Join Date</TableHead>
              <TableHead>Access Status</TableHead>
              <TableHead>LMS Period</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStudents.map((student) => (
              <TableRow key={student.id}>
                <TableCell>{student.email}</TableCell>
                <TableCell>{new Date(student.join_date).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Badge className={getStatusBadge(student.lms_access_status)}>
                    {student.lms_access_status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {student.lms_start_date && student.lms_end_date
                    ? `${new Date(student.lms_start_date).toLocaleDateString()} - ${new Date(student.lms_end_date).toLocaleDateString()}`
                    : 'Not set'}
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <Select
                      value={student.lms_access_status}
                      onValueChange={(value) => updateAccessStatus(student.id, value)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                        <SelectItem value="blocked">Blocked</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="sm">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

const CreateStudentForm = ({ onSubmit }: { onSubmit: (email: string, password: string) => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(email, password);
    setEmail('');
    setPassword('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium">Email</label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="text-sm font-medium">Password</label>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <Button type="submit" className="w-full">Create Student</Button>
    </form>
  );
};