import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, AlertTriangle, Loader2, Wrench, Undo2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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

interface ReconAction {
  id: string;
  student_id: string;
  action_type: string;
  performed_at: string;
  performed_by: string | null;
  undone_at: string | null;
  before_state: any;
  after_state: any;
}

const UNDO_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

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

  const [actions, setActions] = useState<ReconAction[]>([]);
  const [loadingActions, setLoadingActions] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [pendingAction, setPendingAction] = useState<null | {
    label: string;
    description: string;
    run: () => Promise<void>;
  }>(null);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    await Promise.all([fetchFindings(), fetchLogs(), fetchActions()]);
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
      const studentMap: Record<string, { name?: string; email?: string }> = {};
      if (studentIds.length > 0) {
        const { data: studentsRows } = await supabase
          .from('students').select('id, user_id').in('id', studentIds);
        const userIds = (studentsRows ?? []).map((s: any) => s.user_id).filter(Boolean);
        const { data: userRows } = await supabase
          .from('users').select('id, full_name, email').in('id', userIds);
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
        supabase.from('admin_logs').select('*').eq('entity_type', 'invoice').order('created_at', { ascending: false }).limit(200),
        supabase.from('admin_logs').select('*').in('entity_type', ['course_enrollment', 'enrollment', 'pathway_enrollment']).order('created_at', { ascending: false }).limit(200),
        supabase.from('admin_logs').select('*').in('entity_type', ['module', 'recording', 'available_lesson']).order('created_at', { ascending: false }).limit(200),
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

  const fetchActions = async () => {
    setLoadingActions(true);
    try {
      const { data, error } = await supabase
        .from('billing_reconciliation_actions')
        .select('*')
        .order('performed_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      setActions((data as any) ?? []);
    } catch (e) {
      logger.error('Failed to load reconciliation actions', e);
    } finally {
      setLoadingActions(false);
    }
  };

  const runScan = async () => {
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke('detect-billing-drift', { body: {} });
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

  const invokeReconcile = async (payload: any, successMsg: string, key: string) => {
    setBusyId(key);
    try {
      const { data, error } = await supabase.functions.invoke('reconcile-billing-finding', { body: payload });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: successMsg, description: JSON.stringify(data) });
      await Promise.all([fetchFindings(), fetchActions()]);
    } catch (e: any) {
      toast({ title: 'Action failed', description: e?.message ?? String(e), variant: 'destructive' });
    } finally {
      setBusyId(null);
      setPendingAction(null);
    }
  };

  const deleteOrphans = (f: DriftFinding) => {
    const orphanTotal = Number(f.details?.orphan_invoice_total ?? 0);
    setPendingAction({
      label: 'Delete orphan invoices',
      description: `Delete all UNPAID invoices with no active enrollment for this student (approx ${f.currency} ${orphanTotal.toLocaleString()}). Paid invoices are never touched. You can undo within 7 days.`,
      run: () => invokeReconcile(
        { action_type: 'delete_orphan_invoices', finding_id: f.id, student_id: f.student_id },
        'Orphan invoices deleted',
        `orphan-${f.id}`,
      ),
    });
  };

  const resyncEnrollment = (f: DriftFinding, enrollment_id: string) => {
    setPendingAction({
      label: 'Resync enrollment total to snapshot',
      description: `Set this enrollment's total_amount back to its captured snapshot_price. Invoices and LMS access are NOT changed. Undoable within 7 days.`,
      run: () => invokeReconcile(
        { action_type: 'resync_enrollment_total', finding_id: f.id, student_id: f.student_id, enrollment_id },
        'Enrollment total resynced',
        `resync-${enrollment_id}`,
      ),
    });
  };

  const markDup = (f: DriftFinding, enrollment_id: string) => {
    setPendingAction({
      label: 'Flag as duplicate',
      description: `Mark this enrollment status = 'duplicate_flagged' so it can be reviewed. Nothing is deleted. Undoable within 7 days.`,
      run: () => invokeReconcile(
        { action_type: 'mark_duplicate_enrollment', finding_id: f.id, student_id: f.student_id, enrollment_id },
        'Enrollment flagged as duplicate',
        `dup-${enrollment_id}`,
      ),
    });
  };

  const undoAction = (a: ReconAction) => {
    setPendingAction({
      label: 'Undo action',
      description: `Reverse this ${a.action_type} action performed on ${new Date(a.performed_at).toLocaleString()}.`,
      run: () => invokeReconcile(
        { op: 'undo', action_id: a.id },
        'Action undone',
        `undo-${a.id}`,
      ),
    });
  };

  const canUndo = (a: ReconAction) =>
    !a.undone_at && Date.now() - new Date(a.performed_at).getTime() < UNDO_WINDOW_MS;

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
            Read scans + manual reconciliation. Every fix is logged and undoable within 7 days.
          </p>
        </div>
        <Button onClick={runScan} disabled={scanning} variant="outline">
          {scanning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Run drift scan
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Open drift findings" value={openFindings.length} />
        <StatCard title="Invoice activity (recent)" value={invoiceLogs.length} />
        <StatCard title="Content-order events (recent)" value={contentLogs.length} />
        <StatCard title="Reconciliation actions" value={actions.length} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="drift">Billing drift</TabsTrigger>
          <TabsTrigger value="invoices">Invoice changes</TabsTrigger>
          <TabsTrigger value="enrollments">Enrollment changes</TabsTrigger>
          <TabsTrigger value="content">Content order changes</TabsTrigger>
          <TabsTrigger value="history">Reconciliation history</TabsTrigger>
        </TabsList>

        <TabsContent value="drift">
          <Card>
            <CardHeader><CardTitle>Billing drift findings</CardTitle></CardHeader>
            <CardContent>
              {loadingFindings ? (
                <div className="py-12 text-center text-muted-foreground">Loading…</div>
              ) : findings.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  No findings yet. Run a scan to check for mismatches.
                </div>
              ) : (
                <div className="space-y-4">
                  {findings.map((f) => {
                    const orphan = Number(f.details?.orphan_invoice_total ?? 0);
                    const perEnr: any[] = f.details?.per_enrollment ?? [];
                    const dupes: any[] = f.details?.duplicate_enrollments ?? [];
                    return (
                      <Card key={f.id} className="border-l-4 border-l-yellow-500">
                        <CardContent className="pt-4 space-y-3">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="font-semibold">{f.student_name ?? 'Unknown student'}</div>
                              <div className="text-xs text-muted-foreground">{f.student_email}</div>
                            </div>
                            <Badge variant={f.status === 'open' ? 'destructive' : 'secondary'}>{f.status}</Badge>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                            <Metric label="Expected" value={`${f.currency} ${Number(f.expected_total).toLocaleString()}`} />
                            <Metric label="Actual (invoices)" value={`${f.currency} ${Number(f.actual_total).toLocaleString()}`} />
                            <Metric
                              label="Difference"
                              value={`${f.difference > 0 ? '+' : ''}${Number(f.difference).toLocaleString()}`}
                              highlight={f.difference !== 0}
                            />
                            <Metric label="Orphan total" value={`${f.currency} ${orphan.toLocaleString()}`} highlight={orphan > 0} />
                          </div>

                          {f.status === 'open' && (
                            <div className="flex flex-wrap gap-2 pt-2 border-t">
                              {orphan > 0 && (
                                <Button
                                  size="sm" variant="outline"
                                  onClick={() => deleteOrphans(f)}
                                  disabled={busyId === `orphan-${f.id}`}
                                >
                                  <Wrench className="h-3 w-3 mr-1" /> Delete unpaid orphans
                                </Button>
                              )}
                              {perEnr.filter((e) => e.snapshot_mismatch).map((e) => (
                                <Button
                                  key={`rs-${e.enrollment_id}`} size="sm" variant="outline"
                                  onClick={() => resyncEnrollment(f, e.enrollment_id)}
                                  disabled={busyId === `resync-${e.enrollment_id}`}
                                >
                                  <Wrench className="h-3 w-3 mr-1" /> Resync enrollment ({e.snapshot_price} vs {e.expected})
                                </Button>
                              ))}
                              {dupes.map((d) =>
                                (d.enrollment_ids ?? []).slice(1).map((eid: string) => (
                                  <Button
                                    key={`dup-${eid}`} size="sm" variant="outline"
                                    onClick={() => markDup(f, eid)}
                                    disabled={busyId === `dup-${eid}`}
                                  >
                                    <Wrench className="h-3 w-3 mr-1" /> Flag duplicate {d.kind}
                                  </Button>
                                ))
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
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

        <TabsContent value="history">
          <Card>
            <CardHeader><CardTitle>Reconciliation history (undo within 7 days)</CardTitle></CardHeader>
            <CardContent>
              {loadingActions ? (
                <div className="py-12 text-center text-muted-foreground">Loading…</div>
              ) : actions.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">No reconciliation actions yet.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Undo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {actions.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(a.performed_at).toLocaleString()}
                        </TableCell>
                        <TableCell><Badge variant="outline">{a.action_type}</Badge></TableCell>
                        <TableCell className="text-xs font-mono">{a.student_id.slice(0, 8)}…</TableCell>
                        <TableCell>
                          {a.undone_at ? (
                            <Badge variant="secondary">Undone</Badge>
                          ) : canUndo(a) ? (
                            <Badge>Active</Badge>
                          ) : (
                            <Badge variant="outline">Expired</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm" variant="ghost"
                            disabled={!canUndo(a) || busyId === `undo-${a.id}`}
                            onClick={() => undoAction(a)}
                          >
                            <Undo2 className="h-3 w-3 mr-1" /> Undo
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!pendingAction} onOpenChange={(o) => !o && setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingAction?.label}</AlertDialogTitle>
            <AlertDialogDescription>{pendingAction?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingAction?.run()}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{title}</CardTitle></CardHeader>
      <CardContent><div className="text-3xl font-bold text-foreground">{value}</div></CardContent>
    </Card>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`font-semibold ${highlight ? 'text-yellow-600' : 'text-foreground'}`}>{value}</div>
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
