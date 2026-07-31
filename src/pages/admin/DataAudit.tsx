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
import { SecurityIncidentsPanel } from '@/components/admin/SecurityIncidentsPanel';
import { SecuritySignalsPanel } from '@/components/admin/SecuritySignalsPanel';
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
  const [lastScanned, setLastScanned] = useState<Date | null>(null);


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
        .eq('status', 'open')
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
        description: `${data?.drifting_students ?? 0} students flagged, ${data?.inserted_findings ?? 0} new, ${data?.auto_resolved ?? 0} auto-cleared.`,
      });
      setLastScanned(new Date());
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

  const removePhantom = (f: DriftFinding, enrollment_id: string) => {
    setPendingAction({
      label: 'Remove phantom course enrollment',
      description: `This student has a pathway enrollment that already covers this course, so this extra direct-course enrollment is a duplicate. It will be removed along with its unpaid invoices. Paid invoices are never touched. Undoable within 7 days.`,
      run: () => invokeReconcile(
        { action_type: 'remove_phantom_enrollment', finding_id: f.id, student_id: f.student_id, enrollment_id },
        'Phantom enrollment removed',
        `phantom-${enrollment_id}`,
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
    <div className="w-full p-6 md:p-8 space-y-10">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <AlertTriangle className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Data Audit</h1>
          </div>
          <p className="text-muted-foreground text-sm max-w-xl leading-relaxed">
            Read scans and perform manual reconciliation. Every corrective action is logged and can be reverted within a 7-day window.
          </p>
        </div>
        <Button onClick={runScan} disabled={scanning} className="whitespace-nowrap shadow-sm">
          {scanning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Run drift scan
        </Button>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Open drift findings"
          value={openFindings.length}
          badge={openFindings.length === 0 ? { label: 'Clean', tone: 'success' } : { label: 'Attention', tone: 'warning' }}
        />
        <StatCard title="Invoice activity (recent)" value={invoiceLogs.length} badge={{ label: 'Events', tone: 'muted' }} />
        <StatCard title="Content-order events" value={contentLogs.length} badge={{ label: 'Pending', tone: 'muted' }} />
        <StatCard title="Reconciliation actions" value={actions.length} badge={{ label: 'Completed', tone: 'muted' }} />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList className="flex flex-wrap h-auto w-fit gap-1 p-1 bg-muted/50 border border-border rounded-xl">
          <TabsTrigger value="drift" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-border">Billing drift</TabsTrigger>
          <TabsTrigger value="invoices" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-border">Invoice changes</TabsTrigger>
          <TabsTrigger value="enrollments" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-border">Enrollment changes</TabsTrigger>
          <TabsTrigger value="content" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-border">Content order changes</TabsTrigger>
          <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-border">Reconciliation history</TabsTrigger>
          <TabsTrigger value="security" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-border">Security incidents</TabsTrigger>
          <TabsTrigger value="signals" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-border">Playback signals</TabsTrigger>

        </TabsList>

        <TabsContent value="drift">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
              <CardTitle>Billing drift findings</CardTitle>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {lastScanned ? `Last scanned ${lastScanned.toLocaleTimeString()}` : 'Only unresolved findings are shown'}
                </span>
                <Button size="sm" variant="outline" onClick={runScan} disabled={scanning}>
                  {scanning ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-2" />}
                  Re-scan
                </Button>
              </div>
            </CardHeader>

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
                    const phantoms: any[] = f.details?.phantom_course_enrollments ?? [];
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
                              {phantoms.map((p) => (
                                <Button
                                  key={`ph-${p.enrollment_id}`} size="sm" variant="destructive"
                                  onClick={() => removePhantom(f, p.enrollment_id)}
                                  disabled={busyId === `phantom-${p.enrollment_id}`}
                                >
                                  <Wrench className="h-3 w-3 mr-1" /> Remove phantom course ({f.currency} {Number(p.total_amount ?? 0).toLocaleString()})
                                </Button>
                              ))}
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

        <TabsContent value="security">
          <SecurityIncidentsPanel />
        </TabsContent>

        <TabsContent value="signals">
          <SecuritySignalsPanel />
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

type Tone = 'success' | 'warning' | 'muted';
function StatCard({ title, value, badge }: { title: string; value: number; badge?: { label: string; tone: Tone } }) {
  const toneClass =
    badge?.tone === 'success' ? 'text-emerald-600 bg-emerald-500/10' :
    badge?.tone === 'warning' ? 'text-amber-600 bg-amber-500/10' :
    'text-muted-foreground bg-muted';
  return (
    <div className="bg-card border border-border rounded-2xl p-6 transition-all hover:border-primary/20">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">{title}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-bold text-foreground tracking-tighter">{value}</span>
        {badge && (
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${toneClass}`}>{badge.label}</span>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`font-semibold ${highlight ? 'text-amber-600' : 'text-foreground'}`}>{value}</div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="relative overflow-hidden bg-card border border-border rounded-2xl min-h-[280px] flex items-center justify-center">
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)', backgroundSize: '24px 24px' }}
      />
      <div className="relative flex flex-col items-center text-center px-6 max-w-sm">
        <div className="w-16 h-16 mb-6 rounded-full bg-muted flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-muted-foreground/50" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Nothing here yet</h3>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{label}</p>
      </div>
    </div>
  );
}

function LogsTable({ rows, loading, emptyLabel }: { rows: LogRow[]; loading: boolean; emptyLabel: string }) {
  if (loading) {
    return (
      <div className="bg-card border border-border rounded-2xl min-h-[280px] flex items-center justify-center text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading…
      </div>
    );
  }
  if (rows.length === 0) return <EmptyState label={emptyLabel} />;
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
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
    </div>
  );
}
