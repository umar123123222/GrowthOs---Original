import { useState, useEffect } from 'react';
import { safeLogger } from '@/lib/safe-logger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar, Clock, Video, Users, Eye, EyeOff, Play, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

interface MentorSession {
  id: string;
  title: string;
  description: string;
  mentor_name: string;
  schedule_date: string;
  start_time: string;
  end_time: string;
  link: string;
  status: string;
  zoom_meeting_id?: string;
  zoom_passcode?: string;
  host_login_email?: string;
  host_login_pwd?: string;
  isAssignedToMe?: boolean;
}

export function MentorSessions() {
  const { user } = useAuth();
  const [upcomingSessions, setUpcomingSessions] = useState<MentorSession[]>([]);
  const [completedSessions, setCompletedSessions] = useState<MentorSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCredentials, setShowCredentials] = useState<{ [key: string]: boolean }>({});
  const { toast } = useToast();

  useEffect(() => {
    if (user?.id) {
      fetchMentorSessions();
    }
  }, [user?.id]);

  const fetchMentorSessions = async () => {
    if (!user?.id) return;

    try {
      // Mentors now only see their assigned sessions due to RLS policy
      const { data, error } = await supabase
        .from('success_sessions')
        .select('*')
        .order('start_time', { ascending: true });

      if (error) throw error;

      const sessions: MentorSession[] = (data || []).map(session => ({
        id: session.id,
        title: session.title,
        description: session.description || '',
        mentor_name: session.mentor_name || 'Unassigned',
        schedule_date: session.schedule_date || '',
        start_time: session.start_time,
        end_time: session.end_time || '',
        link: session.link,
        status: session.status || 'upcoming',
        zoom_meeting_id: session.zoom_meeting_id || '',
        zoom_passcode: session.zoom_passcode || '',
        host_login_email: session.host_login_email || '',
        host_login_pwd: session.host_login_pwd || '',
        // All sessions returned are assigned to this mentor (RLS ensures this)
        isAssignedToMe: true
      }));
      
      processSessions(sessions);
    } catch (error: any) {
      toast({
        title: "Error", 
        description: "Failed to fetch your sessions",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const processSessions = (sessions: MentorSession[]) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Start of today
    
    const upcoming = sessions.filter(session => {
      const sessionStart = new Date(session.start_time);
      sessionStart.setHours(0, 0, 0, 0); // Start of session day
      // Only show if session is today or in the future
      return sessionStart >= now;
    });
    
    const completed = sessions.filter(session => {
      const sessionStart = new Date(session.start_time);
      sessionStart.setHours(0, 0, 0, 0);
      // Show as completed if session was before today
      return sessionStart < now;
    });

    setUpcomingSessions(upcoming);
    setCompletedSessions(completed);
  };

  const canStartSession = (session: MentorSession) => {
    const now = new Date();
    const sessionStart = new Date(session.start_time);
    
    // If no end time, allow starting 15 minutes before start time
    if (!session.end_time) {
      return session.isAssignedToMe && session.status === 'upcoming' && now >= new Date(sessionStart.getTime() - 15 * 60 * 1000);
    }
    
    const sessionEnd = new Date(session.end_time);
    const cutoffTime = new Date(sessionEnd.getTime() + 60 * 60 * 1000); // 60 minutes after end
    
    // Can start if session is upcoming, assigned to me, and within the time window
    return session.isAssignedToMe && session.status === 'upcoming' && now >= new Date(sessionStart.getTime() - 15 * 60 * 1000) && now <= cutoffTime;
  };

  const handleStartSession = async (session: MentorSession) => {
    try {
      if (!session.host_login_email || !session.host_login_pwd) {
        toast({
          title: "Missing Credentials",
          description: "Host login credentials not configured for this session",
          variant: "destructive"
        });
        return;
      }

      // Create a form to POST to Zoom with auto-login
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = 'https://zoom.us/signin';
      form.target = '_blank';

      // Add email field
      const emailField = document.createElement('input');
      emailField.type = 'hidden';
      emailField.name = 'email';
      emailField.value = session.host_login_email;
      form.appendChild(emailField);

      // Add password field  
      const passwordField = document.createElement('input');
      passwordField.type = 'hidden';
      passwordField.name = 'password';
      passwordField.value = session.host_login_pwd;
      form.appendChild(passwordField);

      // Add redirect URL to join meeting
      if (session.zoom_meeting_id) {
        const redirectField = document.createElement('input');
        redirectField.type = 'hidden';
        redirectField.name = 'redirect_uri';
        redirectField.value = `https://zoom.us/wc/join/${session.zoom_meeting_id}`;
        form.appendChild(redirectField);
      }

      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);

      toast({
        title: "Starting Session",
        description: `Opening Zoom for: ${session.title}`,
      });

      // Log the session start
      safeLogger.activity('Session started', { 
        sessionTitle: session.title, 
        mentorId: user?.id 
      });
    } catch (error) {
      safeLogger.error('Error starting session', error);
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

  const formatDateTime = (dateTimeString: string) => {
    try {
      return format(new Date(dateTimeString), 'MMM dd, yyyy • h:mm a');
    } catch {
      return 'Invalid date';
    }
  };

  const maskValue = (value: string, show: boolean) => {
    if (show || !value) return value;
    return `•••${value.slice(-4)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your sessions...</p>
        </div>
      </div>
    );
  }

  const SessionCard = ({ session, isUpcoming = true }: { session: MentorSession; isUpcoming?: boolean }) => {
    const canStart = canStartSession(session);
    const showCreds = showCredentials[session.id];

    return (
      <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-primary/60">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <CardTitle className="text-xl text-primary">{session.title}</CardTitle>
              {session.description && (
                <p className="text-muted-foreground">{session.description}</p>
              )}
              {session.mentor_name && (
                <p className="text-sm text-muted-foreground">
                  Mentor: <span className="font-medium">{session.mentor_name}</span>
                  {session.isAssignedToMe && <Badge variant="outline" className="ml-2 bg-primary/10">Assigned to you</Badge>}
                </p>
              )}
            </div>
            <Badge variant={isUpcoming ? "default" : "secondary"} className="shrink-0">
              {session.status}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Session Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <Calendar className="w-5 h-5 text-primary" />
              <div>
                <div className="font-medium text-sm">Date & Time</div>
                <div className="text-sm text-muted-foreground">
                  {formatDateTime(session.start_time)}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <Clock className="w-5 h-5 text-primary" />
              <div>
                <div className="font-medium text-sm">Duration</div>
                <div className="text-sm text-muted-foreground">
                  {format(new Date(session.start_time), 'h:mm a')}
                  {session.end_time && ` - ${format(new Date(session.end_time), 'h:mm a')}`}
                </div>
              </div>
            </div>
          </div>

          {/* Zoom Details */}
          {isUpcoming && (session.zoom_meeting_id || session.zoom_passcode) && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-blue-900">Zoom Meeting Details</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleCredentials(session.id)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  {showCreds ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {showCreds ? 'Hide' : 'Show'}
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="font-medium text-blue-700">Meeting ID: </span>
                  <span className="font-mono">{maskValue(session.zoom_meeting_id || '', showCreds)}</span>
                </div>
                <div>
                  <span className="font-medium text-blue-700">Passcode: </span>
                  <span className="font-mono">{maskValue(session.zoom_passcode || '', showCreds)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2">
              {isUpcoming ? (
                session.isAssignedToMe ? (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <Users className="w-3 h-3 mr-1" />
                    Ready to Host
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-gray-50 text-gray-700">
                    <Users className="w-3 h-3 mr-1" />
                    Not Assigned to You
                  </Badge>
                )
              ) : (
                <Badge variant="outline" className="bg-gray-50 text-gray-700">
                  Completed
                </Badge>
              )}
            </div>
            
            <div className="flex gap-2">
              {isUpcoming && canStart ? (
                <Button
                  onClick={() => handleStartSession(session)}
                  className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start Session
                </Button>
              ) : isUpcoming && !session.isAssignedToMe ? (
                <Button variant="outline" disabled>
                  <Users className="w-4 h-4 mr-2" />
                  Not Your Session
                </Button>
              ) : isUpcoming ? (
                <Button variant="outline" disabled>
                  <Clock className="w-4 h-4 mr-2" />
                  Not Yet Time
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => {
                    if (session.link) {
                      window.open(session.link, '_blank');
                    }
                  }}
                  disabled={!session.link}
                >
                  <Video className="w-4 h-4 mr-2" />
                  View Recording
                </Button>
              )}
              
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Eye className="w-4 h-4 mr-1" />
                    Details
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>{session.title}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Meeting ID</label>
                        <p className="font-mono text-sm p-2 bg-gray-50 rounded">
                          {session.zoom_meeting_id || 'Not provided'}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Passcode</label>
                        <p className="font-mono text-sm p-2 bg-gray-50 rounded">
                          {session.zoom_passcode || 'Not provided'}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Host Email</label>
                        <p className="text-sm p-2 bg-gray-50 rounded">
                          {session.host_login_email || 'Not provided'}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Host Password</label>
                        <p className="font-mono text-sm p-2 bg-gray-50 rounded">
                          {session.host_login_pwd ? '••••••••' : 'Not provided'}
                        </p>
                      </div>
                    </div>
                    {isUpcoming && canStart && (
                      <div className="pt-4 border-t">
                        <Button
                          onClick={() => handleStartSession(session)}
                          className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white"
                        >
                          <Play className="w-4 h-4 mr-2" />
                          Start Session in Zoom
                        </Button>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-primary">🎯 My Success Sessions</h1>
        <p className="text-muted-foreground mt-2">Host and manage your assigned success sessions</p>
      </div>

      {/* Upcoming Sessions */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 bg-primary rounded-full"></div>
          <h2 className="text-xl font-semibold">Upcoming Sessions</h2>
          <Badge variant="secondary" className="ml-2">
            {upcomingSessions.length}
          </Badge>
        </div>
        
        {upcomingSessions.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="text-center py-12">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-medium mb-2">No Upcoming Sessions</h3>
              <p className="text-muted-foreground">
                You don't have any sessions assigned yet. Contact your admin for session assignments.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {upcomingSessions.map((session) => (
              <SessionCard key={session.id} session={session} isUpcoming={true} />
            ))}
          </div>
        )}
      </div>

      {/* Completed Sessions */}
      {completedSessions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-1 h-6 bg-secondary rounded-full"></div>
            <h2 className="text-xl font-semibold">Completed Sessions</h2>
            <Badge variant="secondary" className="ml-2">
              {completedSessions.length}
            </Badge>
          </div>
          
          <div className="grid gap-6">
            {completedSessions.map((session) => (
              <SessionCard key={session.id} session={session} isUpcoming={false} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}