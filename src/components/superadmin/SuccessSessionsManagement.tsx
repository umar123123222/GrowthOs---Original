import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock, Video, User, Link as LinkIcon, Plus, Edit, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface SuccessSession {
  id: string;
  title: string;
  description: string;
  mentor_name: string;
  mentor_id?: string;
  schedule_date: string;
  start_time: string;
  end_time: string;
  link: string;
  status: string;
  zoom_meeting_id?: string;
  zoom_passcode?: string;
  host_login_email?: string;
  host_login_pwd?: string;
  created_at: string;
  created_by: string;
}

interface SessionFormData {
  title: string;
  description: string;
  mentor_name: string;
  mentor_id: string;
  schedule_date: string;
  start_time: string;
  end_time: string;
  link: string;
  zoom_meeting_id: string;
  zoom_passcode: string;
  host_login_email: string;
  host_login_pwd: string;
  status: string;
}

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

export function SuccessSessionsManagement() {
  const [sessions, setSessions] = useState<SuccessSession[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<SuccessSession | null>(null);
  const [formData, setFormData] = useState<SessionFormData>({
    title: '',
    description: '',
    mentor_name: '',
    mentor_id: '',
    schedule_date: '',
    start_time: '',
    end_time: '',
    link: '',
    zoom_meeting_id: '',
    zoom_passcode: '',
    host_login_email: '',
    host_login_pwd: '',
    status: 'upcoming'
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchSessions();
    fetchUsers();
  }, []);

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('success_sessions')
        .select('*')
        .order('start_time', { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch success sessions",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, role')
        .in('role', ['admin', 'superadmin', 'mentor'])
        .order('full_name', { ascending: true });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Error",
        description: "Failed to fetch users",
        variant: "destructive"
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'upcoming':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return 'Invalid date';
    }
  };

  const formatTime = (timeString: string) => {
    try {
      return format(new Date(timeString), 'h:mm a');
    } catch {
      return 'Invalid time';
    }
  };

  const getDayOfWeek = (dateString: string) => {
    try {
      return format(new Date(dateString), 'EEEE');
    } catch {
      return 'Invalid day';
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      mentor_name: '',
      mentor_id: '',
      schedule_date: '',
      start_time: '',
      end_time: '',
      link: '',
      zoom_meeting_id: '',
      zoom_passcode: '',
      host_login_email: '',
      host_login_pwd: '',
      status: 'upcoming'
    });
    setEditingSession(null);
  };

  const handleOpenDialog = (session?: SuccessSession) => {
    if (session) {
      setEditingSession(session);
      setFormData({
        title: session.title,
        description: session.description || '',
        mentor_name: session.mentor_name || '',
        mentor_id: '', // We'll need to find the user ID based on mentor_name
        schedule_date: session.schedule_date || '',
        start_time: session.start_time || '',
        end_time: session.end_time || '',
        link: session.link || '',
        zoom_meeting_id: session.zoom_meeting_id || '',
        zoom_passcode: session.zoom_passcode || '',
        host_login_email: session.host_login_email || '',
        host_login_pwd: session.host_login_pwd || '',
        status: session.status || 'upcoming'
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Find the selected user to get their name
      const selectedUser = users.find(user => user.id === formData.mentor_id);
      
      // Combine date with time to create proper timestamps
      const combineDateTime = (date: string, time: string) => {
        if (!date || !time) return null;
        return `${date}T${time}:00`;
      };

      const sessionData = {
        title: formData.title,
        description: formData.description,
        mentor_name: selectedUser ? selectedUser.full_name : formData.mentor_name,
        mentor_id: formData.mentor_id,
        schedule_date: formData.schedule_date,
        start_time: combineDateTime(formData.schedule_date, formData.start_time),
        end_time: formData.end_time ? combineDateTime(formData.schedule_date, formData.end_time) : null,
        link: formData.link,
        zoom_meeting_id: formData.zoom_meeting_id,
        zoom_passcode: formData.zoom_passcode,
        host_login_email: formData.host_login_email,
        host_login_pwd: formData.host_login_pwd,
        status: formData.status
      };

      if (editingSession) {
        const { error } = await supabase
          .from('success_sessions')
          .update(sessionData)
          .eq('id', editingSession.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Session updated successfully",
        });
      } else {
        const { error } = await supabase
          .from('success_sessions')
          .insert([sessionData]);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Session created successfully",
        });
      }

      fetchSessions();
      handleCloseDialog();
    } catch (error) {
      toast({
        title: "Error",
        description: editingSession ? "Failed to update session" : "Failed to create session",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this session?')) return;

    try {
      const { error } = await supabase
        .from('success_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Session deleted successfully",
      });

      fetchSessions();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete session",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading success sessions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center">
        <div className="animate-fade-in">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-orange-600 bg-clip-text text-transparent">
            Success Sessions Management
          </h2>
          <p className="text-muted-foreground mt-1 text-lg">Manage scheduled success sessions and their status</p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              onClick={() => handleOpenDialog()}
              className="hover-scale bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Schedule Session
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingSession ? 'Edit Success Session' : 'Schedule New Success Session'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Session Title *</label>
                  <Input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    required
                    placeholder="Enter session title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Host/Mentor *</label>
                  <Select 
                    value={formData.mentor_id} 
                    onValueChange={(value) => setFormData({...formData, mentor_id: value})}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a mentor, admin, or superadmin" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border z-50 max-h-60">
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{user.full_name}</span>
                            <span className="text-xs text-muted-foreground">{user.email} • {user.role}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Enter session description"
                  rows={3}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Zoom Meeting ID *</label>
                  <Input
                    type="text"
                    value={formData.zoom_meeting_id}
                    onChange={(e) => setFormData({...formData, zoom_meeting_id: e.target.value})}
                    required
                    placeholder="Enter Zoom Meeting ID"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Zoom Passcode *</label>
                  <Input
                    type="text"
                    value={formData.zoom_passcode}
                    onChange={(e) => setFormData({...formData, zoom_passcode: e.target.value})}
                    required
                    placeholder="Enter Zoom Passcode"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Host Login Email *</label>
                  <Input
                    type="email"
                    value={formData.host_login_email}
                    onChange={(e) => setFormData({...formData, host_login_email: e.target.value})}
                    required
                    placeholder="Enter host login email"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Host Login Password *</label>
                  <Input
                    type="password"
                    value={formData.host_login_pwd}
                    onChange={(e) => setFormData({...formData, host_login_pwd: e.target.value})}
                    required
                    placeholder="Enter host login password"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Schedule Date *</label>
                  <Input
                    type="date"
                    value={formData.schedule_date}
                    onChange={(e) => setFormData({...formData, schedule_date: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Start Time *</label>
                  <Input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({...formData, start_time: e.target.value})}
                    required
                    step="900"
                    placeholder="HH:MM"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End Time</label>
                  <Input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData({...formData, end_time: e.target.value})}
                    step="900"
                    placeholder="HH:MM"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Session Link *</label>
                  <Input
                    type="url"
                    value={formData.link}
                    onChange={(e) => setFormData({...formData, link: e.target.value})}
                    placeholder="https://..."
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Status *</label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upcoming">Upcoming</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600">
                  {editingSession ? 'Update Session' : 'Schedule Session'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50 animate-fade-in">
        <CardHeader className="bg-gradient-to-r from-orange-50 to-red-50 border-b">
          <CardTitle className="flex items-center text-xl">
            <Video className="w-6 h-6 mr-3 text-orange-600" />
            All Success Sessions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {sessions.length === 0 ? (
            <div className="text-center py-16 animate-fade-in">
              <Video className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-muted-foreground mb-2">No sessions found</h3>
              <p className="text-muted-foreground">Schedule your first success session to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold min-w-[200px]">Session Title</TableHead>
                    <TableHead className="font-semibold min-w-[140px]">Host</TableHead>
                    <TableHead className="font-semibold min-w-[120px]">Schedule Date</TableHead>
                    <TableHead className="font-semibold min-w-[100px]">Day</TableHead>
                    <TableHead className="font-semibold min-w-[140px]">Time</TableHead>
                    <TableHead className="font-semibold min-w-[100px]">Status</TableHead>
                    <TableHead className="font-semibold min-w-[140px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session, index) => (
                    <TableRow 
                      key={session.id} 
                      className="hover:bg-gray-50 transition-colors animate-fade-in"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <TableCell className="font-medium min-w-[200px]">
                        <div className="font-semibold truncate max-w-[180px]" title={session.title}>
                          {session.title}
                        </div>
                        {session.description && (
                          <div className="text-sm text-muted-foreground mt-1 truncate max-w-[180px]" title={session.description}>
                            {session.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="min-w-[140px]">
                        <div className="flex items-center">
                          <User className="w-4 h-4 mr-2 text-gray-500 flex-shrink-0" />
                          <span className="font-medium truncate">{session.mentor_name || 'TBD'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[120px]">
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-2 text-gray-500 flex-shrink-0" />
                          <span className="whitespace-nowrap">{formatDate(session.schedule_date)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[100px]">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 whitespace-nowrap">
                          {getDayOfWeek(session.schedule_date)}
                        </Badge>
                      </TableCell>
                      <TableCell className="min-w-[140px]">
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 mr-2 text-gray-500 flex-shrink-0" />
                          <span className="whitespace-nowrap">{formatTime(session.start_time)}</span>
                          {session.end_time && (
                            <span className="text-gray-400 ml-1 whitespace-nowrap">- {formatTime(session.end_time)}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[100px]">
                        <Badge 
                          variant="secondary"
                          className={`${getStatusColor(session.status)} capitalize whitespace-nowrap`}
                        >
                          {session.status || 'Unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell className="min-w-[140px]">
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (session.link) {
                                window.open(session.link, '_blank');
                              } else {
                                toast({
                                  title: "No Link",
                                  description: "No session link available",
                                  variant: "destructive"
                                });
                              }
                            }}
                            className="hover-scale hover:bg-blue-50 hover:border-blue-300"
                            disabled={!session.link}
                            title="Open session link"
                          >
                            <LinkIcon className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDialog(session)}
                            className="hover-scale hover:bg-green-50 hover:border-green-300"
                            title="Edit session"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(session.id)}
                            className="hover-scale hover:bg-red-50 hover:border-red-300"
                            title="Delete session"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}