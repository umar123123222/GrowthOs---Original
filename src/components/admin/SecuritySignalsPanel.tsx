import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RefreshCw, Loader2, Ban, EraserIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';

/**
 * Admin review surface for heuristic playback signals.
 *
 * These signals are NOT proof of misconduct — DevTools use, tab switching and
 * screen-share APIs all have innocent explanations, and real downloaders (OBS,
 * IDM) are invisible to the browser. Nothing here happens automatically: every
 * consequence requires an admin to click a button.
 */

const SIGNAL_LABELS: Record<string, string> = {
  devtools_open: 'DevTools opened',
  focus_loss_repeated: 'Repeated tab/focus loss',
  display_capture_api: 'Screen capture API used',
  user_media_api: 'Camera/mic capture API used',
  downloader_extension_fingerprint: 'Downloader extension fingerprint',
};

// Why each signal was recorded — shown to admins so the evidence is self-explanatory.
const SIGNAL_REASONS: Record<string, string> = {
  devtools_open:
    'Browser developer tools were detected as open during playback (timing/window-size heuristic). Can also be a curious or technical student.',
  focus_loss_repeated:
    'The student left or blurred the video tab 3+ times in one playback session. Can also be note-taking or multitasking.',
  display_capture_api:
    'The page called the screen-capture API (getDisplayMedia) — typical of in-browser screen recording.',
  user_media_api:
    'The page called the camera/mic capture API (getUserMedia) during playback.',
  downloader_extension_fingerprint:
    'DOM/script artefacts matching a known video-downloader extension (IDM, FDM, Video DownloadHelper, Loom, etc.) were found on the page.',
};

// A "flagged session" = a playback session with at least this many distinct signals.
// Set to 1 so admins can review every student with any signal at all.
const FLAG_THRESHOLD = 1;
const WINDOW_DAYS = 30;


interface SignalRow {
  id: string;
  student_id: string;
  signal_type: string;
  video_id: string | null;
  session_id: string;
  page_url: string | null;
  device_label: string | null;
  dismissed: boolean;
  created_at: string;
}

interface UserInfo {
  full_name: string | null;
  email: string | null;
  lms_status: string | null;
}

interface StudentSummary {
  studentId: string;
  flaggedSessions: number;
  recentSignals: string[];
  lastFlaggedAt: string;
  signals: SignalRow[];
}

export function SecuritySignalsPanel() {
  const { toast } = useToast();
  const [rows, setRows] = useState<SignalRow[]>([]);
  const [users, setUsers] = useState<Record<string, UserInfo>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [detail, setDetail] = useState<StudentSummary | null>(null);

  const fetchSignals = async () => {
    setLoading(true);
    try {
      const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('security_signals' as never)
        .select('*')
        .eq('dismissed', false)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(5000);
      if (error) throw error;
      const list = (data as unknown as SignalRow[]) ?? [];
      setRows(list);

      const ids = Array.from(new Set(list.map((r) => r.student_id)));
      if (ids.length) {
        const { data: us } = await supabase
          .from('users')
          .select('id, full_name, email, lms_status')
          .in('id', ids);
        const map: Record<string, UserInfo> = {};
        (us ?? []).forEach((u: { id: string; full_name: string | null; email: string | null; lms_status: string | null }) => {
          map[u.id] = { full_name: u.full_name, email: u.email, lms_status: u.lms_status };
        });
        setUsers(map);
      }
    } catch (e) {
      logger.error('Failed to load security signals', e);
      toast({ title: 'Failed to load security signals', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSignals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summaries = useMemo<StudentSummary[]>(() => {
    const byStudent = new Map<string, SignalRow[]>();
    rows.forEach((r) => {
      const list = byStudent.get(r.student_id) ?? [];
      list.push(r);
      byStudent.set(r.student_id, list);
    });

    const result: StudentSummary[] = [];
    byStudent.forEach((list, studentId) => {
      const bySession = new Map<string, Set<string>>();
      list.forEach((r) => {
        const set = bySession.get(r.session_id) ?? new Set<string>();
        set.add(r.signal_type);
        bySession.set(r.session_id, set);
      });
      const flaggedSessionIds = Array.from(bySession.entries())
        .filter(([, types]) => types.size >= FLAG_THRESHOLD)
        .map(([sid]) => sid);
      if (flaggedSessionIds.length === 0) return;

      const flaggedRows = list.filter((r) => flaggedSessionIds.includes(r.session_id));
      const sorted = [...flaggedRows].sort((a, b) => b.created_at.localeCompare(a.created_at));
      result.push({
        studentId,
        flaggedSessions: flaggedSessionIds.length,
        recentSignals: Array.from(new Set(sorted.slice(0, 8).map((r) => r.signal_type))),
        lastFlaggedAt: sorted[0]?.created_at ?? '',
        signals: [...list].sort((a, b) => b.created_at.localeCompare(a.created_at)),
      });
    });

    return result.sort((a, b) => b.flaggedSessions - a.flaggedSessions);
  }, [rows]);

  // No email is ever sent from this panel — it is a review/reporting surface only.



  const suspend = async (s: StudentSummary) => {
    setBusy(`suspend-${s.studentId}`);
    try {
      const { error } = await supabase.from('users').update({ lms_status: 'suspended' }).eq('id', s.studentId);
      if (error) throw error;
      const { data: auth } = await supabase.auth.getUser();
      await supabase.from('admin_logs').insert([{
        performed_by: auth?.user?.id ?? null,
        entity_type: 'security',
        entity_id: s.studentId,
        action: 'security_manual_suspension',
        description: `Account suspended manually after review of ${s.flaggedSessions} flagged playback session(s)`,
        data: {
          target_user_id: s.studentId,
          flagged_sessions: s.flaggedSessions,
          signals: s.recentSignals,
          timestamp: new Date().toISOString(),
        },
      }]);
      toast({ title: 'Account suspended' });
      await fetchSignals();
    } catch (e) {
      logger.error('Failed to suspend account', e);
      toast({ title: 'Failed to suspend account', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const dismiss = async (s: StudentSummary) => {
    setBusy(`dismiss-${s.studentId}`);
    try {
      const { error } = await supabase
        .from('security_signals' as never)
        .update({ dismissed: true } as never)
        .eq('student_id', s.studentId)
        .eq('dismissed', false);
      if (error) throw error;
      toast({ title: 'Flags cleared', description: 'Signals hidden from review.' });
      setDetail(null);
      await fetchSignals();
    } catch (e) {
      logger.error('Failed to clear flags', e);
      toast({ title: 'Failed to clear flags', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Playback signal review (last {WINDOW_DAYS} days)</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Heuristic signals only — expect false positives. No automatic action is ever taken.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={fetchSignals} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">Loading…</div>
          ) : summaries.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No students with any playback signals in the last {WINDOW_DAYS} days.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Flagged sessions</TableHead>
                    <TableHead>Most recent signals</TableHead>
                    <TableHead>Why flagged</TableHead>

                    <TableHead>Last flagged</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Manual actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaries.map((s) => {
                    const u = users[s.studentId];
                    return (
                      <TableRow key={s.studentId} className="cursor-pointer" onClick={() => setDetail(s)}>
                        <TableCell>
                          <div className="font-medium text-sm">{u?.full_name || 'Unknown'}</div>
                          <div className="text-xs text-muted-foreground">{u?.email || s.studentId.slice(0, 8)}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={s.flaggedSessions >= 3 ? 'destructive' : 'secondary'}>
                            {s.flaggedSessions}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[280px]">
                          <div className="flex flex-wrap gap-1">
                            {s.recentSignals.map((t) => (
                              <Badge key={t} variant="outline" className="text-[10px]">
                                {SIGNAL_LABELS[t] || t}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[340px]">
                          <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
                            {s.recentSignals.map((t) => (
                              <li key={t}>{SIGNAL_REASONS[t] || 'Heuristic signal recorded during playback.'}</li>
                            ))}
                          </ul>
                        </TableCell>

                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {s.lastFlaggedAt ? new Date(s.lastFlaggedAt).toLocaleString() : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={u?.lms_status === 'suspended' ? 'destructive' : 'secondary'}>
                            {u?.lms_status || 'active'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              disabled={busy === `suspend-${s.studentId}` || u?.lms_status === 'suspended'}
                              onClick={() => suspend(s)}
                            >
                              <Ban className="h-3 w-3 mr-1" /> Suspend
                            </Button>
                            <Button size="sm" variant="ghost" disabled={busy === `dismiss-${s.studentId}`} onClick={() => dismiss(s)}>
                              <EraserIcon className="h-3 w-3 mr-1" /> Dismiss
                            </Button>
                          </div>
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

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Signal history — {detail ? users[detail.studentId]?.full_name || detail.studentId.slice(0, 8) : ''}
            </DialogTitle>
            <DialogDescription>
              Full signal log for context. These are heuristics, not proof of misconduct.
            </DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Signal</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Session</TableHead>
                <TableHead>Video</TableHead>
                <TableHead>Page</TableHead>
                <TableHead>Device</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(detail?.signals ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs">{SIGNAL_LABELS[r.signal_type] || r.signal_type}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[320px]">
                    {SIGNAL_REASONS[r.signal_type] || 'Heuristic signal recorded during playback.'}
                  </TableCell>
                  <TableCell className="text-xs font-mono">{r.session_id.slice(0, 8)}…</TableCell>
                  <TableCell className="text-xs font-mono">{r.video_id ? `${r.video_id.slice(0, 8)}…` : '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground break-all max-w-[220px]">{r.page_url || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.device_label || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

        </DialogContent>
      </Dialog>
    </>
  );
}

export default SecuritySignalsPanel;
