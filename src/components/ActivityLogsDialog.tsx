
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
import { useAuth } from '@/hooks/useAuth';
import { RoleGuard } from '@/components/RoleGuard';
import { safeQuery } from '@/lib/database-safety';
import { logger } from '@/lib/logger';

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
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, dateRange, roleFilter, activityFilter]);

  const fetchLogs = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      let query = supabase
        .from('admin_logs')
        .select('*')
        .order('created_at', { ascending: false });

      // Role-based filtering
      if (user.role === 'admin' || user.role === 'enrollment_manager') {
        // Admins and Enrollment Managers can see all activities except superadmin activities
        const { data: users } = await supabase
          .from('users')
          .select('id')
          .neq('role', 'superadmin');
        
        if (users) {
          const allowedUserIds = users.map(u => u.id);
          query = query.in('performed_by', allowedUserIds);
        }
      } else if (user.role !== 'superadmin') {
        // Only superadmins, admins, and enrollment managers can access activity logs
        setLogs([]);
        setLoading(false);
        return;
      }

      // Filter by specific user if userId is provided
      if (userId) {
        query = query.eq('performed_by', userId);
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
      
      // Fetch user details for each log separately since foreign key doesn't exist
      const logsWithUsers = await Promise.all((data || []).map(async (log) => {
        let userData = null;
        if (log.performed_by) {
        const userResult = await safeQuery(
          supabase
            .from('users')
            .select('email, role, full_name')
            .eq('id', log.performed_by)
            .maybeSingle() as any,
          `fetch user for activity log ${log.performed_by}`
        );
        userData = userResult.data;
        }
        return { ...log, users: userData };
      }));
      
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
      assignment_submitted: 'bg-purple-100 text-purple-800',
      profile_updated: 'bg-yellow-100 text-yellow-800',
      module_completed: 'bg-emerald-100 text-emerald-800',
      // Invoice/payment related
      payment_recorded: 'bg-emerald-100 text-emerald-800',
      invoice_status_changed: 'bg-amber-100 text-amber-800',
      invoice_created: 'bg-blue-100 text-blue-800',
      invoice_updated: 'bg-sky-100 text-sky-800',
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

  const filteredLogs = logs.filter(log => {
    const matchesSearch = (log.users?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.users?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.action.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesRole = roleFilter === 'all' || log.users?.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <RoleGuard allowedRoles={['admin', 'superadmin', 'enrollment_manager']}>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          {children}
        </DialogTrigger>
        <DialogContent className="max-w-6xl h-[90vh] flex flex-col overflow-hidden">
          {/* Fixed Header */}
          <DialogHeader className="flex-shrink-0 border-b bg-background">
            <div className="flex justify-between items-center p-6 pb-4">
              <DialogTitle className="text-lg font-semibold">
                {userId && userName ? `Activity Logs - ${userName}` : 'Activity Logs'}
              </DialogTitle>
              <Button onClick={exportLogs} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
            
            {/* Fixed Filters */}
            <div className="px-6 pb-4 space-y-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="relative">
                  <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 transform -translate-y-1/2" />
                  <Input
                    placeholder="Search by user or activity"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>

                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7days">Last 7 days</SelectItem>
                    <SelectItem value="1days">Last 24 hours</SelectItem>
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
                    <SelectItem value="enrollment_manager">Enrollment Managers</SelectItem>
                    {user?.role === 'superadmin' && (
                      <SelectItem value="superadmin">Superadmins</SelectItem>
                    )}
                  </SelectContent>
                </Select>

                <Select value={activityFilter} onValueChange={setActivityFilter}>
                  <SelectTrigger className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Activities</SelectItem>
                    <SelectItem value="login">Login</SelectItem>
                    <SelectItem value="logout">Logout</SelectItem>
                    <SelectItem value="page_visit">Page Visit</SelectItem>
                    <SelectItem value="video_watched">Video Watched</SelectItem>
                    <SelectItem value="assignment_submitted">Assignment Submitted</SelectItem>
                    <SelectItem value="profile_updated">Profile Updated</SelectItem>
                    <SelectItem value="module_completed">Module Completed</SelectItem>
                    {/* Invoice/Payments */}
                    <SelectItem value="payment_recorded">Payment Recorded</SelectItem>
                    <SelectItem value="invoice_status_changed">Invoice Status Changed</SelectItem>
                    <SelectItem value="invoice_created">Invoice Created</SelectItem>
                    <SelectItem value="invoice_updated">Invoice Updated</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="text-sm text-muted-foreground">
                Showing {filteredLogs.length} of {logs.length} activities
              </div>
            </div>
          </DialogHeader>

          {/* Scrollable Content */}
          <div className="flex-1 flex flex-col min-h-0 border rounded-md mx-6 mb-6 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="ml-2">Loading activity logs...</span>
              </div>
            ) : (
              <>
                {/* Fixed Table Header */}
                <div className="flex-shrink-0 border-b bg-muted/50">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-0">
                        <TableHead className="font-medium h-12">Timestamp</TableHead>
                        <TableHead className="font-medium h-12">User</TableHead>
                        <TableHead className="font-medium h-12">Name</TableHead>
                        <TableHead className="font-medium h-12">Role</TableHead>
                        <TableHead className="font-medium h-12">Activity</TableHead>
                        <TableHead className="font-medium h-12">Details</TableHead>
                      </TableRow>
                    </TableHeader>
                  </Table>
                </div>

                {/* Scrollable Table Body */}
                <ScrollArea className="flex-1">
                  <Table>
                    <TableBody>
                      {filteredLogs.map((log) => (
                         <TableRow key={log.id} className="hover:bg-muted/30">
                           <TableCell className="whitespace-nowrap font-mono text-sm">
                             {new Date(log.created_at).toLocaleString('en-US', {
                               month: 'numeric',
                               day: 'numeric',
                               year: 'numeric',
                               hour: 'numeric',
                               minute: '2-digit',
                               second: '2-digit',
                               hour12: true
                             })}
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
                             <Badge className={getActivityBadge(log.action)}>
                               {log.action.replace('_', ' ')}
                             </Badge>
                           </TableCell>
                           <TableCell className="max-w-[300px]">
                             <div className="text-sm text-muted-foreground">
                               {log.description || log.action}
                               {log.data && Object.keys(log.data).length > 0 && (
                                 <div className="text-xs mt-1 text-gray-500">
                                   {JSON.stringify(log.data)}
                                 </div>
                               )}
                             </div>
                           </TableCell>
                         </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {filteredLogs.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No activity logs found matching your criteria.
                    </div>
                  )}
                </ScrollArea>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </RoleGuard>
  );
}
