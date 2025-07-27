import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus, UserPlus, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserManagement, UserRole } from "@/hooks/useUserManagement";
import { supabase } from "@/integrations/supabase/client";

interface Student {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
  metadata?: any;
}

const StudentsManagement = () => {
  const { user } = useAuth();
  const { createUser, deleteUser, loading } = useUserManagement();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  
  const [newStudent, setNewStudent] = useState({
    email: "",
    fullName: "",
    tempPassword: ""
  });

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'student')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch students:', error);
        return;
      }

      setStudents((data || []).filter(user => user.role === 'student'));
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newStudent.email || !newStudent.tempPassword) {
      return;
    }

    const success = await createUser({
      target_email: newStudent.email,
      target_password: newStudent.tempPassword,
      target_role: 'student',
      target_full_name: newStudent.fullName || newStudent.email
    });

    if (success) {
      setNewStudent({ email: "", fullName: "", tempPassword: "" });
      setIsDialogOpen(false);
      fetchStudents();
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    const success = await deleteUser(studentId);
    if (success) {
      fetchStudents();
    }
  };

  // Check permissions
  if (!user || !['superadmin', 'admin', 'enrollment_manager'].includes(user.role)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to manage students.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Students Management</h1>
          <p className="text-gray-600">Manage student accounts and enrollment</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Student
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Student</DialogTitle>
              <DialogDescription>
                Create a new student account with login credentials
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateStudent} className="space-y-4">
              <div>
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={newStudent.email}
                  onChange={(e) => setNewStudent({...newStudent, email: e.target.value})}
                  placeholder="student@example.com"
                  required
                />
              </div>
              <div>
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={newStudent.fullName}
                  onChange={(e) => setNewStudent({...newStudent, fullName: e.target.value})}
                  placeholder="Enter student's full name"
                />
              </div>
              <div>
                <Label htmlFor="tempPassword">Temporary Password *</Label>
                <Input
                  id="tempPassword"
                  type="password"
                  value={newStudent.tempPassword}
                  onChange={(e) => setNewStudent({...newStudent, tempPassword: e.target.value})}
                  placeholder="Create a temporary password"
                  required
                />
              </div>
              <Button 
                type="submit" 
                disabled={loading}
                className="w-full"
              >
                {loading ? "Creating..." : "Create Student"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{students.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active This Month</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {students.filter(s => {
                const oneMonthAgo = new Date();
                oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
                return new Date(s.created_at) > oneMonthAgo;
              }).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New This Week</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {students.filter(s => {
                const oneWeekAgo = new Date();
                oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                return new Date(s.created_at) > oneWeekAgo;
              }).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Students Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Students</CardTitle>
          <CardDescription>
            Manage student accounts and their access to the learning platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Created Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => (
                <TableRow key={student.id}>
                  <TableCell className="font-medium">
                    {student.full_name || student.email}
                  </TableCell>
                  <TableCell>{student.email}</TableCell>
                  <TableCell>
                    {new Date(student.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      {(user.role === 'superadmin' || user.role === 'admin') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteStudent(student.id)}
                          disabled={loading}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {students.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                    No students found. Create your first student account above.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentsManagement;