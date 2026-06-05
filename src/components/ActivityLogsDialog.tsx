
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { Activity, Download, Search, ChevronDown, ChevronRight, Inbox } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { RoleGuard } from '@/components/RoleGuard';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';

interface ActivityLog {
  id: string;
  entity_id: string;
  entity_type: string;
  action: string;
  description: string | null;
  created_at: string;
  data: any;
  performed_by: string | null;
  users: {
    email: string;
    role: string;
    full_name: string;
  } | null;
}

interface ActivityLogsDialogProps {
  children: React.ReactNode;
  userId?: string; // Optional user ID to filter logs for specific user
  userName?: string; // Optional user name for display
}

export function ActivityLogsDialog({ children, userId, userName }: ActivityLogsDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [activityFilter, setActivityFilter] = useState('all');
  const [dateRange, setDateRange] = useState('7days');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, dateRange, roleFilter, activityFilter]);

  const fetchLogs = async () => {
    if (!user) return;

    // Only superadmins, admins, and enrollment managers can access activity logs
    if (!['superadmin', 'admin', 'enrollment_manager'].includes(user.role || '')) {
      setLogs([]);
      return;
    }

    setLoading(true);
    try {
      let query = supabase
        .from('admin_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      // Filter by specific user if userId is provided
      if (userId) {
        query = query.or(`performed_by.eq.${userId},data->>target_user_id.eq.${userId}`);
      }

      // Apply date filter
      if (dateRange !== 'all') {
        const days = parseInt(dateRange.replace('days', ''));
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        query = query.gte('created_at', startDate.toISOString());
      }

      // Apply activity filter
      if (activityFilter !== 'all') {
        query = query.eq('action', activityFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Collect all unique user IDs (performers + targets)
      const performerIds = (data || []).map(l => l.performed_by).filter(Boolean) as string[];
      const targetIds = (data || []).map(l => (l.data as any)?.target_user_id).filter(Boolean) as string[];
      const allUserIds = [...new Set([...performerIds, ...targetIds])];

      // Collect recording/session IDs to enrich legacy logs without titles
      const recordingIds = new Set<string>();
      const sessionIds = new Set<string>();
      (data || []).forEach((l: any) => {
        const d = l.data || {};
        const isVideoAction = ['video_watched', 'video_opened'].includes(l.action);
        const isVideoPage = l.action === 'page_visit' && typeof d.page === 'string' && d.page.startsWith('/video-player');
        const isSessionEvent = l.action === 'live_session_joined';
        const refId = d.reference_id || d.videoId || d.recording_id || l.entity_id;
        if ((isVideoAction || isVideoPage) && refId && !d.video_title) recordingIds.add(refId);
        if (isSessionEvent && refId && !d.session_title) sessionIds.add(refId);
      });

      // Batch fetch users, recordings, sessions in parallel
      const userMap = new Map<string, { email: string; role: string; full_name: string }>();
      const recordingMap = new Map<string, { title: string; module_id: string | null }>();
      const moduleMap = new Map<string, { title: string; course_id: string | null }>();
      const courseMap = new Map<string, string>();
      const sessionMap = new Map<string, { title: string; start_time: string | null; mentor_name: string | null }>();

      const fetchUsers = async () => {
        if (!allUserIds.length) return;
        const batchSize = 100;
        const batches: string[][] = [];
        for (let i = 0; i < allUserIds.length; i += batchSize) batches.push(allUserIds.slice(i, i + batchSize));
        const results = await Promise.all(batches.map(b =>
          supabase.from('users').select('id, email, role, full_name').in('id', b)
        ));
        results.forEach(({ data: users }) => {
          (users || []).forEach(u => userMap.set(u.id, { email: u.email, full_name: u.full_name, role: u.role }));
        });
      };
      const fetchRecordings = async () => {
        if (!recordingIds.size) return;
        const { data: recs } = await supabase
          .from('available_lessons')
          .select('id, recording_title, module')
          .in('id', Array.from(recordingIds));
        (recs || []).forEach((r: any) => recordingMap.set(r.id, { title: r.recording_title, module_id: r.module }));
      };
      const fetchSessions = async () => {
        if (!sessionIds.size) return;
        const { data: ss } = await supabase
          .from('success_sessions')
          .select('id, title, start_time, mentor_name')
          .in('id', Array.from(sessionIds));
        (ss || []).forEach((s: any) => sessionMap.set(s.id, { title: s.title, start_time: s.start_time, mentor_name: s.mentor_name }));
      };
      await Promise.all([fetchUsers(), fetchRecordings(), fetchSessions()]);

      // Resolve modules + courses for fetched recordings
      const moduleIds = Array.from(new Set(Array.from(recordingMap.values()).map(r => r.module_id).filter(Boolean))) as string[];
      if (moduleIds.length) {
        const { data: mods } = await supabase.from('modules').select('id, title, course_id').in('id', moduleIds);
        (mods || []).forEach((m: any) => moduleMap.set(m.id, { title: m.title, course_id: m.course_id }));
        const courseIds = Array.from(new Set((mods || []).map((m: any) => m.course_id).filter(Boolean))) as string[];
        if (courseIds.length) {
          const { data: courses } = await supabase.from('courses').select('id, title').in('id', courseIds);
          (courses || []).forEach((c: any) => courseMap.set(c.id, c.title));
        }
      }

      const restrictSuperadmin = user.role === 'admin' || user.role === 'enrollment_manager';

      const logsWithUsers = (data || [])
        .filter(log => {
          if (!restrictSuperadmin) return true;
          const performer = log.performed_by ? userMap.get(log.performed_by) : null;
          return !performer || performer.role !== 'superadmin';
        })
        .map(log => {
          const performer = log.performed_by ? userMap.get(log.performed_by) : null;
          const d: any = log.data || {};
          const targetUserId = d.target_user_id;
          const target = targetUserId ? userMap.get(targetUserId) : null;
          const displayUser = performer || (target ? { ...target } : null);

          // Enrich data with recording/session/course context for legacy rows
          const enrichedData: any = { ...d };
          const refId = d.reference_id || d.videoId || d.recording_id || log.entity_id;
          const rec = refId ? recordingMap.get(refId) : null;
          if (rec) {
            if (!enrichedData.video_title) enrichedData.video_title = rec.title;
            const mod = rec.module_id ? moduleMap.get(rec.module_id) : null;
            if (mod && !enrichedData.module_name) enrichedData.module_name = mod.title;
            const courseTitle = mod?.course_id ? courseMap.get(mod.course_id) : null;
            if (courseTitle && !enrichedData.course_name) enrichedData.course_name = courseTitle;
          }
          const sess = refId ? sessionMap.get(refId) : null;
          if (sess) {
            if (!enrichedData.session_title) enrichedData.session_title = sess.title;
            if (!enrichedData.session_date && sess.start_time) enrichedData.session_date = sess.start_time;
            if (!enrichedData.host_name && sess.mentor_name) enrichedData.host_name = sess.mentor_name;
          }

          return {
            ...log,
            data: enrichedData,
            users: displayUser ? { email: displayUser.email, role: displayUser.role, full_name: displayUser.full_name } : null,
            target_user: target ? { email: target.email, full_name: target.full_name } : null,
          };
        });

      setLogs(logsWithUsers);
    } catch (error) {
      logger.error('Error fetching activity logs:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch activity logs',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };


  const exportLogs = async () => {
    try {
      const csvContent = [
        ['Date', 'User', 'Name', 'Role', 'Activity', 'Details'].join(','),
        ...filteredLogs.map(log => [
          new Date(log.created_at).toISOString(),
          log.users?.email || 'Unknown',
          log.users?.full_name || 'Unknown',
          log.users?.role || 'Unknown',
          log.action,
          JSON.stringify(log.data || {})
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activity_logs_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Success',
        description: 'Activity logs exported successfully'
      });
    } catch (error) {
      logger.error('Error exporting logs:', error);
      toast({
        title: 'Error',
        description: 'Failed to export logs',
        variant: 'destructive'
      });
    }
  };

  const getActivityBadge = (activity: string) => {
    const activityColors: Record<string, string> = {
      login: 'bg-blue-100 text-blue-800',
      logout: 'bg-gray-100 text-gray-800',
      page_visit: 'bg-cyan-100 text-cyan-800',
      video_watched: 'bg-green-100 text-green-800',
      video_opened: 'bg-teal-100 text-teal-800',
      live_session_joined: 'bg-indigo-100 text-indigo-800',
      assignment_submitted: 'bg-purple-100 text-purple-800',
      profile_updated: 'bg-yellow-100 text-yellow-800',
      module_completed: 'bg-emerald-100 text-emerald-800',
      fee_extension_granted: 'bg-amber-100 text-amber-800',
      lms_suspended: 'bg-red-100 text-red-800',
      scheduled_suspension_created: 'bg-orange-100 text-orange-800',
      // Invoice/payment related
      payment_recorded: 'bg-emerald-100 text-emerald-800',
      invoice_status_changed: 'bg-amber-100 text-amber-800',
      invoice_created: 'bg-blue-100 text-blue-800',
      invoice_updated: 'bg-sky-100 text-sky-800',
      invoice_resent: 'bg-orange-100 text-orange-800',
    };
    return activityColors[activity] || 'bg-gray-100 text-gray-800';
  };

  const getRoleBadge = (role: string) => {
    const roleColors = {
      student: 'bg-blue-100 text-blue-800',
      mentor: 'bg-green-100 text-green-800',
      admin: 'bg-purple-100 text-purple-800',
      superadmin: 'bg-red-100 text-red-800',
      enrollment_manager: 'bg-pink-100 text-pink-800'
    };
    return roleColors[role as keyof typeof roleColors] || 'bg-gray-100 text-gray-800';
  };

  const formatLogDetails = (log: ActivityLog): string => {
    const data: any = log.data || {};
    switch (log.action) {
      case 'video_watched':
        return `Completed video: ${data.video_title || data.videoId || 'Unknown'}`;
      case 'video_opened':
        return `Opened video: ${data.video_title || 'Unknown'}${data.already_watched ? ' (already completed)' : ''}`;
      case 'live_session_joined':
        return `Joined live session: ${data.session_title || 'Unknown session'}`;
      case 'fee_extension_granted':
        return `Fee due date extended${data.installment_number ? ` (Installment #${data.installment_number})` : ''}`;
      case 'lms_suspended':
        return `Student suspended${data.student_name ? `: ${data.student_name}` : ''}`;
      case 'scheduled_suspension_created':
        return `Suspension scheduled${data.schedule_suspend_date ? ` for ${new Date(data.schedule_suspend_date).toLocaleDateString()}` : ''}`;
      case 'page_visit': {
        const page: string = data.page || '/';
        if (page.startsWith('/video-player')) {
          return `Opened video: ${data.video_title || 'Unknown video'}`;
        }
        const pageNames: Record<string, string> = {
          '/': 'Dashboard',
          '/dashboard': 'Dashboard',
          '/videos': 'Videos library',
          '/live-sessions': 'Live sessions',
          '/assignments': 'Assignments',
          '/leaderboard': 'Leaderboard',
          '/notifications': 'Notifications',
          '/profile': 'Profile',
          '/messages': 'Messages',
          '/support': 'Support',
        };
        return `Visited: ${pageNames[page] || page}`;
      }
      default:
        return log.description || log.action.replace(/_/g, ' ');
    }
  };


  const formatSubDetails = (log: ActivityLog): React.ReactNode => {
    const data: any = log.data || {};
    const performerName = log.users?.full_name;

    const isVideoPage = log.action === 'page_visit' && typeof data.page === 'string' && data.page.startsWith('/video-player');
    if (log.action === 'video_watched' || log.action === 'video_opened' || (isVideoPage && data.video_title)) {
      const completed = log.action === 'video_watched' || data.already_watched;
      return (
        <div className="space-y-0.5 text-xs">
          {data.course_name && <div>Course: <span className="font-medium">{data.course_name}</span></div>}
          {data.module_name && <div>Module: <span className="font-medium">{data.module_name}</span></div>}
          <div className={completed ? 'text-green-600 font-medium' : 'text-amber-600 font-medium'}>
            {completed ? '✓ Completed' : '○ Not completed'}
          </div>
        </div>
      );
    }


    if (log.action === 'live_session_joined') {
      return (
        <div className="space-y-0.5 text-xs">
          {data.session_date && <div>Scheduled: {new Date(data.session_date).toLocaleString()}</div>}
          {data.host_name && <div>Host: {data.host_name}</div>}
        </div>
      );
    }

    if (log.action === 'fee_extension_granted') {
      return (
        <div className="space-y-0.5 text-xs">
          {data.previous_due_date && (
            <div>From: <span className="line-through opacity-70">{new Date(data.previous_due_date).toLocaleDateString()}</span></div>
          )}
          {data.new_due_date && (
            <div>To: <span className="font-medium text-amber-700">{new Date(data.new_due_date).toLocaleDateString()}</span></div>
          )}
          {data.reason && <div className="italic">Reason: "{data.reason}"</div>}
          {performerName && <div>By: <span className="font-medium">{performerName}</span></div>}
        </div>
      );
    }

    if (log.action === 'lms_suspended' || log.action === 'scheduled_suspension_created') {
      const note = data.suspension_note || data.note || data.reason;
      return (
        <div className="space-y-0.5 text-xs">
          {note && <div className="text-destructive font-medium">Reason: {note}</div>}
          {data.schedule_suspend_date && (
            <div>Scheduled: {new Date(data.schedule_suspend_date).toLocaleDateString()}</div>
          )}
          {data.auto_unsuspend_date && (
            <div>Auto-unsuspend: {new Date(data.auto_unsuspend_date).toLocaleDateString()}</div>
          )}
          {performerName ? (
            <div>By: <span className="font-medium">{performerName}</span></div>
          ) : (
            <div className="text-muted-foreground italic">By: System (auto)</div>
          )}
        </div>
      );
    }

    if (log.action === 'admin_note') {
      const note = data.note || data.suspension_note;
      return (
        <div className="space-y-0.5">
          {note && <div className="text-xs italic">"{note}"</div>}
          {performerName && <div className="text-xs">By: {performerName}</div>}
        </div>
      );
    }

    return null;
  };




  const filteredLogs = logs.filter(log => {
    const matchesSearch = (log.users?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.users?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.action.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesRole = roleFilter === 'all' || log.users?.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const getInitials = (name?: string | null) => {
    if (!name) return '—';
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase()).join('') || '—';
  };

  // Avatar color palettes by role — semantic but role-tinted via subtle accents
  const roleAvatarClass = (role?: string) => {
    switch (role) {
      case 'superadmin': return 'bg-rose-100 text-rose-700';
      case 'admin': return 'bg-violet-100 text-violet-700';
      case 'enrollment_manager': return 'bg-pink-100 text-pink-700';
      case 'mentor': return 'bg-emerald-100 text-emerald-700';
      case 'student': return 'bg-sky-100 text-sky-700';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const roleLabel = (role?: string | null) => {
    if (!role) return 'System';
    return role.replace(/_/g, ' ');
  };

  return (
    <RoleGuard allowedRoles={['admin', 'superadmin', 'enrollment_manager']}>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          {children}
        </DialogTrigger>
        <DialogContent className="max-w-6xl h-[90vh] flex flex-col overflow-hidden p-0 gap-0">
          {/* Header */}
          <DialogHeader className="flex-shrink-0 border-b bg-background px-6 py-4 space-y-1">
            <div className="flex justify-between items-start gap-4">
              <div className="min-w-0">
                <DialogTitle className="text-xl font-semibold tracking-tight">
                  {userId && userName ? `Activity Logs — ${userName}` : 'Activity Logs'}
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Track and monitor all system events and user actions.
                </p>
              </div>
            </div>
          </DialogHeader>

          {/* Toolbar */}
          <div className="flex-shrink-0 border-b bg-muted/40 px-4 py-3 flex flex-wrap items-center gap-2 justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="Search activity..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-64 h-9 bg-background"
                />
              </div>

              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-36 h-9 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="student">Students</SelectItem>
                  <SelectItem value="mentor">Mentors</SelectItem>
                  <SelectItem value="admin">Admins</SelectItem>
                  <SelectItem value="enrollment_manager">Enrollment Managers</SelectItem>
                  {user?.role === 'superadmin' && (
                    <SelectItem value="superadmin">Superadmins</SelectItem>
                  )}
                </SelectContent>
              </Select>

              <Select value={activityFilter} onValueChange={setActivityFilter}>
                <SelectTrigger className="w-48 h-9 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Activities</SelectItem>
                  <SelectItem value="login">Login</SelectItem>
                  <SelectItem value="logout">Logout</SelectItem>
                  <SelectItem value="page_visit">Page Visit</SelectItem>
                  <SelectItem value="video_opened">Video Opened</SelectItem>
                  <SelectItem value="video_watched">Video Completed</SelectItem>
                  <SelectItem value="live_session_joined">Live Session Joined</SelectItem>
                  <SelectItem value="assignment_submitted">Assignment Submitted</SelectItem>
                  <SelectItem value="profile_updated">Profile Updated</SelectItem>
                  <SelectItem value="module_completed">Module Completed</SelectItem>
                  <SelectItem value="fee_extension_granted">Fee Extension Granted</SelectItem>
                  <SelectItem value="lms_suspended">LMS Suspended</SelectItem>
                  <SelectItem value="scheduled_suspension_created">Suspension Scheduled</SelectItem>
                  <SelectItem value="payment_recorded">Payment Recorded</SelectItem>
                  <SelectItem value="invoice_status_changed">Invoice Status Changed</SelectItem>
                  <SelectItem value="invoice_created">Invoice Created</SelectItem>
                  <SelectItem value="invoice_updated">Invoice Updated</SelectItem>
                  <SelectItem value="invoice_resent">Invoice Resent</SelectItem>
                </SelectContent>
              </Select>

              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-36 h-9 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1days">Last 24 hours</SelectItem>
                  <SelectItem value="7days">Last 7 days</SelectItem>
                  <SelectItem value="30days">Last 30 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={exportLogs} size="sm" className="h-9">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>

          {/* Body */}
          <ScrollArea className="flex-1 min-h-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="ml-3 text-sm text-muted-foreground">Loading activity logs...</span>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Inbox className="w-6 h-6 text-muted-foreground" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">No activity logs found</h3>
                <p className="text-xs text-muted-foreground max-w-xs mt-1">
                  Try adjusting your filters or search to find what you're looking for.
                </p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[850px]">
                <thead className="bg-muted/60 sticky top-0 z-10 border-b border-border">
                  <tr>
                    <th className="px-5 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider w-40">Timestamp</th>
                    <th className="px-5 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider w-60">Performed By</th>
                    <th className="px-5 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider w-44">Activity</th>
                    <th className="px-5 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Summary</th>
                    <th className="px-5 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider w-12 text-center" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredLogs.map((log) => {
                    const data: any = log.data || {};
                    const isOpen = expandedRows.has(log.id);
                    const ts = new Date(log.created_at);
                    const isSystem = !log.performed_by;
                    const displayName = isSystem
                      ? ((log as any).target_user?.full_name || 'System')
                      : (log.users?.full_name || 'Deleted User');
                    const displayEmail = isSystem
                      ? ((log as any).target_user?.email || '')
                      : (log.users?.email || '');
                    const role = isSystem
                      ? ((log as any).target_user ? log.users?.role : null)
                      : log.users?.role;
                    const subDetails = formatSubDetails(log);
                    const hasMetadata = data && Object.keys(data).length > 0;
                    const canExpand = !!subDetails || hasMetadata;

                    return (
                      <React.Fragment key={log.id}>
                        <tr
                          className={cn(
                            'group transition-colors',
                            isOpen ? 'bg-primary/5' : 'hover:bg-muted/40',
                            canExpand && 'cursor-pointer'
                          )}
                          onClick={() => canExpand && toggleRow(log.id)}
                        >
                          <td className="px-5 py-3 align-top">
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-foreground">
                                {ts.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {ts.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3 align-top">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={cn(
                                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ring-2 ring-background shrink-0',
                                roleAvatarClass(role || undefined)
                              )}>
                                {isSystem && !(log as any).target_user ? 'SY' : getInitials(displayName)}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-sm font-medium text-foreground truncate" title={displayEmail}>
                                  {displayName}
                                </span>
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border border-border bg-muted text-muted-foreground w-fit">
                                  {roleLabel(role)}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3 align-top">
                            <span className={cn(
                              'inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border',
                              getActivityBadge(log.action),
                              'border-transparent'
                            )}>
                              {log.action.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-5 py-3 align-top">
                            <span className="text-sm text-muted-foreground line-clamp-2">
                              {formatLogDetails(log)}
                            </span>
                          </td>
                          <td className="px-5 py-3 align-top text-center">
                            {canExpand && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); toggleRow(log.id); }}
                                className={cn(
                                  'p-1 rounded-md transition-colors',
                                  isOpen ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                                )}
                                aria-label={isOpen ? 'Collapse row' : 'Expand row'}
                              >
                                {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </button>
                            )}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-primary/[0.03]">
                            <td colSpan={5} className="px-5 pb-5 pt-0">
                              <div className="bg-background border border-primary/20 rounded-lg p-4 shadow-sm space-y-4">
                                {subDetails && (
                                  <div>
                                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                                      Highlights
                                    </div>
                                    <div className="text-sm text-foreground">{subDetails}</div>
                                  </div>
                                )}
                                {hasMetadata && (
                                  <div>
                                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-2">
                                      <Activity className="w-3 h-3" /> Extended Metadata
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-3 gap-x-8">
                                      {Object.entries(data).map(([k, v]) => {
                                        const isObj = v !== null && typeof v === 'object';
                                        const valStr = isObj ? JSON.stringify(v, null, 2) : String(v ?? '—');
                                        return (
                                          <div key={k} className="space-y-1 min-w-0">
                                            <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">
                                              {k.replace(/_/g, ' ')}
                                            </label>
                                            {isObj ? (
                                              <pre className="text-[11px] font-mono text-foreground bg-muted/60 border border-border rounded px-2 py-1.5 whitespace-pre-wrap break-all max-h-40 overflow-auto">
                                                {valStr}
                                              </pre>
                                            ) : (
                                              <p className="text-xs text-foreground break-words" title={valStr}>
                                                {valStr}
                                              </p>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </ScrollArea>

          {/* Footer */}
          <div className="flex-shrink-0 px-6 py-3 bg-muted/40 border-t border-border flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{filteredLogs.length}</span> of <span className="font-semibold text-foreground">{logs.length}</span> entries
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </RoleGuard>
  );
}
