import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Globe,
  Laptop,
  MapPin,
  PlayCircle,
  RefreshCw,
  Search,
  ShieldOff,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type SessionRow = {
  id: string;
  user_id: string;
  session_token: string;
  device_label: string | null;
  user_agent: string | null;
  ip_address: string | null;
  country: string | null;
  city: string | null;
  region: string | null;
  current_activity: any;
  first_seen_at: string;
  last_heartbeat_at: string;
  ended_at: string | null;
};

type UserMini = { id: string; full_name: string | null; email: string | null; role: string | null };

const ACTIVE_WINDOW_MS = 90_000;

export function ActiveSessionsManagement() {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [users, setUsers] = useState<Record<string, UserMini>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'concurrent'>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    const sinceIso = new Date(Date.now() - ACTIVE_WINDOW_MS).toISOString();
    const { data: rows, error } = await supabase
      .from('student_sessions' as any)
      .select('*')
      .is('ended_at', null)
      .gte('last_heartbeat_at', sinceIso)
      .order('last_heartbeat_at', { ascending: false });
    if (error) {
      toast({ title: 'Failed to load sessions', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }
    const list = (rows || []) as unknown as SessionRow[];
    setSessions(list);

    const ids = Array.from(new Set(list.map((s) => s.user_id)));
    if (ids.length) {
      const { data: us } = await supabase.from('users').select('id, full_name, email, role').in('id', ids);
      const map: Record<string, UserMini> = {};
      (us || []).forEach((u: any) => (map[u.id] = u));
      setUsers(map);
    } else {
      setUsers({});
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  const grouped = useMemo(() => {
    const g: Record<string, SessionRow[]> = {};
    for (const s of sessions) {
      (g[s.user_id] ||= []).push(s);
    }
    return g;
  }, [sessions]);

  const visibleUserIds = useMemo(() => {
    const q = search.trim().toLowerCase();
    return Object.keys(grouped).filter((uid) => {
      const isConcurrent = grouped[uid].length > 1;
      if (filter === 'concurrent' && !isConcurrent) return false;
      if (!q) return true;
      const u = users[uid];
      return (
        u?.full_name?.toLowerCase().includes(q) ||
        u?.email?.toLowerCase().includes(q) ||
        grouped[uid].some(
          (s) =>
            s.country?.toLowerCase().includes(q) ||
            s.city?.toLowerCase().includes(q) ||
            s.ip_address?.toLowerCase().includes(q) ||
            s.device_label?.toLowerCase().includes(q)
        )
      );
    });
  }, [grouped, users, search, filter]);

  const totalActive = Object.keys(grouped).length;
  const totalConcurrent = Object.values(grouped).filter((v) => v.length > 1).length;

  const toggle = (uid: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });

  const revokeOther = async (userId: string, keepId: string) => {
    const { error } = await supabase
      .from('student_sessions' as any)
      .update({ ended_at: new Date().toISOString() })
      .eq('user_id', userId)
      .neq('id', keepId);
    if (error) {
      toast({ title: 'Failed to revoke', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Other devices signed out', description: 'Kept the most recent device only.' });
    load();
  };

  return (
    <div className="space-y-6 p-2 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Active Sessions & Devices</h1>
          <p className="text-muted-foreground text-sm">
            Live view of students currently using the LMS, with device, location and what's playing right now.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Users Now</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold flex items-center gap-2">
              <Activity className="h-6 w-6 text-emerald-600" />
              {totalActive}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Concurrent (Multi-Device)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold flex items-center gap-2">
              <AlertTriangle className={`h-6 w-6 ${totalConcurrent ? 'text-amber-500' : 'text-muted-foreground'}`} />
              {totalConcurrent}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold flex items-center gap-2">
              <Laptop className="h-6 w-6 text-primary" />
              {sessions.length}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, IP, city, country, device…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>
            All ({totalActive})
          </Button>
          <Button
            size="sm"
            variant={filter === 'concurrent' ? 'default' : 'outline'}
            onClick={() => setFilter('concurrent')}
            className={filter === 'concurrent' ? '' : ''}
          >
            <AlertTriangle className="h-4 w-4 mr-1" /> Concurrent ({totalConcurrent})
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading && sessions.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Loading active sessions…</div>
          ) : visibleUserIds.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <Activity className="h-10 w-10 mx-auto mb-2 opacity-40" />
              No active sessions match your filters right now.
            </div>
          ) : (
            <div className="divide-y">
              {visibleUserIds.map((uid) => {
                const list = grouped[uid].slice().sort((a, b) => +new Date(b.last_heartbeat_at) - +new Date(a.last_heartbeat_at));
                const u = users[uid];
                const concurrent = list.length > 1;
                const locations = new Set(list.map((s) => [s.city, s.country].filter(Boolean).join(', ')).filter(Boolean));
                const activeVideos = list
                  .map((s) => s.current_activity?.title || s.current_activity?.recording_id)
                  .filter(Boolean) as string[];
                const isOpen = expanded.has(uid);
                return (
                  <div key={uid} className="px-4 py-3">
                    <button
                      className="w-full flex items-start gap-3 text-left"
                      onClick={() => toggle(uid)}
                    >
                      <div className="pt-1">
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </div>
                      <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
                        {(u?.full_name || u?.email || '?').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="font-medium truncate">{u?.full_name || u?.email || uid}</div>
                          {u?.role && (
                            <Badge variant="outline" className="text-xs capitalize">
                              {u.role}
                            </Badge>
                          )}
                          {concurrent && (
                            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-300 gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {list.length} devices
                            </Badge>
                          )}
                          {locations.size > 1 && (
                            <Badge variant="outline" className="text-xs gap-1 border-rose-300 text-rose-700">
                              <MapPin className="h-3 w-3" /> {locations.size} locations
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {u?.email} • Last seen {formatDistanceToNow(new Date(list[0].last_heartbeat_at), { addSuffix: true })}
                          {activeVideos.length > 0 && (
                            <>
                              {' '}• <PlayCircle className="h-3 w-3 inline -mt-0.5" /> {activeVideos.slice(0, 2).join(' / ')}
                              {activeVideos.length > 2 ? ` +${activeVideos.length - 2}` : ''}
                            </>
                          )}
                        </div>
                      </div>
                      {concurrent && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            revokeOther(uid, list[0].id);
                          }}
                        >
                          <ShieldOff className="h-3 w-3" /> Sign out others
                        </Button>
                      )}
                    </button>

                    {isOpen && (
                      <div className="mt-3 ml-12 grid gap-2">
                        {list.map((s) => {
                          const activity = s.current_activity || {};
                          const loc = [s.city, s.region, s.country].filter(Boolean).join(', ') || 'Location unknown';
                          return (
                            <div key={s.id} className="rounded-lg border bg-muted/30 p-3 text-sm">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2 font-medium">
                                  <Laptop className="h-4 w-4" />
                                  {s.device_label || 'Unknown device'}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Heartbeat {formatDistanceToNow(new Date(s.last_heartbeat_at), { addSuffix: true })}
                                </div>
                              </div>
                              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 mt-2 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1.5">
                                  <MapPin className="h-3.5 w-3.5" /> {loc}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Globe className="h-3.5 w-3.5" /> {s.ip_address || 'IP unknown'}
                                </div>
                                <div className="flex items-center gap-1.5 sm:col-span-2">
                                  <PlayCircle className="h-3.5 w-3.5" />
                                  {activity?.type === 'video'
                                    ? `Watching: ${activity.title || activity.recording_id}`
                                    : 'Idle (no video playing)'}
                                </div>
                                {s.user_agent && (
                                  <div className="sm:col-span-2 truncate font-mono opacity-70" title={s.user_agent}>
                                    {s.user_agent}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ActiveSessionsManagement;
