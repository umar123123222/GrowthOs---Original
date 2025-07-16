import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Plus, Edit, Trash2, Users, Activity, DollarSign, Download, CheckCircle, XCircle, Search, Filter, Clock, Ban } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';

interface Student {
  id: string;
  student_id: string;
  full_name: string;
  email: string;
  phone: string;
  lms_user_id: string;
  lms_password: string;
  status: string;
  created_at: string;
  last_active_at: string;
  fees_structure: string;
  lms_suspended: boolean;
  fees_overdue: boolean;
  last_invoice_date: string;
  last_invoice_sent: boolean;
  fees_due_date: string;
}

export function StudentsManagement() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [totalStudents, setTotalStudents] = useState(0);
  const [activeStudents, setActiveStudents] = useState(0);
  const [suspendedStudents, setSuspendedStudents] = useState(0);
  const [overdueStudents, setOverdueStudents] = useState(0);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [lmsStatusFilter, setLmsStatusFilter] = useState('all');
  const [feesStructureFilter, setFeesStructureFilter] = useState('all');
  const [invoiceFilter, setInvoiceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    lms_user_id: '',
    lms_password: '',
    fees_structure: '1_installment'
  });

  useEffect(() => {
    fetchStudents();
  }, []);

  useEffect(() => {
    filterStudents();
  }, [students, searchTerm, lmsStatusFilter, feesStructureFilter, invoiceFilter, statusFilter]);

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'student')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setStudents(data || []);
      setTotalStudents(data?.length || 0);
      
      // Calculate active students (those who have been active in the last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const activeCount = data?.filter(student => 
        student.last_active_at && new Date(student.last_active_at) > thirtyDaysAgo
      ).length || 0;
      
      setActiveStudents(activeCount);
      
      // Calculate suspended and overdue students
      const suspendedCount = data?.filter(student => student.lms_suspended).length || 0;
      const overdueCount = data?.filter(student => student.fees_overdue).length || 0;
      
      setSuspendedStudents(suspendedCount);
      setOverdueStudents(overdueCount);
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

  const filterStudents = () => {
    let filtered = students;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(student =>
        student.student_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.phone?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply LMS status filter
    if (lmsStatusFilter === 'suspended') {
      filtered = filtered.filter(student => student.lms_suspended);
    } else if (lmsStatusFilter === 'active') {
      filtered = filtered.filter(student => !student.lms_suspended);
    }

    // Apply fees structure filter
    if (feesStructureFilter !== 'all') {
      filtered = filtered.filter(student => student.fees_structure === feesStructureFilter);
    }

    // Apply invoice filter
    if (invoiceFilter === 'fees_due') {
      filtered = filtered.filter(student => student.last_invoice_sent && !student.fees_overdue);
    } else if (invoiceFilter === 'fees_overdue') {
      filtered = filtered.filter(student => student.fees_overdue);
    } else if (invoiceFilter === 'fees_cleared') {
      filtered = filtered.filter(student => !student.fees_overdue && student.last_invoice_sent);
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(student => student.status === statusFilter);
    }

    setFilteredStudents(filtered);
  };

  const generateUniqueCredentials = () => {
    const timestamp = Date.now().toString();
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    
    return {
      lms_user_id: `user_${timestamp}_${randomSuffix}`,
      lms_password: `pass_${timestamp}_${randomSuffix}`
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const credentials = formData.lms_user_id && formData.lms_password 
        ? { lms_user_id: formData.lms_user_id, lms_password: formData.lms_password }
        : generateUniqueCredentials();

      const studentData = {
        full_name: formData.full_name,
        email: formData.email,
        phone: formData.phone,
        ...credentials,
        fees_structure: formData.fees_structure,
        role: 'student',
        status: 'Active'
      };

      if (editingStudent) {
        const { error } = await supabase
          .from('users')
          .update(studentData)
          .eq('id', editingStudent.id);

        if (error) throw error;
        
        toast({
          title: 'Success',
          description: 'Student updated successfully'
        });
      } else {
        const { error } = await supabase
          .from('users')
          .insert([studentData]);

        if (error) throw error;
        
        toast({
          title: 'Success',
          description: 'Student added successfully'
        });
      }

      setIsDialogOpen(false);
      setEditingStudent(null);
      setFormData({
        full_name: '',
        email: '',
        phone: '',
        lms_user_id: '',
        lms_password: '',
        fees_structure: '1_installment'
      });
      fetchStudents();
    } catch (error) {
      console.error('Error saving student:', error);
      toast({
        title: 'Error',
        description: 'Failed to save student',
        variant: 'destructive'
      });
    }
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      full_name: student.full_name,
      email: student.email,
      phone: student.phone || '',
      lms_user_id: student.lms_user_id || '',
      lms_password: student.lms_password || '',
      fees_structure: student.fees_structure || '1_installment'
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this student?')) return;

    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Student deleted successfully'
      });

      fetchStudents();
    } catch (error) {
      console.error('Error deleting student:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete student',
        variant: 'destructive'
      });
    }
  };

  const handleFeesReceived = async (studentId: string) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ 
          fees_overdue: false,
          lms_suspended: false,
          fees_due_date: null
        })
        .eq('id', studentId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Fees marked as received'
      });

      fetchStudents();
    } catch (error) {
      console.error('Error updating fees status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update fees status',
        variant: 'destructive'
      });
    }
  };

  const handleSuspendAccount = async (studentId: string) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ 
          lms_suspended: true,
          status: 'Suspended'
        })
        .eq('id', studentId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Account suspended successfully'
      });

      fetchStudents();
    } catch (error) {
      console.error('Error suspending account:', error);
      toast({
        title: 'Error',
        description: 'Failed to suspend account',
        variant: 'destructive'
      });
    }
  };

  const generateInvoice = async (studentId: string) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ 
          last_invoice_date: new Date().toISOString(),
          last_invoice_sent: true,
          fees_due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        })
        .eq('id', studentId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Invoice generated and sent'
      });

      fetchStudents();
    } catch (error) {
      console.error('Error generating invoice:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate invoice',
        variant: 'destructive'
      });
    }
  };

  const downloadInvoicePDF = (student: Student) => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text('Invoice', 20, 20);
    
    doc.setFontSize(12);
    doc.text(`Student ID: ${student.student_id}`, 20, 40);
    doc.text(`Name: ${student.full_name}`, 20, 50);
    doc.text(`Email: ${student.email}`, 20, 60);
    doc.text(`Fees Structure: ${student.fees_structure?.replace('_', ' ').toUpperCase()}`, 20, 70);
    doc.text(`Invoice Date: ${student.last_invoice_date ? formatDate(student.last_invoice_date) : 'N/A'}`, 20, 80);
    doc.text(`Due Date: ${student.fees_due_date ? formatDate(student.fees_due_date) : 'N/A'}`, 20, 90);
    
    doc.save(`invoice_${student.student_id}.pdf`);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-green-100 text-green-800';
      case 'Inactive':
        return 'bg-red-100 text-red-800';
      case 'Suspended':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getFeesStructureLabel = (structure: string) => {
    switch (structure) {
      case '1_installment':
        return '1 Installment';
      case '2_installments':
        return '2 Installments';
      case '3_installments':
        return '3 Installments';
      default:
        return 'N/A';
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  const displayStudents = filteredStudents.length > 0 ? filteredStudents : students;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Students Management</h1>
          <p className="text-gray-600">Manage student records and track their progress</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingStudent(null)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Student
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingStudent ? 'Edit Student' : 'Add New Student'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="fees_structure">Fees Structure</Label>
                <Select value={formData.fees_structure} onValueChange={(value) => setFormData({ ...formData, fees_structure: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select fees structure" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1_installment">1 Installment</SelectItem>
                    <SelectItem value="2_installments">2 Installments</SelectItem>
                    <SelectItem value="3_installments">3 Installments</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="lms_user_id">LMS User ID (Optional)</Label>
                <Input
                  id="lms_user_id"
                  value={formData.lms_user_id}
                  onChange={(e) => setFormData({ ...formData, lms_user_id: e.target.value })}
                  placeholder="Will be generated if left empty"
                />
              </div>
              <div>
                <Label htmlFor="lms_password">LMS Password (Optional)</Label>
                <Input
                  id="lms_password"
                  type="password"
                  value={formData.lms_password}
                  onChange={(e) => setFormData({ ...formData, lms_password: e.target.value })}
                  placeholder="Will be generated if left empty"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingStudent ? 'Update' : 'Add'} Student
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStudents}</div>
            <p className="text-xs text-muted-foreground">All enrolled</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Students</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeStudents}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suspended</CardTitle>
            <Ban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{suspendedStudents}</div>
            <p className="text-xs text-muted-foreground">LMS suspended</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fees Overdue</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overdueStudents}</div>
            <p className="text-xs text-muted-foreground">Payment due</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Engagement</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalStudents > 0 ? Math.round((activeStudents / totalStudents) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">Activity rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4 items-center flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by ID, name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-white z-50">
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Inactive">Inactive</SelectItem>
            <SelectItem value="Suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>

        <Select value={lmsStatusFilter} onValueChange={setLmsStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="LMS Status" />
          </SelectTrigger>
          <SelectContent className="bg-white z-50">
            <SelectItem value="all">All LMS Status</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="active">Active</SelectItem>
          </SelectContent>
        </Select>

        <Select value={feesStructureFilter} onValueChange={setFeesStructureFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Fees Structure" />
          </SelectTrigger>
          <SelectContent className="bg-white z-50">
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="1_installment">1 Installment</SelectItem>
            <SelectItem value="2_installments">2 Installments</SelectItem>
            <SelectItem value="3_installments">3 Installments</SelectItem>
          </SelectContent>
        </Select>

        <Select value={invoiceFilter} onValueChange={setInvoiceFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Invoice Status" />
          </SelectTrigger>
          <SelectContent className="bg-white z-50">
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="fees_due">Fees Due</SelectItem>
            <SelectItem value="fees_overdue">Fees Overdue</SelectItem>
            <SelectItem value="fees_cleared">Fees Cleared</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Students Table */}
      <Card>
        <CardHeader>
          <CardTitle>Students ({displayStudents.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Fees Structure</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Invoice</TableHead>
                  <TableHead>Invoice Sent</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayStudents.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">{student.student_id}</TableCell>
                    <TableCell>{student.full_name}</TableCell>
                    <TableCell>{student.email}</TableCell>
                    <TableCell>{student.phone || 'N/A'}</TableCell>
                    <TableCell>{getFeesStructureLabel(student.fees_structure)}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(student.status)}>
                        {student.status}
                      </Badge>
                      {student.lms_suspended && (
                        <Badge className="ml-2 bg-red-100 text-red-800">
                          <Ban className="w-3 h-3 mr-1" />
                          Suspended
                        </Badge>
                      )}
                      {student.fees_overdue && (
                        <Badge className="ml-2 bg-orange-100 text-orange-800">
                          <Clock className="w-3 h-3 mr-1" />
                          Overdue
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(student.last_invoice_date)}</TableCell>
                    <TableCell>
                      {student.last_invoice_sent ? (
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Sent
                        </Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-800">
                          <XCircle className="w-3 h-3 mr-1" />
                          Not Sent
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(student)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => generateInvoice(student.id)}
                        >
                          Generate Invoice
                        </Button>
                        {student.last_invoice_date && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadInvoicePDF(student)}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        )}
                        {student.fees_overdue && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleFeesReceived(student.id)}
                              className="text-green-600"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSuspendAccount(student.id)}
                              className="text-red-600"
                            >
                              <Ban className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(student.id)}
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
        </CardContent>
      </Card>
    </div>
  );
}