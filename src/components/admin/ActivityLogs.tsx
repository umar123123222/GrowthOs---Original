import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { Activity, Download, Search, Filter } from 'lucide-react';
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
  };
}

export const ActivityLogs = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [activityFilter, setActivityFilter] = useState('all');
  const [dateRange, setDateRange] = useState('7days');
  const { toast } = useToast();

  useEffect(() => {
    fetchLogs();
  }, [dateRange, roleFilter, activityFilter]);

  const fetchLogs = async () => {
    try {
      let query = supabase
        .from('user_activity_logs')
        .select(`
          *,
          users (email, role)
        `)
        .order('occurred_at', { ascending: false })
        .limit(100);

      // Apply date filter
      if (dateRange !== 'all') {
        const days = parseInt(dateRange.replace('days', ''));
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        query = query.gte('occurred_at', startDate.toISOString());
      }

      // Apply role filter
      if (roleFilter !== 'all') {
        // This would need a join or separate query in production
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
        ['Date', 'User', 'Role', 'Activity', 'Details'].join(','),
        ...filteredLogs.map(log => [
          new Date(log.occurred_at).toISOString(),
          log.users?.email || 'Unknown',
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
      login: 'bg-blue-500',
      logout: 'bg-gray-500',
      video_watched: 'bg-green-500',
      assignment_submitted: 'bg-purple-500',
      profile_updated: 'bg-yellow-500',
      page_visit: 'bg-cyan-500'
    };
    return activityColors[activity as keyof typeof activityColors] || 'bg-gray-500';
  };

  const getRoleBadge = (role: string) => {
    const roleColors = {
      student: 'bg-blue-500',
      mentor: 'bg-green-500',
      admin: 'bg-purple-500',
      superadmin: 'bg-red-500'
    };
    return roleColors[role as keyof typeof roleColors] || 'bg-gray-500';
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.users?.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.activity_type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || log.users?.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading activity logs...</div>;
  }

  return (
    <Card className="h-[80vh] flex flex-col">
      <CardHeader className="flex-shrink-0 border-b">
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            Activity Logs
          </CardTitle>
          <Button onClick={exportLogs} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-6 space-y-4 min-h-0">
        {/* Fixed Filters */}
        <div className="flex-shrink-0 space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
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
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Activities</SelectItem>
                <SelectItem value="login">Login</SelectItem>
                <SelectItem value="logout">Logout</SelectItem>
                <SelectItem value="video_watched">Video Watched</SelectItem>
                <SelectItem value="assignment_submitted">Assignment Submitted</SelectItem>
                <SelectItem value="profile_updated">Profile Updated</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="text-sm text-muted-foreground">
            Showing {filteredLogs.length} of {logs.length} activities
          </div>
        </div>

        {/* Scrollable Activity Logs Table */}
        <div className="flex-1 flex flex-col border rounded-md overflow-hidden min-h-0">
          {/* Fixed Table Header */}
          <div className="flex-shrink-0 border-b bg-muted/50">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-0">
                  <TableHead className="font-medium h-12">Timestamp</TableHead>
                  <TableHead className="font-medium h-12">User</TableHead>
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
                      {new Date(log.occurred_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {log.users?.email || 'Unknown'}
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
                          {JSON.stringify(log.metadata)}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No details</span>
                      )}
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
        </div>
      </CardContent>
    </Card>
  );
};