import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, Loader2, ShieldCheck, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';

interface Incident {
  id: string;
  user_id: string;
  signal: string;
  severity: string;
  action_taken: string;
  device_label: string | null;
  ip_address: string | null;
  page_url: string | null;
  metadata: any;
  created_at: string;
}

interface UserInfo {
  full_name: string | null;
  email: string | null;
  lms_status: string | null;
  role: string | null;
}

const SIGNAL_LABELS: Record<string, string> = {
  screen_capture: 'Screen recording API',
  extension: 'Downloader / recorder extension',
  picture_in_picture: 'Picture-in-Picture capture',
  bulk_download_pattern: 'Bulk download pattern',
  devtools: 'Developer tools',
  screenshot_key: 'Screenshot shortcut',
};

export function SecurityIncidentsPanel() {
  const { toast } = useToast();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [users, setUsers] = useState<Record<string, UserInfo>>({});
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchIncidents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('security_incidents')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      const rows = (data as any as Incident[]) ?? [];
      setIncidents(rows);

      const ids = Array.from(new Set(rows.map((r) => r.user_id)));
      if (ids.length) {
        const { data: us } = await supabase
          .from('users')
          .select('id, full_name, email, lms_status, role')
          .in('id', ids);
        const map: Record<string, UserInfo> = {};
        (us ?? []).forEach((u: any) => {
          map[u.id] = { full_name: u.full_name, email: u.email, lms_status: u.lms_status, role: u.role };
        });
        setUsers(map);
      }
    } catch (e) {
      logger.error('Failed to load security incidents', e);
      toast({ title: 'Failed to load security incidents', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rescan = async () => {
    setScanning(true);
    try {
      const { error } = await supabase.functions.invoke('detect-capture-patterns', {
        body: { mode: 'rescan' },
      });
      if (error) throw error;
      toast({ title: 'Pattern scan complete' });
      await fetchIncidents();
    } catch (e) {
      logger.error('Pattern scan failed', e);
      toast({ title: 'Pattern scan failed', variant: 'destructive' });
    } finally {
      setScanning(false);
    }
  };

  const restore = async (incident: Incident) => {
    setBusyId(incident.id);
    try {
      const { error } = await supabase
        .from('users')
        .update({ lms_status: 'active' })
        .eq('id', incident.user_id);
      if (error) throw error;

      const { data: auth } = await supabase.auth.getUser();
      await supabase.from('admin_logs').insert([{
        performed_by: auth?.user?.id ?? null,
        entity_type: 'security',
        entity_id: incident.user_id,
        action: 'security_suspension_reversed',
        description: `Suspension reversed (marked false positive) — ${SIGNAL_LABELS[incident.signal] || incident.signal}`,
        data: {
          target_user_id: incident.user_id,
          incident_id: incident.id,
          signal: incident.signal,
          timestamp: new Date().toISOString(),
        },
      }]);

      toast({ title: 'Access restored', description: 'Marked as false positive and logged.' });
      await fetchIncidents();
    } catch (e) {
      logger.error('Failed to restore access', e);
      toast({ title: 'Failed to restore access', variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <CardTitle>Recording & download incidents</CardTitle>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Detection only — offenders are not warned</span>
          <Button size="sm" variant="outline" onClick={rescan} disabled={scanning}>
            {scanning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Rescan patterns
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-12 text-center text-muted-foreground">Loading…</div>
        ) : incidents.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">No incidents recorded.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Signal</TableHead>
                  <TableHead>Evidence</TableHead>
                  <TableHead>Device / IP</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incidents.map((i) => {
                  const u = users[i.user_id];
                  const suspended = u?.lms_status === 'suspended';
                  const reasons: string[] = i.metadata?.reasons ?? [];
                  const fingerprint: string | undefined = i.metadata?.fingerprint || i.metadata?.api;
                  return (
                    <TableRow key={i.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(i.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{u?.full_name || 'Unknown'}</div>
                        <div className="text-xs text-muted-foreground">{u?.email || i.user_id.slice(0, 8)}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={i.severity === 'critical' ? 'destructive' : 'outline'}>
                          {SIGNAL_LABELS[i.signal] || i.signal}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[280px]">
                        {reasons.length > 0 ? (
                          <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                            {reasons.map((r, idx) => <li key={idx}>{r}</li>)}
                          </ul>
                        ) : (
                          <span className="text-xs text-muted-foreground break-all">
                            {fingerprint || i.page_url || '—'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div>{i.device_label || '—'}</div>
                        <div className="font-mono">{i.ip_address || '—'}</div>
                      </TableCell>
                      <TableCell>
                        {suspended ? (
                          <Badge variant="destructive" className="gap-1">
                            <ShieldAlert className="h-3 w-3" /> Suspended
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <ShieldCheck className="h-3 w-3" /> {u?.lms_status || 'active'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!suspended || busyId === i.id}
                          onClick={() => restore(i)}
                        >
                          {busyId === i.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                          Unsuspend
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default SecurityIncidentsPanel;
