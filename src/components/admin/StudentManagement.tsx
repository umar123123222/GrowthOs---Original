
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
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
  full_name?: string;
  created_at: string;
  lms_status?: string;
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
      console.log('Fetching students...');
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'student')
        .order('created_at', { ascending: false });

      console.log('Students data:', data);
      console.log('Students error:', error);

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

  const createStudent = async (fullName: string, email: string, phone: string, feesStructure: string) => {
    try {
      console.log('Creating student via edge function...');
      
      const { data, error } = await supabase.functions.invoke('create-student', {
        body: {
          fullName,
          email,
          phone,
          feesStructure
        }
      });

      console.log('Edge function response:', data, error);

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      if (!data || !data.success) {
        throw new Error(data?.error || 'Failed to create student');
      }

      toast({
        title: 'Success',
        description: `Student created successfully. Temporary password: ${data.tempPassword}. LMS status is inactive until first payment.`
      });

      // Wait a moment before fetching to ensure the data is properly saved
      setTimeout(() => {
        fetchStudents();
      }, 1000);
      
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error('Error creating student:', error);
      toast({
        title: 'Error',
        description: 'Failed to create student: ' + (error as any).message,
        variant: 'destructive'
      });
    }
  };

  const updateStudentStatus = async (studentId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ lms_status: status })
        .eq('id', studentId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Student status updated successfully'
      });

      fetchStudents();
    } catch (error) {
      console.error('Error updating student status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update student status',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteStudent = async (studentId: string, studentName: string) => {
    try {
      // Delete from users table (this will handle the auth cleanup via trigger if needed)
      const { error: dbError } = await supabase
        .from('users')
        .delete()
        .eq('id', studentId);

      if (dbError) throw dbError;

      toast({
        title: "Success",
        description: `${studentName} has been deleted successfully`
      });

      fetchStudents();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to delete student: " + error.message,
        variant: "destructive"
      });
    }
  };

  const filteredStudents = students.filter(student =>
    student.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (student.full_name && student.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'active':
        return 'bg-green-500';
      case 'inactive':
        return 'bg-red-500';
      case 'suspended':
        return 'bg-yellow-500';
      default:
        return 'bg-blue-500';
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading students...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Student Management ({students.length} students)</CardTitle>
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
          <Button 
            onClick={fetchStudents} 
            variant="outline" 
            size="sm"
          >
            Refresh
          </Button>
        </div>

        {filteredStudents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {students.length === 0 ? 'No students found. Create your first student!' : 'No students match your search.'}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Full Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>LMS Status</TableHead>
                <TableHead>Created Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.map((student) => (
                <TableRow key={student.id}>
                  <TableCell>{student.email}</TableCell>
                  <TableCell>{student.full_name || 'N/A'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">Student</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusBadge(student.lms_status || 'inactive')}>
                      {student.lms_status || 'inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(student.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Select
                        defaultValue={student.lms_status || 'inactive'}
                        onValueChange={(value) => updateStudentStatus(student.id, value)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="sm">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete {student.full_name || student.email} and remove all their data. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteStudent(student.id, student.full_name || student.email)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

const CreateStudentForm = ({ onSubmit }: { onSubmit: (fullName: string, email: string, phone: string, feesStructure: string) => void }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [feesStructure, setFeesStructure] = useState('1_installment');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(fullName, email, phone, feesStructure);
    setFullName('');
    setEmail('');
    setPhone('');
    setFeesStructure('1_installment');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium">Full Name</label>
        <Input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
      </div>
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
        <label className="text-sm font-medium">Phone</label>
        <Input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      <div>
        <label className="text-sm font-medium">Fees Structure</label>
        <Select value={feesStructure} onValueChange={setFeesStructure}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1_installment">1 Installment</SelectItem>
            <SelectItem value="2_installments">2 Installments</SelectItem>
            <SelectItem value="3_installments">3 Installments</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="text-sm text-muted-foreground">
        <p>• LMS User ID will be set to the student's email</p>
        <p>• Temporary password will be auto-generated</p>
        <p>• LMS status will be inactive until first payment</p>
      </div>
      <Button type="submit" className="w-full">Create Student</Button>
    </form>
  );
};
