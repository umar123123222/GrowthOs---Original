import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, TrendingUp, AlertTriangle, Download, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Invoice {
  id: string;
  student_id: string | null;
  installment_number: number;
  amount: number;
  due_date: string;
  status: string;
  payment_date: string | null;
  users: {
    email: string;
  };
}

export const FinancialManagement = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stats, setStats] = useState({
    totalRevenue: 0,
    pendingAmount: 0,
    overdueAmount: 0,
    collectionRate: 0
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchInvoices();
    calculateStats();
  }, []);

const fetchInvoices = async () => {
  setLoading(true);
  try {
    const { data: invData, error: invErr } = await supabase
      .from('invoices')
      .select('id, student_id, installment_number, amount, due_date, status, paid_at');
    if (invErr) throw invErr;

    const invoicesRaw = invData || [];
    const studentIds = Array.from(new Set(invoicesRaw.map((i: any) => i.student_id).filter(Boolean)));

    let studentMap = new Map<string, string>(); // student_id -> user_id
    let emailMap = new Map<string, string>();   // user_id -> email

    if (studentIds.length) {
      const [{ data: students, error: sErr }, { data: users, error: uErr }] = await Promise.all([
        supabase.from('students').select('id, user_id').in('id', studentIds),
        supabase.from('users').select('id, email')
      ]);
      if (sErr) throw sErr;
      if (uErr) throw uErr;

      (students || []).forEach((s: any) => studentMap.set(s.id, s.user_id));
      (users || []).forEach((u: any) => emailMap.set(u.id, u.email));
    }

    const mapped: Invoice[] = (invoicesRaw as any[]).map((row: any) => {
      const userId = row.student_id ? (studentMap.get(row.student_id) || '') : '';
      const email = userId ? (emailMap.get(userId) || '') : '';
      return {
        id: row.id,
        student_id: row.student_id || null,
        installment_number: row.installment_number,
        amount: Number(row.amount || 0),
        due_date: row.due_date,
        status: row.status,
        payment_date: row.paid_at,
        users: { email }
      };
    });

    setInvoices(mapped);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    toast({ title: 'Error', description: 'Failed to fetch invoices', variant: 'destructive' });
  } finally {
    setLoading(false);
  }
};

const calculateStats = async () => {
  try {
    const now = new Date();
    const totalRevenue = invoices
      .filter(i => i.status === 'paid')
      .reduce((sum, i) => sum + (i.amount || 0), 0);
    const pendingAmount = invoices
      .filter(i => i.status !== 'paid')
      .reduce((sum, i) => sum + (i.amount || 0), 0);
    const overdueAmount = invoices
      .filter(i => i.status !== 'paid' && i.due_date && new Date(i.due_date) < now)
      .reduce((sum, i) => sum + (i.amount || 0), 0);
    const collectionRate = invoices.length
      ? (totalRevenue / (totalRevenue + pendingAmount + overdueAmount)) * 100
      : 0;

    setStats({ totalRevenue, pendingAmount, overdueAmount, collectionRate });
  } catch (error) {
    console.error('Error calculating stats:', error);
  }
};

const updateInvoiceStatus = async (invoiceId: string, status: string) => {
  try {
    if (status === 'paid') {
      // Use the edge function to properly mark as paid, update fees_cleared, and activate user
      console.log('Calling mark-invoice-paid edge function for invoice:', invoiceId);
      
      const { data, error } = await supabase.functions.invoke('mark-invoice-paid', {
        body: { invoice_id: invoiceId }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Failed to mark invoice as paid');
      }

      if (!data?.success) {
        console.error('Payment processing failed:', data?.error);
        throw new Error(data?.error || 'Failed to process payment');
      }

      console.log('Payment processed successfully:', data);
      toast({ title: 'Success', description: 'Invoice marked as paid and student account activated' });
    } else {
      // For other status updates, use direct update
      const updates: any = { status };
      if (status !== 'paid') {
        updates.paid_at = null;
      }

      const { error } = await supabase
        .from('invoices')
        .update(updates)
        .eq('id', invoiceId);
      
      if (error) throw error;
      toast({ title: 'Success', description: 'Invoice status updated' });
    }

    await fetchInvoices();
    await calculateStats();
  } catch (error: any) {
    console.error('Error updating invoice:', error);
    toast({ 
      title: 'Error', 
      description: error?.message || 'Failed to update invoice', 
      variant: 'destructive' 
    });
  }
};

const getStatusBadge = (status: string) => {
  const statusConfig: any = {
    paid: { color: 'bg-green-500', label: 'Paid' },
    pending: { color: 'bg-yellow-500', label: 'Pending' },
    issued: { color: 'bg-amber-500', label: 'Issued' },
    overdue: { color: 'bg-red-500', label: 'Overdue' },
    failed: { color: 'bg-gray-500', label: 'Failed' }
  };
  const config = statusConfig[status] || { color: 'bg-gray-500', label: status };
  return (
    <Badge className={config.color}>
      {config.label}
    </Badge>
  );
};

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = invoice.users?.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading financial data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">From paid invoices</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Amount</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.pendingAmount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Awaiting payment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Amount</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">${stats.overdueAmount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Requires attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.collectionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Payment success rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Invoice Management */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Invoice Management</CardTitle>
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-4">
            <div className="flex items-center space-x-2">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="issued">Issued</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student Email</TableHead>
                <TableHead>Installment</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>{invoice.users?.email}</TableCell>
                  <TableCell>Installment {invoice.installment_number}</TableCell>
                  <TableCell>${invoice.amount}</TableCell>
                  <TableCell>{new Date(invoice.due_date).toLocaleDateString()}</TableCell>
                  <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                  <TableCell>
                    {invoice.payment_date ? new Date(invoice.payment_date).toLocaleDateString() : 'N/A'}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={invoice.status}
                      onValueChange={(value) => updateInvoiceStatus(invoice.id, value)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="issued">Issued</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="overdue">Overdue</SelectItem>
                          <SelectItem value="failed">Failed</SelectItem>
                        </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};