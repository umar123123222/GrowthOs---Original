import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { CalendarIcon, Search, DollarSign, Users, TrendingUp, Download, ChevronLeft, ChevronRight, Clock, Undo2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { RefundDialog } from './RefundDialog';
import { MarkPaidDialog } from './MarkPaidDialog';
import { logAdminAction } from '@/lib/activity-logger';
import { useAuth } from '@/hooks/useAuth';
import { fetchAll } from '@/lib/fetch-all';
import { TablePager } from '@/components/common/TablePager';


interface InvoiceRecord {
  id: string;
  studentId: string;            // human STU id
  studentDbId: string | null;   // students.id
  studentName: string;
  email: string;
  courseName: string;
  pathwayName: string | null;
  paymentDate: string | null;
  dueDate: string;
  extendedDueDate: string | null;
  amount: number;
  installmentNumber: number;
  status: string;
}

interface PaymentStats {
  totalPayments: number;
  totalAmount: number;
  newEnrollments: number;
  avgPaymentAmount: number;
  pendingAmount: number;
  overdueAmount: number;
  refundedCount: number;
  refundedAmount: number;
}

export const PaymentReports = () => {
  const [records, setRecords] = useState<InvoiceRecord[]>([]);
  const [refundsInRange, setRefundsInRange] = useState<{ amount: number; courseId: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });
  const [tempDateRange, setTempDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [currency, setCurrency] = useState('PKR');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const [extensionDate, setExtensionDate] = useState<Date | undefined>();
  const [extensionPopoverOpen, setExtensionPopoverOpen] = useState<string | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundContext, setRefundContext] = useState<{ studentId: string; email?: string; invoiceId?: string } | null>(null);
  const [markPaidOpen, setMarkPaidOpen] = useState(false);
  const [markPaidContext, setMarkPaidContext] = useState<{ invoiceId: string; email?: string } | null>(null);

  const { toast } = useToast();
  const { user } = useAuth();


  useEffect(() => {
    fetchCurrency();
    fetchCourses();
    fetchRecords();
  }, []);

  // When user searches, refetch ignoring date range so all matching invoices show
  useEffect(() => {
    setCurrentPage(1);
    const t = setTimeout(() => {
      fetchRecords(undefined, searchTerm.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => { setCurrentPage(1); }, [courseFilter, statusFilter]);

  const fetchCurrency = async () => {
    const { data } = await supabase.from('company_settings').select('currency').single();
    if (data?.currency) setCurrency(data.currency);
  };

  const fetchCourses = async () => {
    const { data } = await supabase.from('courses').select('id, title').eq('is_active', true);
    if (data) setCourses(data);
  };

  const fetchRecords = async (useRange?: { from: Date; to: Date }, searchOverride?: string) => {
    const range = useRange || dateRange;
    const search = (searchOverride ?? searchTerm).trim();
    const hasSearch = search.length > 0;
    try {
      setTableLoading(true);

      const fromIso = range.from.toISOString();
      const toIso = range.to.toISOString();

      const invoices = await fetchAll((from, to) => {
        let q = supabase
          .from('invoices')
          .select(`
            id, amount, paid_at, due_date, extended_due_date, installment_number, status,
            student_id, course_id, pathway_id,
            students!inner(id, student_id, user_id, users!inner(full_name, email)),
            courses(title),
            learning_pathways(name)
          `);
        if (!hasSearch) {
          q = q.or(`and(paid_at.gte.${fromIso},paid_at.lte.${toIso}),and(paid_at.is.null,due_date.gte.${fromIso},due_date.lte.${toIso})`);
        }
        return q.range(from, to);
      });

      const fromMs = range.from.getTime();
      const toMs = range.to.getTime();

      const processed: InvoiceRecord[] = (invoices || [])
        .map((inv: any) => ({
          id: inv.id,
          studentId: inv.students?.student_id || 'N/A',
          studentDbId: inv.student_id || null,
          studentName: inv.students?.users?.full_name || 'Unknown',
          email: inv.students?.users?.email || '',
          courseName: inv.courses?.title || 'N/A',
          pathwayName: inv.learning_pathways?.name || null,
          paymentDate: inv.paid_at,
          dueDate: inv.due_date,
          extendedDueDate: inv.extended_due_date,
          amount: Number(inv.amount || 0),
          installmentNumber: inv.installment_number || 1,
          status: inv.status,
        }))
        .filter((r) => {
          if (hasSearch) return true; // when searching, show all matching invoices regardless of date
          const refDate = r.paymentDate ? new Date(r.paymentDate).getTime() : new Date(r.dueDate).getTime();
          return refDate >= fromMs && refDate <= toMs;
        });

      setRecords(processed);

      // Fetch refunds independently by refunded_at within selected range (ignores due/issue date)
      if (!hasSearch) {
        const refunds = await fetchAll((from, to) =>
          supabase
            .from('invoices')
            .select('refund_amount, amount, course_id, refunded_at')
            .eq('status', 'refunded')
            .gte('refunded_at', fromIso)
            .lte('refunded_at', toIso)
            .range(from, to)
        );
        setRefundsInRange(
          (refunds || []).map((r: any) => ({
            amount: Number(r.refund_amount ?? r.amount ?? 0),
            courseId: r.course_id || null,
          }))
        );
      } else {
        setRefundsInRange([]);
      }
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to load payment data', variant: 'destructive' });
    } finally {
      setLoading(false);
      setTableLoading(false);
    }
  };

  const handleApplyDateRange = () => {
    if (tempDateRange.from && tempDateRange.to) {
      const r = { from: tempDateRange.from, to: tempDateRange.to };
      setDateRange(r);
      fetchRecords(r);
      setIsCalendarOpen(false);
      setCurrentPage(1);
    }
  };

  const setQuickDateRange = (range: 'thisMonth' | 'lastMonth' | 'last3Months') => {
    const now = new Date();
    let r: { from: Date; to: Date };
    switch (range) {
      case 'thisMonth': r = { from: startOfMonth(now), to: endOfMonth(now) }; break;
      case 'lastMonth': r = { from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) }; break;
      case 'last3Months': r = { from: startOfMonth(subMonths(now, 2)), to: endOfMonth(now) }; break;
    }
    setTempDateRange(r);
    setDateRange(r);
    fetchRecords(r);
    setIsCalendarOpen(false);
    setCurrentPage(1);
  };

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchesSearch =
        r.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.studentId.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCourse = courseFilter === 'all' || courses.find(c => c.id === courseFilter)?.title === r.courseName;
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
      return matchesSearch && matchesCourse && matchesStatus;
    });
  }, [records, searchTerm, courseFilter, statusFilter, courses]);

  const stats: PaymentStats = useMemo(() => {
    const paid = filteredRecords.filter(r => r.status === 'paid');
    const totalAmount = paid.reduce((s, p) => s + p.amount, 0);
    const newEnrollments = paid.filter(p => p.installmentNumber === 1).length;
    const now = new Date();
    const pendingAmount = filteredRecords
      .filter(r => r.status !== 'paid' && r.status !== 'refunded')
      .reduce((s, r) => s + r.amount, 0);
    const overdueAmount = filteredRecords
      .filter(r => {
        if (r.status === 'paid' || r.status === 'refunded') return false;
        const eff = r.extendedDueDate || r.dueDate;
        return eff && new Date(eff) < now;
      })
      .reduce((s, r) => s + r.amount, 0);
    const refundsFiltered = refundsInRange.filter(r =>
      courseFilter === 'all' || r.courseId === courseFilter
    );
    const refundedAmount = refundsFiltered.reduce((s, r) => s + r.amount, 0);
    return {
      totalPayments: paid.length,
      totalAmount,
      newEnrollments,
      avgPaymentAmount: paid.length > 0 ? totalAmount / paid.length : 0,
      pendingAmount,
      overdueAmount,
      refundedCount: refundsFiltered.length,
      refundedAmount,
    };
  }, [filteredRecords, refundsInRange, courseFilter]);

  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a, b) => {
      if (a.studentId !== b.studentId) return a.studentId.localeCompare(b.studentId);
      return a.installmentNumber - b.installmentNumber;
    });
  }, [filteredRecords]);
  const totalPages = Math.ceil(sortedRecords.length / itemsPerPage);
  const paginated = sortedRecords.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-PK', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

  const handleExport = () => {
    const csvContent = [
      ['Student ID', 'Name', 'Email', 'Course/Pathway', 'Installment', 'Amount', 'Due Date', 'Status', 'Payment Date'].join(','),
      ...filteredRecords.map(r => [
        r.studentId,
        `"${r.studentName}"`,
        r.email,
        `"${r.pathwayName || r.courseName}"`,
        r.installmentNumber,
        r.amount,
        format(new Date(r.dueDate), 'yyyy-MM-dd'),
        r.status,
        r.paymentDate ? format(new Date(r.paymentDate), 'yyyy-MM-dd') : ''
      ].join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payment-report-${format(dateRange.from, 'yyyy-MM-dd')}-to-${format(dateRange.to, 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const updateInvoiceStatus = async (invoiceId: string, status: string) => {
    try {
      if (status === 'paid') {
        const { data, error } = await supabase.functions.invoke('mark-invoice-paid', { body: { invoice_id: invoiceId } });
        if (error) throw new Error(error.message || 'Failed to mark invoice as paid');
        if (!data?.success) throw new Error(data?.error || 'Failed to process payment');
        toast({ title: 'Success', description: 'Invoice marked as paid and student account activated' });
      } else {
        const updates: any = { status };
        if (status !== 'paid') updates.paid_at = null;
        const { error } = await supabase.from('invoices').update(updates).eq('id', invoiceId);
        if (error) throw error;
        toast({ title: 'Success', description: 'Invoice status updated' });
      }
      await fetchRecords();
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to update invoice', variant: 'destructive' });
    }
  };

  const grantExtension = async (invoiceId: string, newDate: Date) => {
    try {
      const inv = records.find(r => r.id === invoiceId);
      const reason = window.prompt(
        `Extend due date${inv ? ` for ${inv.studentName} (Installment #${inv.installmentNumber})` : ''} to ${format(newDate, 'PPP')}.\n\nReason for extension (optional):`,
        ''
      );
      if (reason === null) {
        setExtensionPopoverOpen(null);
        setExtensionDate(undefined);
        return;
      }

      // Fetch previous due date for the log
      const { data: priorInvoice } = await supabase
        .from('invoices')
        .select('due_date, extended_due_date, installment_number')
        .eq('id', invoiceId)
        .maybeSingle();
      const previousDueDate = priorInvoice?.extended_due_date || priorInvoice?.due_date || null;

      const { error } = await supabase
        .from('invoices')
        .update({ extended_due_date: newDate.toISOString(), status: 'pending' })
        .eq('id', invoiceId);
      if (error) throw error;

      if (inv?.studentDbId) {
        const { data: student } = await supabase.from('students').select('user_id').eq('id', inv.studentDbId).single();
        if (student?.user_id) {
          await supabase.rpc('create_notification', {
            p_user_id: student.user_id,
            p_type: 'fee_extension',
            p_title: 'Fee Extension Granted',
            p_message: `Your payment deadline for Installment #${inv.installmentNumber} has been extended to ${format(newDate, 'PPP')}`,
            p_metadata: { invoice_id: invoiceId, new_due_date: newDate.toISOString(), installment_number: inv.installmentNumber }
          });
          await supabase.from('users').update({ lms_status: 'active' }).eq('id', student.user_id).eq('lms_status', 'suspended');

          await logAdminAction({
            performedBy: user?.id || null,
            targetUserId: student.user_id,
            entityType: 'invoice',
            entityId: invoiceId,
            action: 'fee_extension_granted',
            description: `Extended fee due date for ${inv.studentName}`,
            data: {
              invoice_id: invoiceId,
              installment_number: inv.installmentNumber,
              previous_due_date: previousDueDate,
              new_due_date: newDate.toISOString(),
              reason: reason?.trim() || null,
              student_name: inv.studentName,
            }
          });
        }
      }
      toast({ title: 'Extension Granted', description: `Due date extended to ${format(newDate, 'PPP')}` });
      setExtensionPopoverOpen(null);
      setExtensionDate(undefined);
      await fetchRecords();
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to grant extension', variant: 'destructive' });
    }
  };



  const clearExtension = async (invoiceId: string) => {
    try {
      const { error } = await supabase.from('invoices').update({ extended_due_date: null }).eq('id', invoiceId);
      if (error) throw error;
      toast({ title: 'Extension Cleared', description: 'Due date reset to original' });
      await fetchRecords();
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to clear extension', variant: 'destructive' });
    }
  };

  const getStatusBadge = (status: string) => {
    const cfg: any = {
      paid: { color: 'bg-green-500', label: 'Paid' },
      pending: { color: 'bg-yellow-500', label: 'Pending' },
      issued: { color: 'bg-amber-500', label: 'Issued' },
      overdue: { color: 'bg-red-500', label: 'Overdue' },
      due: { color: 'bg-red-500', label: 'Due' },
      failed: { color: 'bg-gray-500', label: 'Failed' },
      refunded: { color: 'bg-purple-500', label: 'Refunded' },
    };
    const c = cfg[status] || { color: 'bg-gray-500', label: status };
    return <Badge className={c.color}>{c.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-muted rounded-lg"></div>)}
          </div>
          <div className="h-96 bg-muted rounded-lg"></div>
        </div>
      </div>
    );
  }

  const toneMap: Record<string, { text: string; bg: string; ring: string; accent: string; gradient: string }> = {
    emerald: { text: 'text-emerald-600', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/20', accent: 'bg-emerald-500', gradient: 'from-emerald-50/80' },
    sky:     { text: 'text-sky-600',     bg: 'bg-sky-500/10',     ring: 'ring-sky-500/20',     accent: 'bg-sky-500',     gradient: 'from-sky-50/80' },
    violet:  { text: 'text-violet-600',  bg: 'bg-violet-500/10',  ring: 'ring-violet-500/20',  accent: 'bg-violet-500',  gradient: 'from-violet-50/80' },
    amber:   { text: 'text-amber-600',   bg: 'bg-amber-500/10',   ring: 'ring-amber-500/20',   accent: 'bg-amber-500',   gradient: 'from-amber-50/80' },
    yellow:  { text: 'text-yellow-600',  bg: 'bg-yellow-500/10',  ring: 'ring-yellow-500/20',  accent: 'bg-yellow-500',  gradient: 'from-yellow-50/80' },
    red:     { text: 'text-red-600',     bg: 'bg-red-500/10',     ring: 'ring-red-500/20',     accent: 'bg-red-500',     gradient: 'from-red-50/80' },
    fuchsia: { text: 'text-fuchsia-600', bg: 'bg-fuchsia-500/10', ring: 'ring-fuchsia-500/20', accent: 'bg-fuchsia-500', gradient: 'from-fuchsia-50/80' },
  };

  const primaryStats = [
    { label: 'Total Received', value: formatCurrency(stats.totalAmount), hint: `${stats.totalPayments} payments`, icon: DollarSign, tone: 'emerald' },
    { label: 'New Enrollments', value: stats.newEnrollments, hint: 'First-time payments', icon: Users, tone: 'sky' },
    { label: 'Avg. Payment', value: formatCurrency(stats.avgPaymentAmount), hint: 'Per transaction', icon: TrendingUp, tone: 'violet' },
    { label: 'Date Range', value: `${format(dateRange.from, 'MMM d')} – ${format(dateRange.to, 'MMM d')}`, hint: format(dateRange.to, 'yyyy'), icon: CalendarIcon, tone: 'amber' },
  ];
  const secondaryStats = [
    { label: 'Pending Amount', value: formatCurrency(stats.pendingAmount), hint: 'Awaiting payment in range', icon: Clock, tone: 'yellow' },
    { label: 'Overdue Amount', value: formatCurrency(stats.overdueAmount), hint: 'Past due in range', icon: AlertTriangle, tone: 'red' },
    { label: 'Refunds', value: formatCurrency(stats.refundedAmount), hint: `${stats.refundedCount} refunded ${stats.refundedCount === 1 ? 'invoice' : 'invoices'}`, icon: Undo2, tone: 'fuchsia' },
  ];

  const renderStat = ({ label, value, hint, icon: Icon, tone }: any) => {
    const t = toneMap[tone];
    return (
      <Card key={label} className={`group relative overflow-hidden border-border/60 bg-gradient-to-br ${t.gradient} to-card hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200`}>
        <div className={`absolute top-0 left-0 right-0 h-1 ${t.accent}`} />
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div className={`p-2.5 rounded-xl ${t.bg} ring-1 ${t.ring}`}>
              <Icon className={`w-4 h-4 ${t.text}`} />
            </div>
          </div>
          <div className={`text-2xl font-semibold tracking-tight tabular-nums truncate ${t.text}`}>{value}</div>
          <div className="mt-1 text-xs font-semibold text-foreground/80">{label}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-8 p-1">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-emerald-500/10 via-primary/5 to-violet-500/10">
        <div className="absolute -top-16 -right-10 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />
        <div className="relative p-6 md:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex flex-col gap-2">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-primary uppercase tracking-wider">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Analytics · Payments
            </div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">Payment Reports</h1>
            <p className="text-muted-foreground">Track student payments and manage invoices in one place.</p>
          </div>
          <Button onClick={handleExport} variant="outline" className="gap-2 bg-background/60 backdrop-blur">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Revenue Overview</h2>
          <span className="text-xs text-muted-foreground">{format(dateRange.from, 'MMM d')} – {format(dateRange.to, 'MMM d, yyyy')}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {primaryStats.map(renderStat)}
        </div>
      </div>

      {/* Secondary Stat Row */}
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Attention Required</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {secondaryStats.map(renderStat)}
        </div>
      </div>


      {/* Filters */}
      <Card className="border-border/60 bg-card">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by name, email, or student ID…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-background"
              />
            </div>

            <Popover open={isCalendarOpen} onOpenChange={(open) => {
              setIsCalendarOpen(open);
              if (open) setTempDateRange({ from: dateRange.from, to: dateRange.to });
            }}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full lg:w-[260px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                  {format(dateRange.from, 'MMM d, yyyy')} – {format(dateRange.to, 'MMM d, yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="p-3 border-b flex flex-wrap gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setQuickDateRange('thisMonth')}>This Month</Button>
                  <Button size="sm" variant="ghost" onClick={() => setQuickDateRange('lastMonth')}>Last Month</Button>
                  <Button size="sm" variant="ghost" onClick={() => setQuickDateRange('last3Months')}>Last 3 Months</Button>
                </div>
                <Calendar
                  mode="range"
                  selected={{ from: tempDateRange.from, to: tempDateRange.to }}
                  onSelect={(range) => setTempDateRange({ from: range?.from, to: range?.to })}
                  numberOfMonths={2}
                  className="pointer-events-auto"
                />
                <div className="p-3 border-t flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setIsCalendarOpen(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleApplyDateRange} disabled={!tempDateRange.from || !tempDateRange.to}>Apply</Button>
                </div>
              </PopoverContent>
            </Popover>

            <Select value={courseFilter} onValueChange={setCourseFilter}>
              <SelectTrigger className="w-full lg:w-[200px]"><SelectValue placeholder="All Courses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full lg:w-[160px]"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="issued">Issued</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="due">Due</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>


      {/* Master Table */}
      <Card className="relative border-border/60 overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-lg">Invoice & Payment Records</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                Showing {paginated.length} of {filteredRecords.length} records · scroll horizontally to see all columns
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className={cn("p-0", tableLoading && "opacity-50 pointer-events-none")}>
          {tableLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}
          <div className="w-full overflow-x-auto">
          <Table className="min-w-[1400px]">
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="whitespace-nowrap">Student ID</TableHead>
                <TableHead className="whitespace-nowrap">Name</TableHead>
                <TableHead className="whitespace-nowrap">Email</TableHead>
                <TableHead className="whitespace-nowrap">Course/Pathway</TableHead>
                <TableHead className="whitespace-nowrap">Installment</TableHead>
                <TableHead className="text-right whitespace-nowrap">Amount</TableHead>
                <TableHead className="whitespace-nowrap">Due Date</TableHead>
                <TableHead className="whitespace-nowrap">Status</TableHead>
                <TableHead className="whitespace-nowrap">Payment Date</TableHead>
                <TableHead className="whitespace-nowrap sticky right-0 bg-muted/40 backdrop-blur border-l border-border/60 shadow-[-8px_0_16px_-8px_rgba(0,0,0,0.08)]">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    No records found for the selected criteria
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-sm">{r.studentId}</TableCell>
                    <TableCell className="font-medium">{r.studentName}</TableCell>
                    <TableCell className="text-muted-foreground">{r.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{r.courseName}</span>
                        {r.pathwayName && <span className="text-xs text-muted-foreground">{r.pathwayName}</span>}
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline">#{r.installmentNumber}</Badge></TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(r.amount)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className={r.extendedDueDate ? 'line-through text-muted-foreground text-xs' : ''}>
                          {new Date(r.dueDate).toLocaleDateString()}
                        </span>
                        {r.extendedDueDate && (
                          <span className="flex items-center gap-1 text-amber-600 font-medium text-xs">
                            <Clock className="w-3 h-3" />
                            {new Date(r.extendedDueDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(r.status)}
                        {r.extendedDueDate && (
                          <Badge variant="outline" className="text-amber-600 border-amber-600">Extended</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{r.paymentDate ? format(new Date(r.paymentDate), 'MMM d, yyyy') : 'N/A'}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1.5 min-w-[140px]">
                        <Select value={r.status} onValueChange={(v) => {
                          if (v === 'refunded') {
                            if (r.status === 'refunded' || !r.studentDbId) return;
                            setRefundContext({ studentId: r.studentDbId, email: r.email, invoiceId: r.id });
                            setRefundOpen(true);
                            return;
                          }
                          if (v === 'paid') {
                            if (r.status === 'paid') return;
                            setMarkPaidContext({ invoiceId: r.id, email: r.email });
                            setMarkPaidOpen(true);
                            return;
                          }
                          updateInvoiceStatus(r.id, v);
                        }}>
                          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="issued">Issued</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="due">Due</SelectItem>
                            <SelectItem value="overdue">Overdue</SelectItem>
                            <SelectItem value="failed">Failed</SelectItem>
                            <SelectItem value="refunded">Refunded</SelectItem>
                          </SelectContent>
                        </Select>

                        {r.status !== 'paid' && (
                          <Popover
                            open={extensionPopoverOpen === r.id}
                            onOpenChange={(open) => {
                              setExtensionPopoverOpen(open ? r.id : null);
                              if (!open) setExtensionDate(undefined);
                            }}
                          >
                            <PopoverTrigger asChild>
                              <Button variant="outline" size="sm" className="gap-1">
                                <CalendarIcon className="w-3 h-3" /> Extend
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                              <div className="p-3 border-b">
                                <p className="text-sm font-medium">Extend Due Date</p>
                                <p className="text-xs text-muted-foreground">
                                  Current: {new Date(r.extendedDueDate || r.dueDate).toLocaleDateString()}
                                </p>
                              </div>
                              <Calendar
                                mode="single"
                                selected={extensionDate}
                                onSelect={setExtensionDate}
                                disabled={(date) => date < new Date()}
                                initialFocus
                                className={cn("p-3 pointer-events-auto")}
                              />
                              <div className="p-3 border-t flex gap-2">
                                <Button size="sm" className="flex-1" disabled={!extensionDate}
                                  onClick={() => extensionDate && grantExtension(r.id, extensionDate)}>
                                  Grant Extension
                                </Button>
                                {r.extendedDueDate && (
                                  <Button size="sm" variant="destructive" onClick={() => clearExtension(r.id)}>Clear</Button>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}

                        {r.status === 'paid' && r.studentDbId && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              setRefundContext({ studentId: r.studentDbId!, email: r.email, invoiceId: r.id });
                              setRefundOpen(true);
                            }}
                          >
                            <Undo2 className="w-3 h-3" /> Refund
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>


        <div className="px-4 border-t">
          <TablePager
            page={currentPage}
            pageCount={totalPages}
            totalItems={sortedRecords.length}
            pageSize={itemsPerPage}
            onPageChange={setCurrentPage}
            itemLabel="invoices"
          />
        </div>
      </Card>

      {refundContext && (
        <RefundDialog
          open={refundOpen}
          onOpenChange={(o) => { setRefundOpen(o); if (!o) setRefundContext(null); }}
          studentId={refundContext.studentId}
          studentEmail={refundContext.email}
          initialInvoiceId={refundContext.invoiceId}
          onSuccess={fetchRecords}
        />
      )}
      {markPaidContext && (
        <MarkPaidDialog
          open={markPaidOpen}
          onOpenChange={(o) => { setMarkPaidOpen(o); if (!o) setMarkPaidContext(null); }}
          invoiceId={markPaidContext.invoiceId}
          studentEmail={markPaidContext.email}
          onSuccess={fetchRecords}
        />
      )}
    </div>
  );
};

export default PaymentReports;
