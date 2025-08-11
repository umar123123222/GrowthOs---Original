import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { EnhancedStudentCreationDialog } from '@/components/EnhancedStudentCreationDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Plus, Edit, Trash2, Users, Activity, DollarSign, Download, CheckCircle, XCircle, Search, Filter, Clock, Ban, ChevronDown, ChevronUp, FileText, Key, Lock, Eye, Settings, Award } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useInstallmentOptions } from '@/hooks/useInstallmentOptions';
import { useUserManagement } from '@/hooks/useUserManagement';
import { useAuth } from '@/hooks/useAuth';
import jsPDF from 'jspdf';
interface Student {
  id: string;
  student_id: string;
  student_record_id?: string | null;
  full_name: string;
  email: string;
  phone: string;
  lms_user_id: string;
  password_display: string;
  created_at: string;
  last_active_at: string;
  fees_structure: string;
  lms_status: string;
  fees_overdue: boolean;
  last_invoice_date: string;
  last_invoice_sent: boolean;
  fees_due_date: string;
  last_suspended_date: string;
  created_by?: string | null;
  creator?: {
    full_name: string;
    email: string;
  } | null;
}
interface InstallmentPayment {
  id: string;
  installment_number: number;
  amount: number;
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
  const {
    toast
  } = useToast();
  const {
    deleteMultipleUsers,
    loading: userManagementLoading
  } = useUserManagement();
  const {
    user
  } = useAuth();
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
  const [passwordEditDialog, setPasswordEditDialog] = useState(false);
  const [selectedStudentForPassword, setSelectedStudentForPassword] = useState<Student | null>(null);
  const [passwordType, setPasswordType] = useState<'temp' | 'lms'>('temp');
  const [newPassword, setNewPassword] = useState('');
  const [editDialog, setEditDialog] = useState(false);
  const [editFormData, setEditFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    lms_user_id: '',
    lms_status: 'inactive'
  });
  const [timeTick, setTimeTick] = useState(0);
  const { options: installmentOptions } = useInstallmentOptions();

  // Debug: Ensure statusFilter is completely removed
  console.log('StudentsManagement component loaded - statusFilter removed');
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

  // Re-render periodically so time-based invoice statuses update without refresh
  useEffect(() => {
    const id = setInterval(() => setTimeTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const channel = supabase.channel('realtime-invoices-superadmin').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'invoices'
    }, () => {
      fetchInstallmentPayments();
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
  const fetchInstallmentPayments = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('invoices').select('*').order('installment_number', {
        ascending: true
      });
      if (error) throw error;

      // Group payments by student_id and transform to InstallmentPayment format
      const paymentsMap = new Map<string, InstallmentPayment[]>();
      data?.forEach(invoice => {
        const payment: InstallmentPayment = {
          id: invoice.id,
          installment_number: invoice.installment_number,
          amount: invoice.amount,
          status: invoice.status
        };
        const userPayments = paymentsMap.get(invoice.student_id) || [];
        userPayments.push(payment);
        paymentsMap.set(invoice.student_id, userPayments);
      });
      setInstallmentPayments(paymentsMap);
    } catch (error) {
      console.error('Error fetching installment payments:', error);
    }
  };
  const fetchStudents = async () => {
    try {
      // Fetch students with creator information and student details
      const {
        data,
        error
      } = await supabase.from('users').select(`
          *,
          creator:created_by (
            full_name,
            email
          ),
          students (
            id,
            installment_count,
            student_id,
            lms_username
          )
        `).eq('role', 'student').order('created_at', {
        ascending: false
      });
      if (error) throw error;

      // Transform the data to include creator information and proper fees structure
      const studentsWithCreators: Student[] = (data || []).map(student => {
        const studentRecord = student.students?.[0]; // Get first student record
        const installmentCount = studentRecord?.installment_count || 1;
        const feesStructure = installmentCount === 1 ? '1_installment' : installmentCount === 2 ? '2_installments' : installmentCount === 3 ? '3_installments' : '1_installment';
        return {
          ...student,
          student_id: studentRecord?.student_id || student.lms_user_id || '',
          student_record_id: studentRecord?.id || null,
          phone: student.phone || '',
          password_display: student.password_display || '',
          fees_structure: feesStructure,
          fees_overdue: false,
          last_invoice_date: '',
          last_invoice_sent: false,
          fees_due_date: '',
          last_suspended_date: '',
          created_by: student.created_by || null,
          creator: student.creator || null
        };
      });
      setStudents(studentsWithCreators);
      setTotalStudents(data?.length || 0);

      // Calculate active students (those who have been active in the last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const activeCount = data?.filter(student => student.last_active_at && new Date(student.last_active_at) > thirtyDaysAgo).length || 0;
      setActiveStudents(activeCount);

      // Calculate suspended and overdue students
      const suspendedCount = data?.filter(student => student.lms_status === 'suspended').length || 0;
      // Note: fees_overdue not available in users table, defaulting to 0
      const overdueCount = 0;
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
      filtered = filtered.filter(student => student.student_id?.toLowerCase().includes(searchTerm.toLowerCase()) || student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || student.email.toLowerCase().includes(searchTerm.toLowerCase()) || student.phone?.toLowerCase().includes(searchTerm.toLowerCase()));
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
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this student?')) return;
    try {
      const {
        error
      } = await supabase.from('users').delete().eq('id', id);
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
      const {
        error
      } = await supabase.from('users').update({
        lms_status: 'suspended',
        last_suspended_date: new Date().toISOString()
      }).eq('id', studentId);
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
      const {
        error
      } = await supabase.from('users').update({
        updated_at: new Date().toISOString()
      }).eq('id', studentId);
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
  const handleResendInvoice = async (student: Student) => {
    try {
      if (!student.student_record_id) {
        toast({
          title: 'Error',
          description: 'No student record to find invoices',
          variant: 'destructive'
        });
        return;
      }
      const {
        data: invoice,
        error
      } = await supabase.from('invoices').select('*').eq('student_id', student.student_record_id).eq('status', 'issued').order('created_at', {
        ascending: false
      }).limit(1).maybeSingle();
      if (error) throw error;
      if (!invoice) {
        toast({
          title: 'No Issued Invoice',
          description: 'This student has no issued invoices to resend.',
          variant: 'destructive'
        });
        return;
      }
      const {
        error: rpcError
      } = await supabase.rpc('create_notification', {
        p_user_id: student.id,
        p_type: 'invoice_issued',
        p_title: 'Invoice Issued',
        p_message: `Invoice #${invoice.installment_number || ''} has been re-sent.`,
        p_metadata: {
          invoice_id: invoice.id,
          student_user_id: student.id,
          amount: invoice.amount,
          due_date: invoice.due_date,
          installment_number: invoice.installment_number,
          resent: true
        }
      });
      if (rpcError) throw rpcError;
      toast({
        title: 'Success',
        description: 'Invoice re-sent to student.'
      });
    } catch (e) {
      console.error('Error resending invoice:', e);
      toast({
        title: 'Error',
        description: 'Failed to resend invoice',
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
      const {
        error
      } = await supabase.from('users').delete().eq('id', studentId);
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
        lms_status: newLMSStatus
      };
      const {
        error
      } = await supabase.from('users').update(updateData).eq('id', studentId);
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
      const {
        data,
        error
      } = await supabase.from('user_activity_logs').select('*').eq('user_id', studentId).order('occurred_at', {
        ascending: false
      }).limit(50);
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
      const {
        error
      } = await supabase.from('users').update(updateData).eq('id', selectedStudentForStatus.id);
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
    return 'No Invoice';
  };
  const getInstallmentStatus = (student: Student) => {
    const payments = installmentPayments.get(student.id) || [];
    const totalInstallments = student.fees_structure === '2_installments' ? 2 : student.fees_structure === '3_installments' ? 3 : 1;
    if (payments.length === 0) {
      return {
        status: getInvoiceStatus(student),
        color: 'bg-gray-100 text-gray-800'
      };
    }
    const paidPayments = payments.filter(p => p.status === 'paid');
    if (paidPayments.length === totalInstallments) {
      return {
        status: 'Fees Cleared',
        color: 'bg-green-100 text-green-800'
      };
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
    return {
      status: getInvoiceStatus(student),
      color: 'bg-orange-100 text-orange-800'
    };
  };
  const handleMarkInstallmentPaid = async (studentId: string, installmentNumber: number) => {
    try {
      const student = students.find(s => s.id === studentId);
      if (!student) return;

      // Check if this installment payment already exists
      const {
        data: existingPayment
      } = await supabase.from('invoices').select('id').eq('student_id', studentId).eq('installment_number', installmentNumber).eq('status', 'paid').single();
      if (existingPayment) {
        toast({
          title: "Already Paid",
          description: "This installment has already been marked as paid",
          variant: "destructive"
        });
        return;
      }
      const totalInstallments = student.fees_structure === '2_installments' ? 2 : student.fees_structure === '3_installments' ? 3 : 1;
      const {
        error
      } = await supabase.from('invoices').insert({
        student_id: studentId,
        installment_number: installmentNumber,
        amount: 0,
        // You can set actual amount based on your business logic
        status: 'paid',
        due_date: new Date().toISOString()
      });
      if (error) throw error;

      // If this is the first installment, activate LMS status
      if (installmentNumber === 1) {
        await supabase.from('users').update({
          lms_status: 'active'
        }).eq('id', studentId);
      }

      // If this is the last installment, update the user's status  
      if (installmentNumber === totalInstallments) {
        await supabase.from('users').update({
          updated_at: new Date().toISOString()
        }).eq('id', studentId);
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
      const {
        error
      } = await supabase.from('users').update({
        lms_status
      }).in('id', Array.from(selectedStudents));
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
  const handleBulkDelete = async () => {
    if (selectedStudents.size === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one student',
        variant: 'destructive'
      });
      return;
    }
    const confirmMessage = `Are you sure you want to permanently delete ${selectedStudents.size} student(s)? This action cannot be undone.`;
    if (!confirm(confirmMessage)) return;
    const userIds = Array.from(selectedStudents);
    const result = await deleteMultipleUsers(userIds);
    if (result.success > 0) {
      setSelectedStudents(new Set());
      fetchStudents();
    }
  };
  const handleEditStudent = (student: Student) => {
    setEditingStudent(student);
    setEditFormData({
      full_name: student.full_name,
      email: student.email,
      phone: student.phone || '',
      lms_user_id: student.lms_user_id || '',
      lms_status: student.lms_status
    });
    setEditDialog(true);
  };
  const handleUpdateStudent = async () => {
    if (!editingStudent) return;
    try {
      const {
        error
      } = await supabase.from('users').update({
        full_name: editFormData.full_name,
        email: editFormData.email,
        phone: editFormData.phone,
        lms_user_id: editFormData.lms_user_id,
        lms_status: editFormData.lms_status,
        updated_at: new Date().toISOString()
      }).eq('id', editingStudent.id);
      if (error) throw error;
      toast({
        title: "Success",
        description: "Student details updated successfully"
      });
      setEditDialog(false);
      setEditingStudent(null);
      fetchStudents();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to update student details: " + error.message,
        variant: "destructive"
      });
    }
  };
  const handleEditPassword = (student: Student, type: 'temp' | 'lms') => {
    // Password functionality removed for security
    toast({
      title: "Information",
      description: "Password management has been moved to secure encrypted storage",
      variant: "default"
    });
  };
  const handleUpdatePassword = async () => {
    if (!selectedStudentForPassword || !newPassword.trim()) {
      toast({
        title: "Error",
        description: "Please enter a password",
        variant: "destructive"
      });
      return;
    }
    try {
      const updateField = passwordType === 'temp' ? 'temp_password' : 'lms_password';
      const {
        error
      } = await supabase.from('users').update({
        [updateField]: newPassword
      }).eq('id', selectedStudentForPassword.id);
      if (error) throw error;
      toast({
        title: "Success",
        description: `${passwordType === 'temp' ? 'Temporary' : 'LMS'} password updated successfully`
      });
      setPasswordEditDialog(false);
      setNewPassword('');
      setSelectedStudentForPassword(null);
      fetchStudents();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to update password: " + error.message,
        variant: "destructive"
      });
    }
  };
  if (loading) {
    return <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-muted-foreground">Loading students...</span>
      </div>;
  }
  const displayStudents = filteredStudents.length > 0 ? filteredStudents : students;
  return <div className="flex-1 min-w-0 p-6 space-y-6 animate-fade-in overflow-x-hidden bg-slate-50 px-0">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
        <div className="animate-fade-in">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            👥 Students Management
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">Manage student records and track their progress</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button onClick={() => setIsDialogOpen(true)} className="hover-scale bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 animate-scale-in">
            <Plus className="w-4 h-4 mr-2" />
            Add Student
          </Button>
        </div>
        
        <EnhancedStudentCreationDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} onStudentCreated={fetchStudents} />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
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
              {totalStudents > 0 ? Math.round(activeStudents / totalStudents * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">Activity rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4 items-center flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by ID, name, email, or phone..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
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
            <SelectItem value="all">All Installments</SelectItem>
            {installmentOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
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
      {selectedStudents.size > 0 && <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-blue-800">
                  {selectedStudents.size} student(s) selected
                </span>
                <Button variant="outline" size="sm" onClick={() => setSelectedStudents(new Set())} className="text-blue-600 border-blue-300 hover:bg-blue-100">
                  Clear Selection
                </Button>
              </div>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" onClick={() => handleBulkLMSAction('suspend')} className="text-red-600 border-red-300 hover:bg-red-50">
                  <Ban className="w-4 h-4 mr-2" />
                  Suspend LMS
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleBulkLMSAction('activate')} className="text-green-600 border-green-300 hover:bg-green-50">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Activate LMS
                </Button>
                <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={userManagementLoading} className="hover:bg-red-600">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Students
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>}

      {/* Students Table */}
      <Card className="w-full hover-scale transition-all duration-300 hover:shadow-lg animate-fade-in">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50 border-b">
          <CardTitle className="flex items-center text-xl">
            <Users className="w-5 h-5 mr-2 text-blue-600" />
            Students Directory ({displayStudents.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="w-full p-0">
          <div className="w-full">
            <Table className="w-full table-auto">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox checked={selectedStudents.size === displayStudents.length && displayStudents.length > 0} onCheckedChange={handleSelectAll} />
                  </TableHead>
                  <TableHead>Student ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Fees Structure</TableHead>
                  <TableHead>LMS Status</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayStudents.map(student => {
                const rowElements = [<TableRow key={`main-${student.id}`}>
                      <TableCell>
                        <Checkbox checked={selectedStudents.has(student.id)} onCheckedChange={checked => handleSelectStudent(student.id, checked as boolean)} />
                      </TableCell>
                      <TableCell className="font-medium whitespace-normal break-words">{student.student_id}</TableCell>
                      <TableCell className="whitespace-normal break-words">{student.full_name}</TableCell>
                      <TableCell className="whitespace-normal break-words">{student.email}</TableCell>
                      <TableCell className="whitespace-normal break-words">{student.phone || 'N/A'}</TableCell>
                       <TableCell>{getFeesStructureLabel(student.fees_structure)}</TableCell>
                        <TableCell>
                           <div className="flex flex-wrap gap-2">
                             <Badge className={getLMSStatusColor(student.lms_status)}>
                               <div className="flex items-center">
                                 {getLMSStatusIcon(student.lms_status)}
                                 <span className="text-xs font-medium">{getLMSStatusLabel(student.lms_status)}</span>
                               </div>
                             </Badge>
                             {student.fees_overdue && <Badge variant="destructive">
                                 <DollarSign className="w-3 h-3 mr-1" />
                                 <span className="text-xs">Fees Due</span>
                               </Badge>}
                           </div>
                         </TableCell>
                         <TableCell>{student.creator?.full_name || 'System'}</TableCell>
                         <TableCell>
                           <div className="flex space-x-1">
                              <Button variant="outline" size="sm" onClick={() => {
                        // Check if user has permission to edit
                        if (user?.role === 'admin' || user?.role === 'superadmin') {
                          handleEditStudent(student);
                        } else {
                          toast({
                            title: "Access Denied",
                            description: "Only admins and superadmins can edit student details.",
                            variant: "destructive"
                          });
                        }
                      }} title="Edit Student Details" className="hover-scale hover:border-blue-300 hover:text-blue-600">
                                <Edit className="w-4 h-4" />
                              </Button>
                            <Button variant="outline" size="sm" onClick={() => toggleRowExpansion(student.id)} title={expandedRows.has(student.id) ? "Collapse" : "Expand"} className="hover-scale hover:border-green-300 hover:text-green-600">
                              {expandedRows.has(student.id) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>];
                if (expandedRows.has(student.id)) {
                  rowElements.push(<TableRow key={`expanded-${student.id}`} className="animate-accordion-down">
                         <TableCell colSpan={9} className="w-full bg-gradient-to-r from-slate-50 to-blue-50 p-0 border-l-4 border-l-blue-200">
                          <div className="w-full space-y-3 p-4 box-border">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
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
                              {student.fees_due_date && <div>
                                  <Label className="text-sm font-medium text-gray-700">Invoice Due Date</Label>
                                  <p className={`text-sm ${student.fees_overdue ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
                                    {formatDate(student.fees_due_date)}
                                  </p>
                                </div>}
                              {student.last_suspended_date && <div>
                                  <Label className="text-sm font-medium text-gray-700">Last Suspended Date</Label>
                                  <p className="text-sm text-red-600">{formatDate(student.last_suspended_date)}</p>
                                </div>}
                              <div>
                                <Label className="text-sm font-medium text-gray-700">LMS User ID</Label>
                                <div className="flex items-center space-x-2">
                                  <p className="text-sm text-gray-900">{student.lms_user_id || 'Not set'}</p>
                                  {student.lms_user_id && <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(student.lms_user_id)}>
                                      <Key className="w-3 h-3" />
                                    </Button>}
                                </div>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-700">LMS Password</Label>
                                <div className="flex items-center space-x-2">
                                  <p className="text-sm text-gray-900 font-mono bg-gray-50 px-3 py-2 rounded border">
                                    {student.password_display || 'Not set'}
                                  </p>
                                  {student.password_display && <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(student.password_display)} title="Copy password">
                                      <Key className="w-3 h-3" />
                                    </Button>}
                                </div>
                              </div>
                            </div>
                            
                            {/* Installment Payment Buttons */}
                            {(student.fees_structure === '1_installment' || student.fees_structure === '2_installments' || student.fees_structure === '3_installments') && <div className="pt-3 border-t border-blue-200">
                                <Label className="text-sm font-medium text-gray-700 mb-2 block">Installment Payments</Label>
                                <div className="flex flex-wrap gap-2">
                                  {Array.from({
                              length: student.fees_structure === '1_installment' ? 1 : student.fees_structure === '2_installments' ? 2 : 3
                            }, (_, index) => {
                              const installmentNumber = index + 1;
                              const payments = installmentPayments.get(student.id) || [];
                              const isPaid = payments.some(p => p.installment_number === installmentNumber && p.status === 'paid');
                              return <Button key={installmentNumber} variant={isPaid ? "default" : "outline"} size="sm" disabled={isPaid} onClick={() => handleMarkInstallmentPaid(student.id, installmentNumber)} className={`hover-scale ${isPaid ? "bg-green-500 hover:bg-green-600" : "hover:border-green-300 hover:text-green-600"}`}>
                                        {isPaid ? <CheckCircle className="w-4 h-4 mr-2" /> : <DollarSign className="w-4 h-4 mr-2" />}
                                        {isPaid ? `${installmentNumber}${installmentNumber === 1 ? 'st' : installmentNumber === 2 ? 'nd' : 'rd'} Paid` : `Mark ${installmentNumber}${installmentNumber === 1 ? 'st' : installmentNumber === 2 ? 'nd' : 'rd'} Paid`}
                                      </Button>;
                            })}
                                </div>
                              </div>}
                            
                            <div className="flex flex-wrap gap-2 pt-3 border-t border-blue-200">
                              <Button variant="outline" size="sm" onClick={() => handleViewActivityLogs(student.id)} className="hover-scale hover:border-blue-300 hover:text-blue-600">
                                <Eye className="w-4 h-4 mr-2" />
                                View Activity Logs
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleResendInvoice(student)} className="hover-scale hover:border-purple-300 hover:text-purple-600">
                                <FileText className="w-4 h-4 mr-2" />
                                Resend Invoice
                              </Button>
                              {student.last_invoice_date && <Button variant="outline" size="sm" onClick={() => downloadInvoicePDF(student)} className="hover-scale hover:border-orange-300 hover:text-orange-600">
                                  <Download className="w-4 h-4 mr-2" />
                                  Download Invoice
                                </Button>}
                              <Button variant="outline" size="sm" onClick={() => handleStatusUpdate(student.id)} className="hover-scale hover:border-blue-300 hover:text-blue-600">
                                <Settings className="w-4 h-4 mr-2" />
                                Update Status
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleToggleLMSSuspension(student.id, student.lms_status)} className={`hover-scale ${student.lms_status === 'suspended' ? "text-green-600 hover:text-green-700 hover:border-green-300" : "text-red-600 hover:text-red-700 hover:border-red-300"}`}>
                                {student.lms_status === 'suspended' ? <>
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Activate LMS
                                  </> : <>
                                    <Ban className="w-4 h-4 mr-2" />
                                    Suspend LMS
                                  </>}
                               </Button>
                               
                               <AlertDialog>
                                 <AlertDialogTrigger asChild>
                                   <Button variant="outline" size="sm" className="hover-scale text-red-600 hover:text-red-700 hover:border-red-300">
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
                                     <AlertDialogAction onClick={() => handleDeleteStudent(student.id, student.full_name)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                       Delete
                                     </AlertDialogAction>
                                   </AlertDialogFooter>
                                 </AlertDialogContent>
                               </AlertDialog>
                             </div>
                          </div>
                        </TableCell>
                      </TableRow>);
                }
                return rowElements;
              })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Activity Logs Dialog */}
      <Dialog open={activityLogsDialog} onOpenChange={setActivityLogsDialog}>
        <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
            <DialogTitle className="text-xl font-semibold text-primary">
              Activity Logs - {selectedStudentForLogs?.full_name}
            </DialogTitle>
            <Button variant="outline" size="sm" className="ml-auto hover:bg-primary/10">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </DialogHeader>
          
          <div className="space-y-4 overflow-hidden flex flex-col">
            {/* Search and Filters */}
            <div className="flex gap-4 items-center flex-wrap bg-muted/30 p-4 rounded-lg">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by user or activity..." className="pl-10 bg-background" />
              </div>
              
              <Select defaultValue="last_7_days">
                <SelectTrigger className="w-32 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border z-50">
                  <SelectItem value="last_7_days">Last 7 days</SelectItem>
                  <SelectItem value="last_30_days">Last 30 days</SelectItem>
                  <SelectItem value="all_time">All time</SelectItem>
                </SelectContent>
              </Select>

              <Select defaultValue="all_roles">
                <SelectTrigger className="w-32 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border z-50">
                  <SelectItem value="all_roles">All Roles</SelectItem>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="mentor">Mentor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>

              <Select defaultValue="all_activities">
                <SelectTrigger className="w-36 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border z-50 max-h-60">
                  <SelectItem value="all_activities">All Activities</SelectItem>
                  <SelectItem value="login">Login</SelectItem>
                  <SelectItem value="logout">Logout</SelectItem>
                  <SelectItem value="page_visit">Page Visit</SelectItem>
                  <SelectItem value="profile_updated">Profile Updated</SelectItem>
                  <SelectItem value="module_completed">Module Completed</SelectItem>
                  <SelectItem value="video_watched">Video Watched</SelectItem>
                  <SelectItem value="quiz_attempted">Quiz Attempted</SelectItem>
                  <SelectItem value="assignment_submitted">Assignment Submitted</SelectItem>
                  <SelectItem value="certificate_generated">Certificate Generated</SelectItem>
                  <SelectItem value="fees_recorded">Fees Recorded</SelectItem>
                  <SelectItem value="invoice_generated">Invoice Generated</SelectItem>
                  <SelectItem value="invoice_downloaded">Invoice Downloaded</SelectItem>
                  <SelectItem value="file_download">File Download</SelectItem>
                  <SelectItem value="dashboard_access">Dashboard Access</SelectItem>
                  <SelectItem value="session_joined">Session Joined</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Results Count */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {activityLogs.length} of {activityLogs.length} activities
              </p>
            </div>

            {/* Activity Logs Table */}
            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-[50vh] border rounded-lg bg-background">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted/50 z-10">
                    <TableRow className="border-b">
                      <TableHead className="w-36 font-semibold">Timestamp</TableHead>
                      <TableHead className="w-64 font-semibold">User</TableHead>
                      <TableHead className="w-48 font-semibold">Name</TableHead>
                      <TableHead className="w-20 font-semibold">Role</TableHead>
                      <TableHead className="w-32 font-semibold">Activity</TableHead>
                      <TableHead className="font-semibold">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activityLogs.length === 0 ? <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                          <div className="flex flex-col items-center space-y-2">
                            <Activity className="w-8 h-8 text-muted-foreground/50" />
                            <p>No activity logs found for this student.</p>
                          </div>
                        </TableCell>
                      </TableRow> : activityLogs.map((log, index) => <TableRow key={log.id} className={index % 2 === 0 ? "bg-muted/20" : "bg-background"}>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDateTime(log.occurred_at)}
                          </TableCell>
                          <TableCell className="text-sm font-mono text-primary/80">
                            {selectedStudentForLogs?.email}
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            {selectedStudentForLogs?.full_name}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                              student
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-xs ${log.activity_type === 'login' ? 'bg-green-100 text-green-800 border-green-200' : log.activity_type === 'logout' ? 'bg-red-100 text-red-800 border-red-200' : log.activity_type === 'page_visit' ? 'bg-blue-100 text-blue-800 border-blue-200' : log.activity_type === 'video_watched' ? 'bg-purple-100 text-purple-800 border-purple-200' : log.activity_type === 'assignment_submitted' ? 'bg-orange-100 text-orange-800 border-orange-200' : log.activity_type === 'module_completed' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-gray-100 text-gray-800 border-gray-200'}`}>
                              {log.activity_type.replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm max-w-md">
                            <div className="truncate">
                              {(() => {
                          const metadata = log.metadata || {};
                          switch (log.activity_type) {
                            case 'page_visit':
                              return `Visited page: ${metadata.page || metadata.url || 'Unknown page'}`;
                            case 'video_watched':
                              return `Watched video: "${metadata.video_title || metadata.title || 'Unknown video'}" ${metadata.duration ? `(${metadata.duration})` : ''}`;
                            case 'assignment_submitted':
                              return `Submitted assignment: "${metadata.assignment_title || metadata.title || 'Unknown assignment'}" ${metadata.score ? `(Score: ${metadata.score})` : ''}`;
                            case 'module_completed':
                              return `Completed module: "${metadata.module_title || metadata.title || 'Unknown module'}" ${metadata.completion_percentage ? `(${metadata.completion_percentage}%)` : ''}`;
                            case 'quiz_attempted':
                              return `Attempted quiz: "${metadata.quiz_title || metadata.title || 'Unknown quiz'}" ${metadata.score ? `(Score: ${metadata.score}/${metadata.total_questions || 'N/A'})` : ''}`;
                            case 'certificate_generated':
                              return `Generated certificate for: "${metadata.course_title || metadata.title || 'Unknown course'}"`;
                            case 'fees_recorded':
                              return `Fees recorded: ${metadata.amount ? `$${metadata.amount}` : 'Amount not specified'} ${metadata.type ? `(${metadata.type})` : ''}`;
                            case 'invoice_generated':
                              return `Invoice generated: ${metadata.invoice_id || 'ID not specified'} ${metadata.amount ? `for $${metadata.amount}` : ''}`;
                            case 'file_download':
                              return `Downloaded file: "${metadata.filename || metadata.file_name || 'Unknown file'}" ${metadata.file_size ? `(${metadata.file_size})` : ''}`;
                            case 'session_joined':
                              return `Joined session: "${metadata.session_title || metadata.title || 'Unknown session'}" ${metadata.duration ? `(Duration: ${metadata.duration})` : ''}`;
                            case 'login':
                              return `Logged in ${metadata.ip_address ? `from ${metadata.ip_address}` : ''} ${metadata.device ? `on ${metadata.device}` : ''}`;
                            case 'logout':
                              return `Logged out ${metadata.session_duration ? `(Session: ${metadata.session_duration})` : ''}`;
                            case 'profile_updated':
                              return `Updated profile ${metadata.fields_changed ? `(Changed: ${metadata.fields_changed.join(', ')})` : ''}`;
                            case 'dashboard_access':
                              return `Accessed dashboard ${metadata.section ? `(Section: ${metadata.section})` : ''}`;
                            default:
                              return formatActivityType(log.activity_type);
                          }
                        })()}
                            </div>
                          </TableCell>
                        </TableRow>)}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </div>
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

      {/* Student Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Edit Student Details - {editingStudent?.full_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_full_name">Full Name</Label>
                <Input id="edit_full_name" value={editFormData.full_name} onChange={e => setEditFormData({
                ...editFormData,
                full_name: e.target.value
              })} placeholder="Enter full name" />
              </div>
              <div>
                <Label htmlFor="edit_email">Email</Label>
                <Input id="edit_email" type="email" value={editFormData.email} onChange={e => setEditFormData({
                ...editFormData,
                email: e.target.value
              })} placeholder="Enter email" />
              </div>
              <div>
                <Label htmlFor="edit_phone">Phone</Label>
                <Input id="edit_phone" value={editFormData.phone} onChange={e => setEditFormData({
                ...editFormData,
                phone: e.target.value
              })} placeholder="Enter phone number" />
              </div>
              <div>
                <Label htmlFor="edit_lms_user_id">LMS User ID</Label>
                <Input id="edit_lms_user_id" value={editFormData.lms_user_id} onChange={e => setEditFormData({
                ...editFormData,
                lms_user_id: e.target.value
              })} placeholder="Enter LMS User ID" />
              </div>
              <div>
                <Label htmlFor="edit_lms_status">LMS Status</Label>
                <Select value={editFormData.lms_status} onValueChange={value => setEditFormData({
                ...editFormData,
                lms_status: value
              })}>
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
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => {
              setEditDialog(false);
              setEditingStudent(null);
            }}>
                Cancel
              </Button>
              <Button onClick={handleUpdateStudent}>
                Update Student
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Password Edit Dialog */}
      <Dialog open={passwordEditDialog} onOpenChange={setPasswordEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Edit {passwordType === 'temp' ? 'Temporary' : 'LMS'} Password - {selectedStudentForPassword?.full_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="password">
                {passwordType === 'temp' ? 'Temporary Password' : 'LMS Password'}
              </Label>
              <Input id="password" type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Enter new password" />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => {
              setPasswordEditDialog(false);
              setNewPassword('');
              setSelectedStudentForPassword(null);
            }}>
                Cancel
              </Button>
              <Button onClick={handleUpdatePassword}>
                Update Password
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>;
}