import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar, Clock, Video, User, ExternalLink, Eye, EyeOff, Link as LinkIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
// import { logUserActivity, ACTIVITY_TYPES } from '@/lib/activity-logger';

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

export function MentorSuccessSessions() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SuccessSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [showCredentials, setShowCredentials] = useState<{ [key: string]: boolean }>({});
  const { toast } = useToast();

  useEffect(() => {
    if (user?.id) {
      fetchMentorSessions();
    }
  }, [user?.id]);

  const fetchMentorSessions = async () => {
    try {
      // For now, fetch all sessions since mentor_id field doesn't exist yet
      // This will need to be updated once the database schema is modified
      const { data, error } = await supabase
        .from('success_sessions')
        .select('*')
        .order('start_time', { ascending: true });

      if (error) throw error;
      setSessions((data || []) as SuccessSession[]);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch your success sessions",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
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

  const maskValue = (value: string, show: boolean) => {
    if (show || !value) return value;
    return `•••${value.slice(-4)}`;
  };

  const canStartSession = (session: SuccessSession) => {
    const now = new Date();
    const endTime = new Date(session.end_time);
    const cutoffTime = new Date(endTime.getTime() + 60 * 60 * 1000); // 60 minutes after end time
    
    return session.status === 'upcoming' && now <= cutoffTime;
  };

  const handleStartSession = async (session: SuccessSession) => {
    try {
      // Log session start in console for now
      console.log('Starting session:', session.title, 'for user:', user?.id);

      // Create form for POST to Zoom
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = 'https://zoom.us/signin';
      form.target = '_blank';

      // Add hidden fields for auto-login
      const emailField = document.createElement('input');
      emailField.type = 'hidden';
      emailField.name = 'email';
      emailField.value = session.host_login_email || '';
      form.appendChild(emailField);

      const passwordField = document.createElement('input');
      passwordField.type = 'hidden';
      passwordField.name = 'password';
      passwordField.value = session.host_login_pwd || '';
      form.appendChild(passwordField);

      const redirectField = document.createElement('input');
      redirectField.type = 'hidden';
      redirectField.name = 'redirect_uri';
      redirectField.value = `https://zoom.us/wc/join/${session.zoom_meeting_id}`;
      form.appendChild(redirectField);

      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);

      toast({
        title: "Starting Session",
        description: `Opening Zoom for session: ${session.title}`,
      });
    } catch (error) {
      console.error('Error starting session:', error);
      toast({
        title: "Error",
        description: "Failed to start session",
        variant: "destructive"
      });
    }
  };

  const toggleCredentials = (sessionId: string) => {
    setShowCredentials(prev => ({
      ...prev,
      [sessionId]: !prev[sessionId]
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your success sessions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="animate-fade-in">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-orange-600 bg-clip-text text-transparent">
          My Success Sessions
        </h2>
        <p className="text-muted-foreground mt-1 text-lg">Manage and host your success sessions</p>
      </div>

      <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50 animate-fade-in">
        <CardHeader className="bg-gradient-to-r from-orange-50 to-red-50 border-b">
          <CardTitle className="flex items-center text-xl">
            <Video className="w-6 h-6 mr-3 text-orange-600" />
            Your Sessions ({sessions.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {sessions.length === 0 ? (
            <div className="text-center py-16 animate-fade-in">
              <Video className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-muted-foreground mb-2">No sessions assigned</h3>
              <p className="text-muted-foreground">Contact your admin to get sessions assigned to you</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold min-w-[200px]">Session Title</TableHead>
                    <TableHead className="font-semibold min-w-[120px]">Date</TableHead>
                    <TableHead className="font-semibold min-w-[140px]">Time</TableHead>
                    <TableHead className="font-semibold min-w-[120px]">Meeting ID</TableHead>
                    <TableHead className="font-semibold min-w-[100px]">Passcode</TableHead>
                    <TableHead className="font-semibold min-w-[100px]">Status</TableHead>
                    <TableHead className="font-semibold min-w-[160px]">Actions</TableHead>
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
                      <TableCell className="min-w-[120px]">
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-2 text-gray-500 flex-shrink-0" />
                          <span className="whitespace-nowrap">{formatDate(session.schedule_date)}</span>
                        </div>
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
                      <TableCell className="min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">
                            {maskValue(session.zoom_meeting_id || '', showCredentials[session.id])}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleCredentials(session.id)}
                            className="h-6 w-6 p-0"
                          >
                            {showCredentials[session.id] ? (
                              <EyeOff className="h-3 w-3" />
                            ) : (
                              <Eye className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[100px]">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">
                            {maskValue(session.zoom_passcode || '', showCredentials[session.id])}
                          </span>
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
                      <TableCell className="min-w-[160px]">
                        <div className="flex space-x-2">
                          {canStartSession(session) ? (
                            <Button
                              size="sm"
                              onClick={() => handleStartSession(session)}
                              className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white"
                              title="Start session in Zoom"
                            >
                              <Video className="w-4 h-4 mr-1" />
                              Start Session
                            </Button>
                          ) : session.status === 'completed' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (session.link) {
                                  window.open(session.link, '_blank');
                                } else {
                                  toast({
                                    title: "No Recording",
                                    description: "No recording link available",
                                    variant: "destructive"
                                  });
                                }
                              }}
                              className="hover-scale hover:bg-blue-50 hover:border-blue-300"
                              disabled={!session.link}
                              title="View recording"
                            >
                              <Video className="w-4 h-4 mr-1" />
                              View Recording
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled
                              title="Session not ready to start"
                            >
                              <Video className="w-4 h-4 mr-1" />
                              Not Available
                            </Button>
                          )}
                          
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="hover-scale hover:bg-gray-50"
                                title="View session details"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Session Details: {session.title}</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-sm font-medium mb-1">Zoom Meeting ID</label>
                                    <p className="font-mono text-sm p-2 bg-gray-50 rounded">
                                      {session.zoom_meeting_id || 'Not provided'}
                                    </p>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium mb-1">Zoom Passcode</label>
                                    <p className="font-mono text-sm p-2 bg-gray-50 rounded">
                                      {session.zoom_passcode || 'Not provided'}
                                    </p>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-sm font-medium mb-1">Host Login Email</label>
                                    <p className="text-sm p-2 bg-gray-50 rounded">
                                      {session.host_login_email || 'Not provided'}
                                    </p>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium mb-1">Host Login Password</label>
                                    <p className="font-mono text-sm p-2 bg-gray-50 rounded">
                                      {session.host_login_pwd ? '••••••••' : 'Not provided'}
                                    </p>
                                  </div>
                                </div>
                                {canStartSession(session) && (
                                  <div className="pt-4 border-t">
                                    <Button
                                      onClick={() => handleStartSession(session)}
                                      className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white"
                                    >
                                      <Video className="w-4 h-4 mr-2" />
                                      Start Session in Zoom
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>
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