import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Plus, Edit, Trash2, Users, Activity, DollarSign, Download, CheckCircle, XCircle, Search, Filter, Clock, Ban, ChevronDown, ChevronUp, FileText, Key, Lock, Eye, Settings, Award } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
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
  created_at: string;
  last_active_at: string;
  fees_structure: string;
  lms_status: string;
  fees_overdue: boolean;
  last_invoice_date: string;
  last_invoice_sent: boolean;
  fees_due_date: string;
  last_suspended_date: string;
}

interface InstallmentPayment {
  id: string;
  installment_number: number;
  total_installments: number;
  amount: number;
  payment_date: string;
  status: string;
}

interface ActivityLog {
  id: string;
  activity_type: string;
  occurred_at: string;
  metadata: any;
  reference_id: string;
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
  
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [activityLogsDialog, setActivityLogsDialog] = useState(false);
  const [selectedStudentForLogs, setSelectedStudentForLogs] = useState<Student | null>(null);
  const [statusUpdateDialog, setStatusUpdateDialog] = useState(false);
  const [selectedStudentForStatus, setSelectedStudentForStatus] = useState<Student | null>(null);
  const [newLMSStatus, setNewLMSStatus] = useState('');
  const [installmentPayments, setInstallmentPayments] = useState<Map<string, InstallmentPayment[]>>(new Map());
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [bulkActionDialog, setBulkActionDialog] = useState(false);
  const { toast } = useToast();
  
  // Debug: Ensure statusFilter is completely removed
  console.log('StudentsManagement component loaded - statusFilter removed');

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    fees_structure: '1_installment'
  });

  useEffect(() => {
    fetchStudents();
  }, []);

  useEffect(() => {
    if (students.length > 0) {
      fetchInstallmentPayments();
    }
  }, [students]);

  useEffect(() => {
    filterStudents();
  }, [students, searchTerm, lmsStatusFilter, feesStructureFilter, invoiceFilter]);

  const fetchInstallmentPayments = async () => {
    try {
      const { data, error } = await supabase
        .from('installment_payments')
        .select('*')
        .order('installment_number', { ascending: true });

      if (error) throw error;

      // Group payments by user_id
      const paymentsMap = new Map<string, InstallmentPayment[]>();
      data?.forEach((payment) => {
        const userPayments = paymentsMap.get(payment.user_id) || [];
        userPayments.push(payment);
        paymentsMap.set(payment.user_id, userPayments);
      });

      setInstallmentPayments(paymentsMap);
    } catch (error) {
      console.error('Error fetching installment payments:', error);
    }
  };

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
      const suspendedCount = data?.filter(student => student.lms_status === 'suspended').length || 0;
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
    if (lmsStatusFilter !== 'all') {
      filtered = filtered.filter(student => student.lms_status === lmsStatusFilter);
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


    setFilteredStudents(filtered);
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const studentData = {
        full_name: formData.full_name,
        email: formData.email,
        phone: formData.phone,
        lms_user_id: formData.email, // Set LMS user ID to email
        lms_status: 'inactive', // Set status to inactive until first payment
        fees_structure: formData.fees_structure,
        role: 'student'
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
        // Generate a temporary password for the new student
        const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';
        
        // Create auth user first
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: formData.email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            full_name: formData.full_name
          }
        });

        if (authError) throw authError;

        // Update user with additional information
        const { error: updateError } = await supabase
          .from('users')
          .update(studentData)
          .eq('id', authData.user.id);

        if (updateError) throw updateError;
        
        toast({
          title: 'Success',
          description: `Student added successfully. Temporary password: ${tempPassword}. LMS status is inactive until first payment.`
        });
      }

      setIsDialogOpen(false);
      setEditingStudent(null);
      setFormData({
        full_name: '',
        email: '',
        phone: '',
        fees_structure: '1_installment'
      });
      fetchStudents();
    } catch (error) {
      console.error('Error saving student:', error);
      toast({
        title: 'Error',
        description: 'Failed to save student: ' + (error as any).message,
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


  const handleSuspendAccount = async (studentId: string) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ 
          lms_status: 'suspended',
          last_suspended_date: new Date().toISOString(),
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
          fees_due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
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

  const handleDeleteStudent = async (studentId: string, studentName: string) => {
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', studentId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `${studentName} has been deleted successfully`
      });

      fetchStudents();
    } catch (error: any) {
      console.error('Error deleting student:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete student: ' + error.message,
        variant: 'destructive'
      });
    }
  };

  const getLMSStatusColor = (lmsStatus: string) => {
    switch (lmsStatus) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'suspended':
        return 'bg-red-100 text-red-800';
      case 'dropout':
        return 'bg-orange-100 text-orange-800';
      case 'complete':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getLMSStatusIcon = (lmsStatus: string) => {
    switch (lmsStatus) {
      case 'active':
        return <CheckCircle className="w-3 h-3 mr-1" />;
      case 'inactive':
        return <Clock className="w-3 h-3 mr-1" />;
      case 'suspended':
        return <Ban className="w-3 h-3 mr-1" />;
      case 'dropout':
        return <XCircle className="w-3 h-3 mr-1" />;
      case 'complete':
        return <Award className="w-3 h-3 mr-1" />;
      default:
        return <Clock className="w-3 h-3 mr-1" />;
    }
  };

  const getLMSStatusLabel = (lmsStatus: string) => {
    switch (lmsStatus) {
      case 'active':
        return 'Active';
      case 'inactive':
        return 'Inactive';
      case 'suspended':
        return 'Suspended';
      case 'dropout':
        return 'Dropout';
      case 'complete':
        return 'Complete';
      default:
        return 'Unknown';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
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

  const toggleRowExpansion = (studentId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(studentId)) {
      newExpanded.delete(studentId);
    } else {
      newExpanded.add(studentId);
    }
    setExpandedRows(newExpanded);
  };

  const handleToggleLMSSuspension = async (studentId: string, currentStatus: string) => {
    try {
      const newLMSStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
      const updateData: any = { 
        lms_status: newLMSStatus,
      };
      
      // If we're suspending, set the last_suspended_date
      if (newLMSStatus === 'suspended') {
        updateData.last_suspended_date = new Date().toISOString();
      }
      
      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', studentId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `LMS account ${newLMSStatus === 'suspended' ? 'suspended' : 'activated'} successfully`
      });

      fetchStudents();
    } catch (error) {
      console.error('Error toggling LMS suspension:', error);
      toast({
        title: 'Error',
        description: 'Failed to update LMS status',
        variant: 'destructive'
      });
    }
  };

  const handleViewActivityLogs = async (studentId: string) => {
    try {
      const student = students.find(s => s.id === studentId);
      if (!student) return;
      
      setSelectedStudentForLogs(student);
      
      const { data, error } = await supabase
        .from('user_activity_logs')
        .select('*')
        .eq('user_id', studentId)
        .order('occurred_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      setActivityLogs(data || []);
      setActivityLogsDialog(true);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch activity logs',
        variant: 'destructive'
      });
    }
  };

  const handleStatusUpdate = async (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    
    setSelectedStudentForStatus(student);
    setNewLMSStatus(student.lms_status);
    setStatusUpdateDialog(true);
  };

  const saveStatusUpdate = async () => {
    if (!selectedStudentForStatus || !newLMSStatus) return;

    try {
      const updateData: any = { 
        lms_status: newLMSStatus
      };

      // If setting LMS status to suspended, update the last_suspended_date
      if (newLMSStatus === 'suspended' && selectedStudentForStatus.lms_status !== 'suspended') {
        updateData.last_suspended_date = new Date().toISOString();
      }

      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', selectedStudentForStatus.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'LMS status updated successfully'
      });

      setStatusUpdateDialog(false);
      setSelectedStudentForStatus(null);
      setNewLMSStatus('');
      fetchStudents();
    } catch (error) {
      console.error('Error updating LMS status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update LMS status',
        variant: 'destructive'
      });
    }
  };

  const formatActivityType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getInvoiceStatus = (student: Student) => {
    if (student.fees_overdue) return 'Fees Overdue';
    if (student.last_invoice_sent && !student.fees_overdue) return 'Fees Due';
    return 'Fees Cleared';
  };

  const getInstallmentStatus = (student: Student) => {
    const payments = installmentPayments.get(student.id) || [];
    const totalInstallments = student.fees_structure === '2_installments' ? 2 : 
                              student.fees_structure === '3_installments' ? 3 : 1;

    if (payments.length === 0) {
      return { status: getInvoiceStatus(student), color: 'bg-gray-100 text-gray-800' };
    }

    const paidPayments = payments.filter(p => p.status === 'paid');
    
    if (paidPayments.length === totalInstallments) {
      return { status: 'Fees Cleared', color: 'bg-green-100 text-green-800' };
    } else if (paidPayments.length > 0) {
      const ordinalSuffix = (n: number) => {
        const j = n % 10;
        const k = n % 100;
        if (j === 1 && k !== 11) return `${n}st`;
        if (j === 2 && k !== 12) return `${n}nd`;
        if (j === 3 && k !== 13) return `${n}rd`;
        return `${n}th`;
      };
      return { 
        status: `${ordinalSuffix(paidPayments.length)} Installment Paid`, 
        color: 'bg-blue-100 text-blue-800' 
      };
    }

    return { status: getInvoiceStatus(student), color: 'bg-orange-100 text-orange-800' };
  };

  const handleMarkInstallmentPaid = async (studentId: string, installmentNumber: number) => {
    try {
      const student = students.find(s => s.id === studentId);
      if (!student) return;

      // Check if this installment payment already exists
      const { data: existingPayment } = await supabase
        .from('installment_payments')
        .select('id')
        .eq('user_id', studentId)
        .eq('installment_number', installmentNumber)
        .eq('status', 'paid')
        .single();

      if (existingPayment) {
        toast({
          title: "Already Paid",
          description: "This installment has already been marked as paid",
          variant: "destructive"
        });
        return;
      }

      const totalInstallments = student.fees_structure === '2_installments' ? 2 : 
                                student.fees_structure === '3_installments' ? 3 : 1;

      const { error } = await supabase
        .from('installment_payments')
        .insert({
          user_id: studentId,
          installment_number: installmentNumber,
          total_installments: totalInstallments,
          amount: 0, // You can set actual amount based on your business logic
          status: 'paid'
        });

      if (error) throw error;

      // If this is the last installment, update the user's fees status
      if (installmentNumber === totalInstallments) {
        await supabase
          .from('users')
          .update({ 
            fees_overdue: false,
            lms_status: 'active',
            fees_due_date: null
          })
          .eq('id', studentId);
      }

      toast({
        title: 'Success',
        description: `Installment ${installmentNumber} marked as paid`
      });

      fetchInstallmentPayments();
      fetchStudents();
    } catch (error) {
      console.error('Error marking installment as paid:', error);
      toast({
        title: 'Error',
        description: 'Failed to mark installment as paid',
        variant: 'destructive'
      });
    }
  };

  const handleSelectStudent = (studentId: string, checked: boolean) => {
    const newSelected = new Set(selectedStudents);
    if (checked) {
      newSelected.add(studentId);
    } else {
      newSelected.delete(studentId);
    }
    setSelectedStudents(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedStudents(new Set(displayStudents.map(s => s.id)));
    } else {
      setSelectedStudents(new Set());
    }
  };

  const handleBulkLMSAction = async (action: 'suspend' | 'activate') => {
    if (selectedStudents.size === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one student',
        variant: 'destructive'
      });
      return;
    }

    try {
      const lms_status = action === 'suspend' ? 'suspended' : 'active';

      const { error } = await supabase
        .from('users')
        .update({ 
          lms_status
        })
        .in('id', Array.from(selectedStudents));

      if (error) throw error;

      toast({
        title: 'Success',
        description: `${selectedStudents.size} student(s) ${action === 'suspend' ? 'suspended' : 'activated'} successfully`
      });

      setSelectedStudents(new Set());
      setBulkActionDialog(false);
      fetchStudents();
    } catch (error) {
      console.error('Error updating bulk LMS status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update LMS status',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-muted-foreground">Loading students...</span>
      </div>
    );
  }

  const displayStudents = filteredStudents.length > 0 ? filteredStudents : students;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div className="animate-fade-in">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            👥 Students Management
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">Manage student records and track their progress</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingStudent(null)} className="hover-scale bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 animate-scale-in">
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
              <div className="text-sm text-muted-foreground space-y-1">
                <p>• LMS User ID will be set to the student's email</p>
                <p>• Temporary password will be auto-generated</p>
                <p>• LMS status will be inactive until first payment</p>
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
        <Card className="border-l-4 border-l-blue-500 hover-scale transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-blue-50 to-white animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-800">Total Students</CardTitle>
            <Users className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-900">{totalStudents}</div>
            <p className="text-xs text-muted-foreground">All enrolled</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 hover-scale transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-green-50 to-white animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-800">Active Students</CardTitle>
            <Activity className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-900">{activeStudents}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500 hover-scale transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-yellow-50 to-white animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-yellow-800">Suspended</CardTitle>
            <Ban className="h-5 w-5 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-900">{suspendedStudents}</div>
            <p className="text-xs text-muted-foreground">LMS suspended</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500 hover-scale transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-red-50 to-white animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-800">Fees Overdue</CardTitle>
            <Clock className="h-5 w-5 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-900">{overdueStudents}</div>
            <p className="text-xs text-muted-foreground">Payment due</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500 hover-scale transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-purple-50 to-white animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-800">Engagement</CardTitle>
            <DollarSign className="h-5 w-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-900">
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
        

        <Select value={lmsStatusFilter} onValueChange={setLmsStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="LMS Status" />
          </SelectTrigger>
          <SelectContent className="bg-white z-50">
            <SelectItem value="all">All LMS Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="dropout">Dropout</SelectItem>
            <SelectItem value="complete">Complete</SelectItem>
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

      {/* Bulk Actions */}
      {selectedStudents.size > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-blue-800">
                  {selectedStudents.size} student(s) selected
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedStudents(new Set())}
                  className="text-blue-600 border-blue-300 hover:bg-blue-100"
                >
                  Clear Selection
                </Button>
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkLMSAction('suspend')}
                  className="text-red-600 border-red-300 hover:bg-red-50"
                >
                  <Ban className="w-4 h-4 mr-2" />
                  Suspend LMS
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkLMSAction('activate')}
                  className="text-green-600 border-green-300 hover:bg-green-50"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Activate LMS
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Students Table */}
      <Card className="hover-scale transition-all duration-300 hover:shadow-lg animate-fade-in">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50 border-b">
          <CardTitle className="flex items-center text-xl">
            <Users className="w-5 h-5 mr-2 text-blue-600" />
            Students Directory ({displayStudents.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedStudents.size === displayStudents.length && displayStudents.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Student ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Fees Structure</TableHead>
                  <TableHead>LMS Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayStudents.map((student) => (
                  <React.Fragment key={`student-${student.id}`}>
                    <TableRow key={student.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedStudents.has(student.id)}
                          onCheckedChange={(checked) => handleSelectStudent(student.id, checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{student.student_id}</TableCell>
                      <TableCell>{student.full_name}</TableCell>
                      <TableCell>{student.email}</TableCell>
                      <TableCell>{student.phone || 'N/A'}</TableCell>
                       <TableCell>{getFeesStructureLabel(student.fees_structure)}</TableCell>
                        <TableCell>
                           <div className="flex flex-wrap gap-2">
                             <Badge className={getLMSStatusColor(student.lms_status)}>
                               {getLMSStatusIcon(student.lms_status)}
                               {getLMSStatusLabel(student.lms_status)}
                             </Badge>
                            {student.fees_overdue && (
                              <Badge className="bg-orange-100 text-orange-800">
                                <Clock className="w-3 h-3 mr-1" />
                                Overdue
                              </Badge>
                            )}
                           <Badge className={getInstallmentStatus(student).color}>
                             <DollarSign className="w-3 h-3 mr-1" />
                             {getInstallmentStatus(student).status}
                           </Badge>
                         </div>
                       </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(student)}
                            title="Edit Student Details"
                            className="hover-scale hover:border-blue-300 hover:text-blue-600"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleRowExpansion(student.id)}
                            title={expandedRows.has(student.id) ? "Collapse" : "Expand"}
                            className="hover-scale hover:border-green-300 hover:text-green-600"
                          >
                            {expandedRows.has(student.id) ? 
                              <ChevronUp className="w-4 h-4" /> : 
                              <ChevronDown className="w-4 h-4" />
                            }
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    
                    {expandedRows.has(student.id) && (
                      <TableRow className="animate-accordion-down">
                        <TableCell colSpan={8} className="bg-gradient-to-r from-slate-50 to-blue-50 p-6 border-l-4 border-l-blue-200">
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              <div>
                                <Label className="text-sm font-medium text-gray-700">Last Invoice Sent Date</Label>
                                <p className="text-sm text-gray-900">{formatDate(student.last_invoice_date)}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-700">Joining Date</Label>
                                <p className="text-sm text-gray-900">{formatDate(student.created_at)}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-700">Invoice Status</Label>
                                <p className="text-sm text-gray-900">{getInvoiceStatus(student)}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-700">Fees Structure</Label>
                                <p className="text-sm text-gray-900">{getFeesStructureLabel(student.fees_structure)}</p>
                              </div>
                              {student.fees_due_date && (
                                <div>
                                  <Label className="text-sm font-medium text-gray-700">Invoice Due Date</Label>
                                  <p className={`text-sm ${student.fees_overdue ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
                                    {formatDate(student.fees_due_date)}
                                  </p>
                                </div>
                              )}
                              {student.last_suspended_date && (
                                <div>
                                  <Label className="text-sm font-medium text-gray-700">Last Suspended Date</Label>
                                  <p className="text-sm text-red-600">{formatDate(student.last_suspended_date)}</p>
                                </div>
                              )}
                              <div>
                                <Label className="text-sm font-medium text-gray-700">LMS User ID</Label>
                                <div className="flex items-center space-x-2">
                                  <p className="text-sm text-gray-900">{student.lms_user_id || 'Not set'}</p>
                                  {student.lms_user_id && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => navigator.clipboard.writeText(student.lms_user_id)}
                                    >
                                      <Key className="w-3 h-3" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-700">LMS Password</Label>
                                <div className="flex items-center space-x-2">
                                  <p className="text-sm text-gray-900">
                                    {student.lms_password ? '••••••••' : 'Not set'}
                                  </p>
                                  {student.lms_password && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => navigator.clipboard.writeText(student.lms_password)}
                                    >
                                      <Lock className="w-3 h-3" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {/* Installment Payment Buttons */}
                            {(student.fees_structure === '1_installment' || student.fees_structure === '2_installments' || student.fees_structure === '3_installments') && (
                              <div className="pt-3 border-t border-blue-200">
                                <Label className="text-sm font-medium text-gray-700 mb-2 block">Installment Payments</Label>
                                <div className="flex flex-wrap gap-2">
                                  {Array.from({ 
                                    length: student.fees_structure === '1_installment' ? 1 : 
                                           student.fees_structure === '2_installments' ? 2 : 3 
                                  }, (_, index) => {
                                    const installmentNumber = index + 1;
                                    const payments = installmentPayments.get(student.id) || [];
                                    const isPaid = payments.some(p => p.installment_number === installmentNumber && p.status === 'paid');
                                    
                                    return (
                                      <Button
                                        key={installmentNumber}
                                        variant={isPaid ? "default" : "outline"}
                                        size="sm"
                                        disabled={isPaid}
                                        onClick={() => handleMarkInstallmentPaid(student.id, installmentNumber)}
                                        className={`hover-scale ${isPaid ? "bg-green-500 hover:bg-green-600" : "hover:border-green-300 hover:text-green-600"}`}
                                      >
                                        {isPaid ? <CheckCircle className="w-4 h-4 mr-2" /> : <DollarSign className="w-4 h-4 mr-2" />}
                                        {isPaid ? `${installmentNumber}${installmentNumber === 1 ? 'st' : installmentNumber === 2 ? 'nd' : 'rd'} Paid` : `Mark ${installmentNumber}${installmentNumber === 1 ? 'st' : installmentNumber === 2 ? 'nd' : 'rd'} Paid`}
                                      </Button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            
                            <div className="flex flex-wrap gap-2 pt-4 border-t border-blue-200">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewActivityLogs(student.id)}
                                className="hover-scale hover:border-blue-300 hover:text-blue-600"
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                View Activity Logs
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => generateInvoice(student.id)}
                                className="hover-scale hover:border-purple-300 hover:text-purple-600"
                              >
                                <FileText className="w-4 h-4 mr-2" />
                                Generate Invoice
                              </Button>
                              {student.last_invoice_date && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => downloadInvoicePDF(student)}
                                  className="hover-scale hover:border-orange-300 hover:text-orange-600"
                                >
                                  <Download className="w-4 h-4 mr-2" />
                                  Download Invoice
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleStatusUpdate(student.id)}
                                className="hover-scale hover:border-blue-300 hover:text-blue-600"
                              >
                                <Settings className="w-4 h-4 mr-2" />
                                Update Status
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleToggleLMSSuspension(student.id, student.lms_status)}
                                className={`hover-scale ${student.lms_status === 'suspended' ? "text-green-600 hover:text-green-700 hover:border-green-300" : "text-red-600 hover:text-red-700 hover:border-red-300"}`}
                              >
                                {student.lms_status === 'suspended' ? (
                                  <>
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Activate LMS
                                  </>
                                ) : (
                                  <>
                                    <Ban className="w-4 h-4 mr-2" />
                                    Suspend LMS
                                  </>
                                 )}
                               </Button>
                               
                               <AlertDialog>
                                 <AlertDialogTrigger asChild>
                                   <Button
                                     variant="outline"
                                     size="sm"
                                     className="hover-scale text-red-600 hover:text-red-700 hover:border-red-300"
                                   >
                                     <Trash2 className="w-4 h-4 mr-2" />
                                     Delete Student
                                   </Button>
                                 </AlertDialogTrigger>
                                 <AlertDialogContent>
                                   <AlertDialogHeader>
                                     <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                     <AlertDialogDescription>
                                       This will permanently delete {student.full_name} and remove all their data. This action cannot be undone.
                                     </AlertDialogDescription>
                                   </AlertDialogHeader>
                                   <AlertDialogFooter>
                                     <AlertDialogCancel>Cancel</AlertDialogCancel>
                                     <AlertDialogAction
                                       onClick={() => handleDeleteStudent(student.id, student.full_name)}
                                       className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                     >
                                       Delete
                                     </AlertDialogAction>
                                   </AlertDialogFooter>
                                 </AlertDialogContent>
                               </AlertDialog>
                             </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Activity Logs Dialog */}
      <Dialog open={activityLogsDialog} onOpenChange={setActivityLogsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              Activity Logs - {selectedStudentForLogs?.full_name}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-96">
            <div className="space-y-4">
              {activityLogs.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No activity logs found for this student.
                </p>
              ) : (
                activityLogs.map((log) => (
                  <Card key={log.id} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium">{formatActivityType(log.activity_type)}</h4>
                        <p className="text-sm text-muted-foreground">
                          {formatDateTime(log.occurred_at)}
                        </p>
                      </div>
                      <Badge variant="outline">{log.activity_type}</Badge>
                    </div>
                    {log.metadata && (
                      <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                        <pre className="whitespace-pre-wrap">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Status Update Dialog */}
      <Dialog open={statusUpdateDialog} onOpenChange={setStatusUpdateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Update LMS Status - {selectedStudentForStatus?.full_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="lms_status">LMS Status</Label>
              <Select value={newLMSStatus} onValueChange={setNewLMSStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select LMS status" />
                </SelectTrigger>
                <SelectContent className="bg-white z-50">
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="dropout">Dropout</SelectItem>
                  <SelectItem value="complete">Complete</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setStatusUpdateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={saveStatusUpdate}>
                Update LMS Status
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}