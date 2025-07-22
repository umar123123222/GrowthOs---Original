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
        .order('occurred_at', { ascending: false })
        .limit(200);

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
      <DialogContent className="max-w-6xl max-h-[85vh] flex flex-col">
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
                <SelectItem value="login">Login</SelectItem>
                <SelectItem value="logout">Logout</SelectItem>
                <SelectItem value="video_watched">Video Watched</SelectItem>
                <SelectItem value="assignment_submitted">Assignment Submitted</SelectItem>
                <SelectItem value="profile_updated">Profile Updated</SelectItem>
                <SelectItem value="module_completed">Module Completed</SelectItem>
                <SelectItem value="quiz_attempted">Quiz Attempted</SelectItem>
                <SelectItem value="page_visit">Page Visit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="text-sm text-muted-foreground">
            Showing {filteredLogs.length} of {logs.length} activities
          </div>
        </div>

        {/* Activity Logs Table */}
        <ScrollArea className="flex-1">
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
                        <div className="text-sm text-muted-foreground truncate">
                          {typeof log.metadata === 'object' 
                            ? Object.entries(log.metadata).map(([key, value]) => 
                                `${key}: ${value}`
                              ).join(', ')
                            : String(log.metadata)
                          }
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No details</span>
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
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}