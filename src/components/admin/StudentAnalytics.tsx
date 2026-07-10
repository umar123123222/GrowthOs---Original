import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Play, CheckCircle, Clock, FileText, Target, TrendingUp, Users, Video, ChevronLeft, ChevronRight, Search, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PaymentReports } from './PaymentReports';
import { StudentEngagementDetail } from './StudentEngagementDetail';
import { PerformanceMetrics } from './PerformanceMetrics';
interface StudentAnalytics {
  id: string;
  full_name: string;
  email: string;
  status: string;
  enrollment_date: string;
  videos_watched: number;
  videos_total: number;
  assignments_completed: number;
  assignments_total: number;
  last_activity: string;
  progress_percentage: number;
  current_module?: string;
}
interface OverviewStats {
  total_students: number;
  active_students: number;
  avg_progress: number;
  total_completions: number;
  videos_watched_today: number;
  assignments_submitted_today: number;
}
interface StudentAnalyticsProps {
  hidePayments?: boolean;
}

const PAGE_SIZE = 25;

// Cache last successful response so re-mounts/tab switches render instantly
let _cache: {
  students: StudentAnalytics[];
  overview: OverviewStats;
  filtered_count: number;
  page: number;
  search: string;
  ts: number;
} | null = null;
const CACHE_TTL_MS = 60_000;

export const StudentAnalytics = ({ hidePayments = false }: StudentAnalyticsProps) => {
  const [students, setStudents] = useState<StudentAnalytics[]>(_cache?.students ?? []);
  const [activeTab, setActiveTab] = useState<'overview' | 'engagement' | 'payments' | string>('overview');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filteredCount, setFilteredCount] = useState<number>(_cache?.filtered_count ?? 0);
  const [overviewStats, setOverviewStats] = useState<OverviewStats>(
    _cache?.overview ?? {
      total_students: 0,
      active_students: 0,
      avg_progress: 0,
      total_completions: 0,
      videos_watched_today: 0,
      assignments_submitted_today: 0,
    }
  );
  const [loading, setLoading] = useState(false);
  const [detailStudent, setDetailStudent] = useState<StudentAnalytics | null>(null);
  const { toast } = useToast();

  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + students.length;
  const currentStudents = students;

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  const fetchPage = async (page: number, search: string) => {
    const cacheHit =
      _cache &&
      _cache.page === page &&
      _cache.search === search &&
      Date.now() - _cache.ts < CACHE_TTL_MS;
    if (cacheHit) {
      setStudents(_cache!.students);
      setOverviewStats(_cache!.overview);
      setFilteredCount(_cache!.filtered_count);
      return;
    }
    try {
      if (students.length === 0) setLoading(true);
      const { data, error } = await supabase.rpc('get_student_analytics_summary' as any, {
        p_page: page,
        p_page_size: PAGE_SIZE,
        p_search: search || null,
      });
      if (error) throw error;
      const payload = (data || {}) as {
        overview?: OverviewStats;
        students?: StudentAnalytics[];
        filtered_count?: number;
      };
      const nextStudents = payload.students ?? [];
      const nextOverview = payload.overview ?? {
        total_students: 0,
        active_students: 0,
        avg_progress: 0,
        total_completions: 0,
        videos_watched_today: 0,
        assignments_submitted_today: 0,
      };
      const nextFiltered = payload.filtered_count ?? nextStudents.length;
      setStudents(nextStudents);
      setOverviewStats(nextOverview);
      setFilteredCount(nextFiltered);
      _cache = {
        students: nextStudents,
        overview: nextOverview,
        filtered_count: nextFiltered,
        page,
        search,
        ts: Date.now(),
      };
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast({
        title: 'Error',
        description: 'Failed to load student analytics',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch when tab opens, page changes, or search changes
  useEffect(() => {
    if (activeTab !== 'overview' && activeTab !== 'engagement') return;
    fetchPage(currentPage, debouncedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, currentPage, debouncedSearch]);

  // Alias to keep downstream JSX (which uses filteredStudents) working
  const filteredStudents = students;

  if (loading && students.length === 0) {
    return <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>)}
          </div>
        </div>
      </div>;
  }
  const statCards = [
    { label: 'Total Students', value: overviewStats.total_students, hint: 'All enrolled', icon: Users, tone: 'sky' },
    { label: 'Active Students', value: overviewStats.active_students, hint: 'Last 30 days', icon: TrendingUp, tone: 'emerald' },
    { label: 'Avg Progress', value: `${overviewStats.avg_progress}%`, hint: 'Overall completion', icon: Target, tone: 'violet' },
    { label: 'Completions', value: overviewStats.total_completions, hint: 'Finished courses', icon: CheckCircle, tone: 'teal' },
    { label: 'Videos Today', value: overviewStats.videos_watched_today, hint: 'Views today', icon: Video, tone: 'amber' },
    { label: 'Submissions Today', value: overviewStats.assignments_submitted_today, hint: 'New submissions', icon: FileText, tone: 'indigo' },
  ] as const;

  const toneMap: Record<string, { text: string; bg: string; ring: string; accent: string; gradient: string }> = {
    sky:     { text: 'text-sky-600',     bg: 'bg-sky-500/10',     ring: 'ring-sky-500/20',     accent: 'bg-sky-500',     gradient: 'from-sky-50/80' },
    emerald: { text: 'text-emerald-600', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/20', accent: 'bg-emerald-500', gradient: 'from-emerald-50/80' },
    violet:  { text: 'text-violet-600',  bg: 'bg-violet-500/10',  ring: 'ring-violet-500/20',  accent: 'bg-violet-500',  gradient: 'from-violet-50/80' },
    teal:    { text: 'text-teal-600',    bg: 'bg-teal-500/10',    ring: 'ring-teal-500/20',    accent: 'bg-teal-500',    gradient: 'from-teal-50/80' },
    amber:   { text: 'text-amber-600',   bg: 'bg-amber-500/10',   ring: 'ring-amber-500/20',   accent: 'bg-amber-500',   gradient: 'from-amber-50/80' },
    indigo:  { text: 'text-indigo-600',  bg: 'bg-indigo-500/10',  ring: 'ring-indigo-500/20',  accent: 'bg-indigo-500',  gradient: 'from-indigo-50/80' },
    rose:    { text: 'text-rose-600',    bg: 'bg-rose-500/10',    ring: 'ring-rose-500/20',    accent: 'bg-rose-500',    gradient: 'from-rose-50/80' },
    fuchsia: { text: 'text-fuchsia-600', bg: 'bg-fuchsia-500/10', ring: 'ring-fuchsia-500/20', accent: 'bg-fuchsia-500', gradient: 'from-fuchsia-50/80' },
  };

  const activePct = overviewStats.total_students > 0
    ? Math.round((overviewStats.active_students / overviewStats.total_students) * 100)
    : 0;

  return <div className="p-6 space-y-8">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-sky-500/5 to-violet-500/10">
        <div className="absolute -top-20 -right-16 h-64 w-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />
        <div className="relative p-6 md:p-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex flex-col gap-2 max-w-xl">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-primary uppercase tracking-wider">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Analytics Overview
            </div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">Student Analytics</h1>
            <p className="text-muted-foreground">A live snapshot of student progress, engagement and activity across your platform.</p>
          </div>
          <div className="grid grid-cols-3 gap-4 lg:min-w-[420px]">
            <div className="rounded-xl bg-background/60 backdrop-blur border border-border/60 p-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Enrolled</div>
              <div className="text-2xl font-semibold text-foreground tabular-nums mt-1">{overviewStats.total_students}</div>
            </div>
            <div className="rounded-xl bg-background/60 backdrop-blur border border-border/60 p-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Active</div>
              <div className="text-2xl font-semibold text-emerald-600 tabular-nums mt-1">{activePct}%</div>
            </div>
            <div className="rounded-xl bg-background/60 backdrop-blur border border-border/60 p-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Avg Progress</div>
              <div className="text-2xl font-semibold text-violet-600 tabular-nums mt-1">{overviewStats.avg_progress}%</div>
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          {!hidePayments && (
            <TabsTrigger value="payments" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Payments
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview" className="space-y-8">
          {/* Overview Stats */}
          <div>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Key Metrics</h2>
              <span className="text-xs text-muted-foreground">Updated just now</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
              {statCards.map(({ label, value, hint, icon: Icon, tone }) => {
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
                      <div className={`text-3xl font-semibold tracking-tight tabular-nums ${t.text}`}>
                        {value}
                      </div>
                      <div className="mt-1 text-xs font-semibold text-foreground/80">{label}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>


          <PerformanceMetrics />

          {/* Students section */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Students</h2>
                <p className="text-sm text-muted-foreground">
                  Showing {filteredCount === 0 ? 0 : startIndex + 1}–{Math.min(startIndex + students.length, filteredCount)} of {filteredCount}
                  {debouncedSearch && ` (filtered from ${overviewStats.total_students})`}
                </p>
              </div>
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search by name or email…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-background"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {currentStudents.map(student => (
                <Card
                  key={student.id}
                  onClick={() => setDetailStudent(student)}
                  className="group cursor-pointer border-border/60 bg-card hover:border-primary/40 hover:shadow-md transition-all duration-200"
                >
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-11 h-11">
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                          {student.full_name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base font-semibold text-foreground truncate">
                          {student.full_name}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground truncate">{student.email}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          student.status === 'active'
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] uppercase tracking-wide'
                            : 'border-border bg-muted text-muted-foreground text-[10px] uppercase tracking-wide'
                        }
                      >
                        {student.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between items-baseline mb-1.5">
                        <span className="text-xs font-medium text-muted-foreground">Overall Progress</span>
                        <span className="text-sm font-semibold text-foreground tabular-nums">{student.progress_percentage}%</span>
                      </div>
                      <Progress value={student.progress_percentage} className="h-1.5" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Play className="w-3 h-3 text-muted-foreground" />
                          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Videos</span>
                        </div>
                        <div className="text-sm font-semibold text-foreground tabular-nums">
                          {student.videos_watched}<span className="text-muted-foreground font-normal">/{student.videos_total}</span>
                        </div>
                      </div>
                      <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <FileText className="w-3 h-3 text-muted-foreground" />
                          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Assignments</span>
                        </div>
                        <div className="text-sm font-semibold text-foreground tabular-nums">
                          {student.assignments_completed}<span className="text-muted-foreground font-normal">/{student.assignments_total}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-border/60">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        Last active
                      </div>
                      <span className="text-xs font-medium text-foreground">
                        {student.last_activity && !isNaN(new Date(student.last_activity).getTime())
                          ? new Date(student.last_activity).toLocaleDateString()
                          : 'Never'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
          
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-6">
              <p className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages} ({filteredCount} students)
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                {(() => {
                  const pages: (number | string)[] = [];
                  if (totalPages <= 7) {
                    for (let i = 1; i <= totalPages; i++) pages.push(i);
                  } else {
                    pages.push(1);
                    if (currentPage > 3) pages.push('...');
                    const start = Math.max(2, currentPage - 1);
                    const end = Math.min(totalPages - 1, currentPage + 1);
                    for (let i = start; i <= end; i++) pages.push(i);
                    if (currentPage < totalPages - 2) pages.push('...');
                    pages.push(totalPages);
                  }
                  return pages.map((page, idx) =>
                    typeof page === 'string' ? (
                      <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">…</span>
                    ) : (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className="w-8 h-8 p-0"
                      >
                        {page}
                      </Button>
                    )
                  );
                })()}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="progress" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Detailed Progress Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {students.map(student => <div key={student.id} className="flex items-center space-x-4 p-3 border rounded-lg">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback>{student.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="font-medium">{student.full_name}</div>
                      <div className="text-sm text-gray-500">
                        Videos: {student.videos_watched}/{student.videos_total} | 
                        Assignments: {student.assignments_completed}/{student.assignments_total}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">{student.progress_percentage}%</div>
                      <Progress value={student.progress_percentage} className="w-20 h-2" />
                    </div>
                  </div>)}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="engagement" className="space-y-8">
          {/* Overview Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            {statCards.map(({ label, value, hint, icon: Icon, tone, bg }) => (
              <Card key={label} className="group relative overflow-hidden border-border/60 bg-card hover:border-border transition-all duration-200 hover:shadow-md">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-2 rounded-lg ${bg}`}>
                      <Icon className={`w-4 h-4 ${tone}`} />
                    </div>
                  </div>
                  <div className="text-3xl font-semibold tracking-tight text-foreground tabular-nums">{value}</div>
                  <div className="mt-1 text-xs font-medium text-muted-foreground">{label}</div>
                  <div className="mt-2 text-[11px] text-muted-foreground/70">{hint}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Search Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Engagement leaderboards</h2>
              <p className="text-sm text-muted-foreground">Top students by recent activity and course completion.</p>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by name or email…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-background"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[
              {
                title: 'Most Active Students',
                subtitle: 'Ranked by most recent activity',
                icon: TrendingUp,
                accent: 'text-sky-600',
                accentBg: 'bg-sky-500/10',
                items: [...filteredStudents]
                  .sort((a, b) => {
                    const dateA = a.last_activity ? new Date(a.last_activity).getTime() : 0;
                    const dateB = b.last_activity ? new Date(b.last_activity).getTime() : 0;
                    return dateB - dateA;
                  })
                  .slice(0, 5),
                meta: (s: StudentAnalytics) =>
                  s.last_activity && !isNaN(new Date(s.last_activity).getTime())
                    ? new Date(s.last_activity).toLocaleDateString()
                    : 'Never',
              },
              {
                title: 'Completion Leaders',
                subtitle: 'Ranked by overall course progress',
                icon: CheckCircle,
                accent: 'text-emerald-600',
                accentBg: 'bg-emerald-500/10',
                items: [...filteredStudents]
                  .sort((a, b) => b.progress_percentage - a.progress_percentage)
                  .slice(0, 5),
                meta: (s: StudentAnalytics) =>
                  `${s.videos_watched} videos · ${s.assignments_completed} assignments`,
              },
            ].map(({ title, subtitle, icon: Icon, accent, accentBg, items, meta }) => (
              <Card key={title} className="border-border/60 bg-card">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${accentBg}`}>
                      <Icon className={`w-4 h-4 ${accent}`} />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold text-foreground">{title}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {items.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">No matching students</div>
                  ) : (
                    <ul className="divide-y divide-border/60">
                      {items.map((student, index) => (
                        <li
                          key={student.id}
                          onClick={() => setDetailStudent(student)}
                          className="flex items-center gap-3 py-3 cursor-pointer group hover:bg-muted/40 -mx-2 px-2 rounded-md transition-colors"
                        >
                          <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-semibold tabular-nums ${
                            index === 0
                              ? 'bg-amber-500/15 text-amber-600'
                              : index === 1
                              ? 'bg-slate-400/20 text-slate-600'
                              : index === 2
                              ? 'bg-orange-500/15 text-orange-700'
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {index + 1}
                          </div>
                          <Avatar className="w-9 h-9">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                              {student.full_name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                              {student.full_name}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">{meta(student)}</div>
                          </div>
                          <div className="flex flex-col items-end gap-1 min-w-[64px]">
                            <span className="text-xs font-semibold text-foreground tabular-nums">
                              {student.progress_percentage}%
                            </span>
                            <Progress value={student.progress_percentage} className="h-1 w-14" />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>


        <TabsContent value="payments" className="space-y-4">
          <PaymentReports />
        </TabsContent>
      </Tabs>
      <StudentEngagementDetail
        open={!!detailStudent}
        onOpenChange={(o) => { if (!o) setDetailStudent(null); }}
        student={detailStudent ? { id: detailStudent.id, full_name: detailStudent.full_name, email: detailStudent.email } : null}
      />
    </div>;
};