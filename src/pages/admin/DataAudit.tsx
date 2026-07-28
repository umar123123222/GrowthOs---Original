import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';

interface DriftFinding {
  id: string;
  student_id: string;
  expected_total: number;
  actual_total: number;
  difference: number;
  currency: string;
  status: string;
  detected_at: string;
  details: any;
  student_name?: string;
  student_email?: string;
}

interface LogRow {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  description: string | null;
  data: any;
  created_at: string;
  performed_by: string | null;
}

/**
 * Phase 1 — Read-only Data Audit page.
 * Shows drift findings + recent invoice/enrollment/content-order log activity.
 * Does not mutate anything.
 */
export default function DataAudit() {
  const { toast } = useToast();
  const [tab, setTab] = useState('drift');

  const [findings, setFindings] = useState<DriftFinding[]>([]);
  const [loadingFindings, setLoadingFindings] = useState(true);
  const [scanning, setScanning] = useState(false);

  const [invoiceLogs, setInvoiceLogs] = useState<LogRow[]>([]);
  const [enrollmentLogs, setEnrollmentLogs] = useState<LogRow[]>([]);
  const [contentLogs, setContentLogs] = useState<LogRow[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    await Promise.all([fetchFindings(), fetchLogs()]);
  };

  const fetchFindings = async () => {
    setLoadingFindings(true);
    try {
      const { data, error } = await supabase
        .from('billing_drift_findings')
        .select('*')
        .order('detected_at', { ascending: false })
        .limit(500);
      if (error) throw error;

      const studentIds = Array.from(new Set((data ?? []).map((f: any) => f.student_id)));
      let studentMap: Record<string, { name?: string; email?: string }> = {};
      if (studentIds.length > 0) {
        const { data: studentsRows } = await supabase
          .from('students')
          .select('id, user_id')
          .in('id', studentIds);
        const userIds = (studentsRows ?? []).map((s: any) => s.user_id).filter(Boolean);
        const { data: userRows } = await supabase
          .from('users')
          .select('id, full_name, email')
          .in('id', userIds);
        const userById: Record<string, any> = {};
        (userRows ?? []).forEach((u: any) => { userById[u.id] = u; });
        (studentsRows ?? []).forEach((s: any) => {
          const u = userById[s.user_id];
          studentMap[s.id] = { name: u?.full_name, email: u?.email };
        });
      }

      setFindings((data ?? []).map((f: any) => ({
        ...f,
        student_name: studentMap[f.student_id]?.name,
        student_email: studentMap[f.student_id]?.email,
      })));
    } catch (e) {
      logger.error('Failed to load drift findings', e);
      toast({ title: 'Failed to load findings', variant: 'destructive' });
    } finally {
      setLoadingFindings(false);
    }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const [inv, enr, ord] = await Promise.all([
        supabase
          .from('admin_logs')
          .select('*')
          .eq('entity_type', 'invoice')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('admin_logs')
          .select('*')
          .in('entity_type', ['course_enrollment', 'enrollment', 'pathway_enrollment'])
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('admin_logs')
          .select('*')
          .in('entity_type', ['module', 'recording', 'available_lesson'])
          .order('created_at', { ascending: false })
          .limit(200),
      ]);
      setInvoiceLogs((inv.data as any) ?? []);
      setEnrollmentLogs((enr.data as any) ?? []);
      setContentLogs((ord.data as any) ?? []);
    } catch (e) {
      logger.error('Failed to load audit logs', e);
    } finally {
      setLoadingLogs(false);
    }
  };

  const runScan = async () => {
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke('detect-billing-drift', {
        body: {},
      });
      if (error) throw error;
      toast({
        title: 'Scan complete',
        description: `${data?.drifting_students ?? 0} students flagged, ${data?.inserted_findings ?? 0} new findings.`,
      });
      await fetchFindings();
    } catch (e: any) {
      toast({ title: 'Scan failed', description: e?.message ?? String(e), variant: 'destructive' });
    } finally {
      setScanning(false);
    }
  };

  const openFindings = findings.filter((f) => f.status === 'open');

  return (
    <div className="w-full p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <AlertTriangle className="h-7 w-7 text-yellow-500" />
            Data Audit
          </h1>
          <p className="text-muted-foreground mt-1">
            Read-only observability. No changes are made from this page.
          </p>
        </div>
        <Button onClick={runScan} disabled={scanning} variant="outline">
          {scanning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Run drift scan
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Open drift findings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{openFindings.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Invoice activity (recent)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{invoiceLogs.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Content-order events (recent)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{contentLogs.length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="drift">Billing drift</TabsTrigger>
          <TabsTrigger value="invoices">Invoice changes</TabsTrigger>
          <TabsTrigger value="enrollments">Enrollment changes</TabsTrigger>
          <TabsTrigger value="content">Content order changes</TabsTrigger>
        </TabsList>

        <TabsContent value="drift">
          <Card>
            <CardHeader>
              <CardTitle>Billing drift findings</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingFindings ? (
                <div className="py-12 text-center text-muted-foreground">Loading…</div>
              ) : findings.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  No findings yet. Run a scan to check for mismatches.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Expected</TableHead>
                      <TableHead>Actual (invoices)</TableHead>
                      <TableHead>Difference</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Detected</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {findings.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell>
                          <div className="font-medium">{f.student_name ?? 'Unknown'}</div>
                          <div className="text-xs text-muted-foreground">{f.student_email}</div>
                        </TableCell>
                        <TableCell>{f.currency} {Number(f.expected_total).toLocaleString()}</TableCell>
                        <TableCell>{f.currency} {Number(f.actual_total).toLocaleString()}</TableCell>
                        <TableCell className={f.difference > 0 ? 'text-red-600' : 'text-yellow-600'}>
                          {f.difference > 0 ? '+' : ''}{Number(f.difference).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant={f.status === 'open' ? 'destructive' : 'secondary'}>
                            {f.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(f.detected_at).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices">
          <LogsTable rows={invoiceLogs} loading={loadingLogs} emptyLabel="No recent invoice changes logged." />
        </TabsContent>
        <TabsContent value="enrollments">
          <LogsTable rows={enrollmentLogs} loading={loadingLogs} emptyLabel="No recent enrollment changes logged." />
        </TabsContent>
        <TabsContent value="content">
          <LogsTable rows={contentLogs} loading={loadingLogs} emptyLabel="No recent content-order changes logged." />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LogsTable({ rows, loading, emptyLabel }: { rows: LogRow[]; loading: boolean; emptyLabel: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        {loading ? (
          <div className="py-12 text-center text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">{emptyLabel}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell><Badge variant="outline">{r.action}</Badge></TableCell>
                  <TableCell className="text-xs">{r.entity_type}</TableCell>
                  <TableCell className="max-w-md truncate">{r.description ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
