import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { Activity, Download, Search, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ActivityLog {
  id: string;
  user_id: string;
  activity_type: string;
  occurred_at: string;
  metadata: any;
  reference_id: string | null;
  users: {
    email: string;
    role: string;
    full_name: string;
  };
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
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, dateRange, roleFilter, activityFilter]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('user_activity_logs')
        .select(`
          *,
          users (email, role, full_name)
        `)
        .order('occurred_at', { ascending: false });

      // Filter by specific user if userId is provided
      if (userId) {
        query = query.eq('user_id', userId);
      }

      // Apply date filter
      if (dateRange !== 'all') {
        const days = parseInt(dateRange.replace('days', ''));
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        query = query.gte('occurred_at', startDate.toISOString());
      }

      // Apply activity filter
      if (activityFilter !== 'all') {
        query = query.eq('activity_type', activityFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
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
          new Date(log.occurred_at).toISOString(),
          log.users?.email || 'Unknown',
          log.users?.full_name || 'Unknown',
          log.users?.role || 'Unknown',
          log.activity_type,
          JSON.stringify(log.metadata || {})
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
      console.error('Error exporting logs:', error);
      toast({
        title: 'Error',
        description: 'Failed to export logs',
        variant: 'destructive'
      });
    }
  };

  const getActivityBadge = (activity: string) => {
    const activityColors = {
      login: 'bg-blue-100 text-blue-800',
      logout: 'bg-gray-100 text-gray-800',
      video_watched: 'bg-green-100 text-green-800',
      assignment_submitted: 'bg-purple-100 text-purple-800',
      profile_updated: 'bg-yellow-100 text-yellow-800',
      page_visit: 'bg-cyan-100 text-cyan-800',
      module_completed: 'bg-emerald-100 text-emerald-800',
      quiz_attempted: 'bg-orange-100 text-orange-800'
    };
    return activityColors[activity as keyof typeof activityColors] || 'bg-gray-100 text-gray-800';
  };

  const getRoleBadge = (role: string) => {
    const roleColors = {
      student: 'bg-blue-100 text-blue-800',
      mentor: 'bg-green-100 text-green-800',
      admin: 'bg-purple-100 text-purple-800',
      superadmin: 'bg-red-100 text-red-800'
    };
    return roleColors[role as keyof typeof roleColors] || 'bg-gray-100 text-gray-800';
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.users?.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.users?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.activity_type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || log.users?.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <div className="flex justify-between items-center">
            <DialogTitle className="flex items-center">
              <Activity className="w-5 h-5 mr-2" />
              {userId && userName ? `Activity Logs - ${userName}` : 'Global Activity Logs'}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button onClick={exportLogs} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-shrink-0 space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by user or activity..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>

            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1days">Last 24 hours</SelectItem>
                <SelectItem value="7days">Last 7 days</SelectItem>
                <SelectItem value="30days">Last 30 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>

            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="student">Students</SelectItem>
                <SelectItem value="mentor">Mentors</SelectItem>
                <SelectItem value="admin">Admins</SelectItem>
                <SelectItem value="superadmin">Superadmins</SelectItem>
              </SelectContent>
            </Select>

            <Select value={activityFilter} onValueChange={setActivityFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Activities</SelectItem>
                <SelectItem value="admin_created">Admin Created</SelectItem>
                <SelectItem value="admin_deleted">Admin Deleted</SelectItem>
                <SelectItem value="admin_edited">Admin Edited</SelectItem>
                <SelectItem value="assignment_created">Assignment Created</SelectItem>
                <SelectItem value="assignment_deleted">Assignment Deleted</SelectItem>
                <SelectItem value="assignment_submitted">Assignment Submitted</SelectItem>
                <SelectItem value="assignment_updated">Assignment Updated</SelectItem>
                <SelectItem value="certificate_generated">Certificate Generated</SelectItem>
                <SelectItem value="dashboard_access">Dashboard Access</SelectItem>
                <SelectItem value="fees_recorded">Fees Recorded</SelectItem>
                <SelectItem value="file_download">File Download</SelectItem>
                <SelectItem value="invoice_downloaded">Invoice Downloaded</SelectItem>
                <SelectItem value="invoice_generated">Invoice Generated</SelectItem>
                <SelectItem value="login">Login</SelectItem>
                <SelectItem value="logout">Logout</SelectItem>
                <SelectItem value="mentor_created">Mentor Created</SelectItem>
                <SelectItem value="mentor_deleted">Mentor Deleted</SelectItem>
                <SelectItem value="mentor_edited">Mentor Edited</SelectItem>
                <SelectItem value="mentor_updated">Mentor Updated</SelectItem>
                <SelectItem value="module_completed">Module Completed</SelectItem>
                <SelectItem value="module_created">Module Created</SelectItem>
                <SelectItem value="module_deleted">Module Deleted</SelectItem>
                <SelectItem value="module_updated">Module Updated</SelectItem>
                <SelectItem value="page_visit">Page Visit</SelectItem>
                <SelectItem value="profile_updated">Profile Updated</SelectItem>
                <SelectItem value="quiz_attempted">Quiz Attempted</SelectItem>
                <SelectItem value="session_joined">Session Joined</SelectItem>
                <SelectItem value="student_created">Student Created</SelectItem>
                <SelectItem value="student_deleted">Student Deleted</SelectItem>
                <SelectItem value="student_updated">Student Updated</SelectItem>
                <SelectItem value="success_session_created">Success Session Created</SelectItem>
                <SelectItem value="success_session_deleted">Success Session Deleted</SelectItem>
                <SelectItem value="success_session_updated">Success Session Updated</SelectItem>
                <SelectItem value="support_ticket_created">Support Ticket Created</SelectItem>
                <SelectItem value="support_ticket_replied">Support Ticket Replied</SelectItem>
                <SelectItem value="support_ticket_resolved">Support Ticket Resolved</SelectItem>
                <SelectItem value="video_created">Video Created</SelectItem>
                <SelectItem value="video_deleted">Video Deleted</SelectItem>
                <SelectItem value="video_updated">Video Updated</SelectItem>
                <SelectItem value="video_watched">Video Watched</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="text-sm text-muted-foreground">
            Showing {filteredLogs.length} of {logs.length} activities
          </div>
        </div>

        {/* Activity Logs Table */}
        <div className="flex-1 overflow-auto max-h-[70vh] border rounded-md">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-2">Loading activity logs...</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="sticky top-0 bg-background">
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Activity</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(log.occurred_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {log.users?.email || 'Unknown'}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate">
                      {log.users?.full_name || 'Unknown'}
                    </TableCell>
                    <TableCell>
                      <Badge className={getRoleBadge(log.users?.role || '')}>
                        {log.users?.role || 'Unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getActivityBadge(log.activity_type)}>
                        {log.activity_type.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[300px]">
                      {log.metadata ? (
                        <div className="text-sm text-muted-foreground">
                          {(() => {
                            switch (log.activity_type) {
                              case 'page_visit':
                                return `Visited page: ${log.metadata.page || 'Unknown page'}`;
                              case 'login':
                                return `User logged in from ${log.metadata.ip_address || 'unknown IP'}`;
                              case 'logout':
                                return `User logged out after ${log.metadata.session_duration || 'unknown'} minutes`;
                              case 'video_watched':
                                return `Watched video: "${log.metadata.video_title || 'Unknown video'}"${log.metadata.duration ? ` for ${log.metadata.duration} minutes` : ''}`;
                              case 'assignment_submitted':
                                return `Submitted assignment: "${log.metadata.assignment_title || 'Unknown assignment'}"${log.metadata.submission_type ? ` (${log.metadata.submission_type})` : ''}`;
                              case 'profile_updated':
                                return `Updated profile fields: ${log.metadata.updated_fields ? log.metadata.updated_fields.join(', ') : 'profile information'}`;
                              case 'module_completed':
                                return `Completed module: "${log.metadata.module_title || 'Unknown module'}"${log.metadata.score ? ` with score ${log.metadata.score}%` : ''}`;
                              case 'admin_created':
                                return `Created admin account for: ${log.metadata.admin_email || log.metadata.admin_name || 'Unknown admin'}${log.metadata.admin_role ? ` with role ${log.metadata.admin_role}` : ''}`;
                              case 'admin_deleted':
                                return `Deleted admin account: ${log.metadata.admin_email || log.metadata.admin_name || 'Unknown admin'}${log.metadata.reason ? ` (Reason: ${log.metadata.reason})` : ''}`;
                              case 'admin_edited':
                                return `Updated admin account: ${log.metadata.admin_email || log.metadata.admin_name || 'Unknown admin'}${log.metadata.changes ? ` - Changed: ${log.metadata.changes}` : ''}`;
                              case 'assignment_created':
                                return `Created assignment: "${log.metadata.assignment_title || 'Unknown assignment'}"${log.metadata.module_name ? ` for module "${log.metadata.module_name}"` : ''}${log.metadata.due_date ? ` (Due: ${log.metadata.due_date})` : ''}`;
                              case 'assignment_deleted':
                                return `Deleted assignment: "${log.metadata.assignment_title || 'Unknown assignment'}"${log.metadata.module_name ? ` from module "${log.metadata.module_name}"` : ''}`;
                              case 'assignment_updated':
                                return `Updated assignment: "${log.metadata.assignment_title || 'Unknown assignment'}"${log.metadata.changes ? ` - Changes: ${log.metadata.changes}` : ''}`;
                              case 'certificate_generated':
                                return `Generated certificate for student: ${log.metadata.student_email || log.metadata.student_name || 'Unknown student'}${log.metadata.certificate_type ? ` (${log.metadata.certificate_type})` : ''}`;
                              case 'dashboard_access':
                                return `Accessed ${log.metadata.dashboard_type || 'main'} dashboard${log.metadata.source ? ` from ${log.metadata.source}` : ''}`;
                              case 'fees_recorded':
                                return `Recorded fees for student: ${log.metadata.student_email || log.metadata.student_name || 'Unknown student'} - Amount: ${log.metadata.amount || 'Not specified'}${log.metadata.payment_method ? ` via ${log.metadata.payment_method}` : ''}`;
                              case 'file_download':
                                return `Downloaded file: "${log.metadata.file_name || 'Unknown file'}"${log.metadata.file_type ? ` (${log.metadata.file_type})` : ''}${log.metadata.file_size ? ` - Size: ${log.metadata.file_size}` : ''}`;
                              case 'invoice_downloaded':
                                return `Downloaded invoice: ${log.metadata.invoice_id || 'Unknown invoice'}${log.metadata.student_email ? ` for ${log.metadata.student_email}` : ''}`;
                              case 'invoice_generated':
                                return `Generated invoice: ${log.metadata.invoice_id || 'Unknown invoice'} for student: ${log.metadata.student_email || log.metadata.student_name || 'Unknown student'}${log.metadata.amount ? ` - Amount: ${log.metadata.amount}` : ''}`;
                              case 'mentor_created':
                                return `Created mentor account for: ${log.metadata.mentor_email || log.metadata.mentor_name || 'Unknown mentor'}${log.metadata.specialization ? ` - Specialization: ${log.metadata.specialization}` : ''}`;
                              case 'mentor_deleted':
                                return `Deleted mentor account: ${log.metadata.mentor_email || log.metadata.mentor_name || 'Unknown mentor'}${log.metadata.students_count ? ` (Had ${log.metadata.students_count} students)` : ''}`;
                              case 'mentor_edited':
                                return `Updated mentor account: ${log.metadata.mentor_email || log.metadata.mentor_name || 'Unknown mentor'}${log.metadata.changes ? ` - Changes: ${log.metadata.changes}` : ''}`;
                              case 'mentor_updated':
                                return `Updated mentor profile: ${log.metadata.mentor_email || log.metadata.mentor_name || 'Unknown mentor'}${log.metadata.updated_fields ? ` - Fields: ${log.metadata.updated_fields.join(', ')}` : ''}`;
                              case 'module_created':
                                return `Created module: "${log.metadata.module_title || 'Unknown module'}"${log.metadata.module_order ? ` at position ${log.metadata.module_order}` : ''}${log.metadata.lessons_count ? ` with ${log.metadata.lessons_count} lessons` : ''}`;
                              case 'module_deleted':
                                return `Deleted module: "${log.metadata.module_title || 'Unknown module'}"${log.metadata.lessons_count ? ` (Had ${log.metadata.lessons_count} lessons)` : ''}`;
                              case 'module_updated':
                                return `Updated module: "${log.metadata.module_title || 'Unknown module'}"${log.metadata.changes ? ` - Changes: ${log.metadata.changes}` : ''}`;
                              case 'quiz_attempted':
                                return `Attempted quiz: "${log.metadata.quiz_title || 'Unknown quiz'}"${log.metadata.score ? ` - Score: ${log.metadata.score}%` : ''}${log.metadata.attempt_number ? ` (Attempt ${log.metadata.attempt_number})` : ''}`;
                              case 'session_joined':
                                return `Joined session: "${log.metadata.session_title || 'Unknown session'}"${log.metadata.session_type ? ` (${log.metadata.session_type})` : ''}${log.metadata.duration ? ` for ${log.metadata.duration} minutes` : ''}`;
                              case 'student_created':
                                return `Created student account for: ${log.metadata.student_email || log.metadata.student_name || 'Unknown student'}${log.metadata.student_id ? ` (ID: ${log.metadata.student_id})` : ''}${log.metadata.mentor_assigned ? ` - Assigned to mentor: ${log.metadata.mentor_assigned}` : ''}`;
                              case 'student_deleted':
                                return `Deleted student account: ${log.metadata.student_email || log.metadata.student_name || 'Unknown student'}${log.metadata.reason ? ` (Reason: ${log.metadata.reason})` : ''}`;
                              case 'student_updated':
                                return `Updated student: ${log.metadata.student_email || log.metadata.student_name || 'Unknown student'}${log.metadata.changes ? ` - Changes: ${log.metadata.changes}` : ''}${log.metadata.fees_updated ? ` - Fees updated to: ${log.metadata.fees_updated}` : ''}`;
                              case 'success_session_created':
                                return `Created success session: "${log.metadata.session_title || 'Unknown session'}"${log.metadata.scheduled_date ? ` scheduled for ${log.metadata.scheduled_date}` : ''}${log.metadata.mentor_name ? ` with mentor ${log.metadata.mentor_name}` : ''}`;
                              case 'success_session_deleted':
                                return `Deleted success session: "${log.metadata.session_title || 'Unknown session'}"${log.metadata.participants_count ? ` (Had ${log.metadata.participants_count} registered participants)` : ''}`;
                              case 'success_session_updated':
                                return `Updated success session: "${log.metadata.session_title || 'Unknown session'}"${log.metadata.changes ? ` - Changes: ${log.metadata.changes}` : ''}`;
                              case 'support_ticket_created':
                                return `Created support ticket: "${log.metadata.ticket_title || 'Unknown ticket'}"${log.metadata.ticket_type ? ` (Type: ${log.metadata.ticket_type})` : ''}${log.metadata.priority ? ` - Priority: ${log.metadata.priority}` : ''}`;
                              case 'support_ticket_replied':
                                return `Replied to ticket: "${log.metadata.ticket_title || 'Unknown ticket'}"${log.metadata.reply_type ? ` (${log.metadata.reply_type})` : ''}${log.metadata.user_email ? ` for user: ${log.metadata.user_email}` : ''}`;
                              case 'support_ticket_resolved':
                                return `Resolved ticket: "${log.metadata.ticket_title || 'Unknown ticket'}"${log.metadata.resolution_type ? ` (${log.metadata.resolution_type})` : ''}${log.metadata.resolution_time ? ` in ${log.metadata.resolution_time}` : ''}`;
                              case 'video_created':
                                return `Created video: "${log.metadata.video_title || 'Unknown video'}"${log.metadata.module_name ? ` for module "${log.metadata.module_name}"` : ''}${log.metadata.duration ? ` (Duration: ${log.metadata.duration} minutes)` : ''}`;
                              case 'video_deleted':
                                return `Deleted video: "${log.metadata.video_title || 'Unknown video'}"${log.metadata.module_name ? ` from module "${log.metadata.module_name}"` : ''}`;
                              case 'video_updated':
                                return `Updated video: "${log.metadata.video_title || 'Unknown video'}"${log.metadata.changes ? ` - Changes: ${log.metadata.changes}` : ''}`;
                              default:
                                return `Activity completed${log.metadata.description ? `: ${log.metadata.description}` : ''}`;
                            }
                          })()}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No details available</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {filteredLogs.length === 0 && !loading && (
            <div className="text-center py-8 text-muted-foreground">
              No activity logs found matching your criteria.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}