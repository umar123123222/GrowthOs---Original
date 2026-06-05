import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
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
  Users,
  Monitor,
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
  latitude: number | null;
  longitude: number | null;
  geo_accuracy_m: number | null;
  geo_source: string | null;
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

  const stats = [
    {
      label: 'Active Users Now',
      value: totalActive,
      icon: Users,
      accent:
        'text-emerald-600 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-500/10 ring-emerald-200 dark:ring-emerald-500/20',
      cardClass:
        'bg-gradient-to-br from-emerald-50 via-emerald-50/40 to-background border-emerald-200/70 dark:from-emerald-500/10 dark:via-emerald-500/5 dark:border-emerald-500/20',
      bar: 'bg-emerald-500',
      hint: 'Live within the last 90s',
    },
    {
      label: 'Concurrent (Multi-Device)',
      value: totalConcurrent,
      icon: AlertTriangle,
      accent: totalConcurrent
        ? 'text-amber-600 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-500/10 ring-amber-200 dark:ring-amber-500/20'
        : 'text-muted-foreground bg-muted ring-border',
      cardClass: totalConcurrent
        ? 'bg-gradient-to-br from-amber-50 via-amber-50/40 to-background border-amber-200/70 dark:from-amber-500/10 dark:via-amber-500/5 dark:border-amber-500/20'
        : 'bg-card border-border/60',
      bar: totalConcurrent ? 'bg-amber-500' : 'bg-muted-foreground/30',
      hint: 'Users on 2+ devices',
    },
    {
      label: 'Open Sessions',
      value: sessions.length,
      icon: Monitor,
      accent:
        'text-sky-600 dark:text-sky-400 bg-sky-100/70 dark:bg-sky-500/10 ring-sky-200 dark:ring-sky-500/20',
      cardClass:
        'bg-gradient-to-br from-sky-50 via-sky-50/40 to-background border-sky-200/70 dark:from-sky-500/10 dark:via-sky-500/5 dark:border-sky-500/20',
      bar: 'bg-sky-500',
      hint: 'Total active devices',
    },
  ];

  return (
    <div className="space-y-6 p-2 md:p-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50 via-background to-sky-50 dark:from-emerald-500/10 dark:via-background dark:to-sky-500/10 dark:border-emerald-500/20 p-5 md:p-6">
        <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-emerald-300/20 blur-3xl dark:bg-emerald-500/10" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-sky-300/20 blur-3xl dark:bg-sky-500/10" />
        <div className="relative flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-2.5 py-1 ring-1 ring-emerald-500/20">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Live
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
              Active Sessions &amp; Devices
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Live view of students currently using the LMS, with device, location and what's playing right now.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            disabled={loading}
            className="shrink-0 bg-background/80 backdrop-blur border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 dark:border-emerald-500/30 dark:hover:bg-emerald-500/10"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((s) => (
          <Card
            key={s.label}
            className={`relative overflow-hidden hover:shadow-md transition-shadow ${s.cardClass}`}
          >
            <span className={`absolute left-0 top-0 h-full w-1 ${s.bar}`} />
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {s.label}
                  </p>
                  <p className="text-3xl font-semibold tabular-nums text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.hint}</p>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${s.accent}`}>
                  <s.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, IP, city, country, device…"
            className="pl-9 h-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="inline-flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 h-8 rounded-md text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All <span className="opacity-60">({totalActive})</span>
          </button>
          <button
            onClick={() => setFilter('concurrent')}
            className={`px-3 h-8 rounded-md text-sm font-medium transition-colors inline-flex items-center gap-1.5 ${
              filter === 'concurrent'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Concurrent <span className="opacity-60">({totalConcurrent})</span>
          </button>
        </div>
      </div>

      {/* Sessions list */}
      <Card className="border-border/60">
        <CardContent className="p-0">
          {loading && sessions.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              <RefreshCw className="h-6 w-6 mx-auto mb-3 animate-spin opacity-60" />
              Loading active sessions…
            </div>
          ) : visibleUserIds.length === 0 ? (
            <div className="p-16 text-center">
              <div className="mx-auto h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
                <Activity className="h-7 w-7 text-muted-foreground/60" />
              </div>
              <p className="text-sm font-medium text-foreground">No active sessions right now</p>
              <p className="text-xs text-muted-foreground mt-1">
                Try adjusting your filters or check back in a moment.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {visibleUserIds.map((uid) => {
                const list = grouped[uid]
                  .slice()
                  .sort((a, b) => +new Date(b.last_heartbeat_at) - +new Date(a.last_heartbeat_at));
                const u = users[uid];
                const concurrent = list.length > 1;
                const locations = new Set(
                  list.map((s) => [s.city, s.country].filter(Boolean).join(', ')).filter(Boolean)
                );
                const activeVideos = list
                  .map((s) => s.current_activity?.title || s.current_activity?.recording_id)
                  .filter(Boolean) as string[];
                const isOpen = expanded.has(uid);
                return (
                  <div
                    key={uid}
                    className={`group transition-colors ${isOpen ? 'bg-muted/30' : 'hover:bg-muted/20'}`}
                  >
                    <button
                      className="w-full flex items-start gap-3 text-left px-4 sm:px-5 py-4"
                      onClick={() => toggle(uid)}
                    >
                      <div className="pt-1.5 text-muted-foreground">
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                        )}
                      </div>
                      <div className="relative shrink-0">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/15 to-primary/5 text-primary flex items-center justify-center text-sm font-semibold ring-1 ring-primary/20">
                          {(u?.full_name || u?.email || '?').slice(0, 2).toUpperCase()}
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-background" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="font-semibold text-sm truncate text-foreground">
                            {u?.full_name || u?.email || uid}
                          </div>
                          {u?.role && (
                            <Badge variant="secondary" className="text-[10px] capitalize font-medium">
                              {u.role}
                            </Badge>
                          )}
                          {concurrent && (
                            <Badge className="text-[10px] bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20 gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {list.length} devices
                            </Badge>
                          )}
                          {locations.size > 1 && (
                            <Badge
                              variant="outline"
                              className="text-[10px] gap-1 border-rose-200 text-rose-700 dark:border-rose-500/20 dark:text-rose-400"
                            >
                              <MapPin className="h-3 w-3" /> {locations.size} locations
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate mt-0.5">
                          {u?.email} <span className="opacity-50">•</span> Last seen{' '}
                          {formatDistanceToNow(new Date(list[0].last_heartbeat_at), { addSuffix: true })}
                          {activeVideos.length > 0 && (
                            <span className="inline-flex items-center gap-1 ml-1">
                              <span className="opacity-50">•</span>
                              <PlayCircle className="h-3 w-3 text-primary" />
                              <span className="text-foreground/80">
                                {activeVideos.slice(0, 2).join(' / ')}
                                {activeVideos.length > 2 ? ` +${activeVideos.length - 2}` : ''}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>
                      {concurrent && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs gap-1.5 shrink-0 hover:border-rose-300 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            revokeOther(uid, list[0].id);
                          }}
                        >
                          <ShieldOff className="h-3.5 w-3.5" /> Sign out others
                        </Button>
                      )}
                    </button>

                    {isOpen && (
                      <div className="px-4 sm:px-5 pb-4 ml-12 grid gap-2">
                        {list.map((s, idx) => {
                          const activity = s.current_activity || {};
                          const loc =
                            [s.city, s.region, s.country].filter(Boolean).join(', ') || 'Location unknown';
                          const isWatching = activity?.type === 'video';
                          return (
                            <div
                              key={s.id}
                              className="rounded-lg border bg-background p-4 text-sm shadow-sm"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border/60">
                                <div className="flex items-center gap-2 font-medium text-foreground">
                                  <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center">
                                    <Laptop className="h-3.5 w-3.5 text-muted-foreground" />
                                  </div>
                                  {s.device_label || 'Unknown device'}
                                  {idx === 0 && (
                                    <Badge variant="outline" className="text-[10px] gap-1 border-emerald-200 text-emerald-700 dark:border-emerald-500/20 dark:text-emerald-400">
                                      Most recent
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Heartbeat {formatDistanceToNow(new Date(s.last_heartbeat_at), { addSuffix: true })}
                                </div>
                              </div>
                              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 mt-3 text-xs">
                                {(() => {
                                  const isGps = s.geo_source === 'gps';
                                  const tip = isGps
                                    ? `Precise location from device GPS${s.geo_accuracy_m ? ` (±${Math.round(s.geo_accuracy_m)} m)` : ''}.`
                                    : "Approximate — derived from the device's public IP address. Mobile carriers, VPNs and ISP routing can place users hundreds of km away from their actual location.";
                                  return (
                                    <div className="flex items-center gap-1.5 text-muted-foreground" title={tip}>
                                      <MapPin className={`h-3.5 w-3.5 shrink-0 ${isGps ? 'text-emerald-600 dark:text-emerald-400' : ''}`} />
                                      <span className="truncate text-foreground/80">{loc}</span>
                                      {isGps ? (
                                        <span className="text-[10px] uppercase tracking-wide font-medium text-emerald-700 dark:text-emerald-400">
                                          GPS{s.geo_accuracy_m ? ` ±${Math.round(s.geo_accuracy_m)}m` : ''}
                                        </span>
                                      ) : (
                                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">~approx</span>
                                      )}
                                    </div>
                                  );
                                })()}
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                  <Globe className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate text-foreground/80 font-mono">
                                    {s.ip_address || 'IP unknown'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 sm:col-span-2">
                                  <PlayCircle
                                    className={`h-3.5 w-3.5 shrink-0 ${
                                      isWatching ? 'text-primary' : 'text-muted-foreground'
                                    }`}
                                  />
                                  <span className={isWatching ? 'text-foreground/90' : 'text-muted-foreground italic'}>
                                    {isWatching
                                      ? `Watching: ${activity.title || activity.recording_id}`
                                      : 'Idle — no video playing'}
                                  </span>
                                </div>
                                {s.user_agent && (
                                  <div
                                    className="sm:col-span-2 truncate font-mono text-[10px] text-muted-foreground/70 pt-1 border-t border-border/40 mt-1"
                                    title={s.user_agent}
                                  >
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
