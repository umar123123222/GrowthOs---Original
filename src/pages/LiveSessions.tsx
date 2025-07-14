import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Video, 
  Calendar, 
  Clock, 
  Users, 
  ExternalLink,
  Play,
  CheckCircle
} from "lucide-react";

interface LiveSession {
  id: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  link: string;
  status: string;
  mentor_name: string;
  schedule_date: string;
  created_at: string;
  created_by: string;
}

interface SessionAttendance {
  id: string;
  live_session_id: string;
  joined_at: string;
  left_at: string;
}

interface LiveSessionsProps {
  user?: any;
}

const LiveSessions = ({ user }: LiveSessionsProps = {}) => {
  const [upcomingSessions, setUpcomingSessions] = useState<LiveSession[]>([]);
  const [attendedSessions, setAttendedSessions] = useState<LiveSession[]>([]);
  const [attendance, setAttendance] = useState<SessionAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    console.log('LiveSessions useEffect triggered, user:', user);
    if (user?.id) {
      fetchAttendance();
    } else {
      fetchSessions();
      setLoading(false);
    }
  }, [user?.id]);

  const fetchSessions = async () => {
    console.log('fetchSessions called');
    try {
      const { data, error } = await supabase
        .from('success_sessions')
        .select('*')
        .order('start_time', { ascending: true });

      console.log('All sessions found:', data);
      console.log('Query error:', error);
      
      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      // Split sessions into upcoming and past
      const now = new Date();
      const upcoming = (data || []).filter(session => {
        const sessionStart = new Date(session.start_time);
        return sessionStart >= now;
      });

      const pastSessions = (data || []).filter(session => {
        const sessionEnd = new Date(session.end_time);
        return sessionEnd < now;
      });
      
      console.log('Upcoming sessions after filtering:', upcoming);
      console.log('Past sessions after filtering:', pastSessions);
      setUpcomingSessions(upcoming);
      
      // Filter past sessions to only show attended ones
      if (user?.id && attendance.length > 0) {
        const attendedPastSessions = pastSessions.filter(session =>
          attendance.some(a => a.live_session_id === session.id)
        );
        setAttendedSessions(attendedPastSessions);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
      toast({
        title: "Error",
        description: "Failed to load success sessions",
        variant: "destructive",
      });
    }
  };

  const fetchAttendance = async () => {
    console.log('fetchAttendance called, user:', user);
    try {
      if (!user?.id) {
        console.log('No user ID in fetchAttendance, returning');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('session_attendance')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      setAttendance(data || []);
      
      // Re-fetch sessions after attendance data is loaded to filter attended past sessions
      if (data && data.length > 0) {
        await fetchSessions();
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const joinSession = async (sessionId: string, sessionLink: string) => {
    try {
      if (!user?.id) throw new Error('No authenticated user');

      // Record attendance
      const { error } = await supabase
        .from('session_attendance')
        .insert({
          user_id: user.id,
          live_session_id: sessionId,
          joined_at: new Date().toISOString()
        });

      if (error) throw error;

      // Open session link
      window.open(sessionLink, '_blank');
      
      await fetchAttendance();
      
      toast({
        title: "Joined Session",
        description: "Attendance recorded successfully",
      });
    } catch (error) {
      console.error('Error joining session:', error);
      toast({
        title: "Error",
        description: "Failed to join session",
        variant: "destructive",
      });
    }
  };

  const getSessionStatus = (session: LiveSession) => {
    const now = new Date();
    const startTime = new Date(session.start_time);
    const endTime = new Date(session.end_time);
    
    if (now < startTime) return { status: 'upcoming', color: 'bg-blue-100 text-blue-800' };
    if (now >= startTime && now <= endTime) return { status: 'live', color: 'bg-red-100 text-red-800' };
    return { status: 'completed', color: 'bg-gray-100 text-gray-800' };
  };

  const hasAttended = (sessionId: string) => {
    return attendance.some(a => a.live_session_id === sessionId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const SessionCard = ({ session, isUpcoming = false }: { session: LiveSession; isUpcoming?: boolean }) => {
    const sessionStatus = getSessionStatus(session);
    const attended = hasAttended(session.id);
    
    return (
      <Card className="group hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border-l-4 border-l-primary/20 hover:border-l-primary/60">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <CardTitle className="text-xl group-hover:text-primary transition-colors">
                {session.title}
              </CardTitle>
              <p className="text-muted-foreground leading-relaxed">{session.description}</p>
            </div>
            <Badge variant={
              sessionStatus.status === 'live' ? 'destructive' : 
              sessionStatus.status === 'upcoming' ? 'default' : 
              'secondary'
            } className="shrink-0">
              {sessionStatus.status}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <Calendar className="w-5 h-5 text-primary" />
              <div>
                <div className="font-medium text-sm">Date</div>
                <div className="text-sm text-muted-foreground">
                  {new Date(session.start_time).toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric',
                    year: 'numeric' 
                  })}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <Clock className="w-5 h-5 text-primary" />
              <div>
                <div className="font-medium text-sm">Time</div>
                <div className="text-sm text-muted-foreground">
                  {new Date(session.start_time).toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit', 
                    hour12: true 
                  })} - {new Date(session.end_time).toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit', 
                    hour12: true 
                  })}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <Users className="w-5 h-5 text-primary" />
              <div>
                <div className="font-medium text-sm">Mentor</div>
                <div className="text-sm text-muted-foreground">{session.mentor_name || "TBA"}</div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2">
              {attended && (
                <div className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm">
                  <CheckCircle className="w-4 h-4" />
                  <span>Attended</span>
                </div>
              )}
            </div>
            
            <Button
              onClick={() => joinSession(session.id, session.link)}
              disabled={sessionStatus.status === 'completed' && !attended}
              variant={sessionStatus.status === 'live' ? 'destructive' : 'default'}
              className={sessionStatus.status === 'live' ? "animate-pulse" : ""}
            >
              {sessionStatus.status === 'live' ? (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Join Live
                </>
              ) : sessionStatus.status === 'upcoming' ? (
                <>
                  <Calendar className="w-4 h-4 mr-2" />
                  Join Session
                </>
              ) : (
                <>
                  <Video className="w-4 h-4 mr-2" />
                  Watch Recording
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Success Sessions</h1>
        <p className="text-muted-foreground text-lg">
          Connect with mentors and fellow students in our success sessions
        </p>
      </div>

      {/* Upcoming Sessions */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 bg-primary rounded-full"></div>
          <h2 className="text-xl font-semibold">Upcoming Sessions</h2>
        </div>
        
        {upcomingSessions.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="text-center py-12">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-medium mb-2">No Upcoming Sessions</h3>
              <p className="text-muted-foreground">
                Check back soon for newly scheduled success sessions
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

      {/* Attended Past Sessions */}
      {attendedSessions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-1 h-6 bg-secondary rounded-full"></div>
            <h2 className="text-xl font-semibold">Your Session Recordings</h2>
            <Badge variant="secondary" className="ml-auto">
              {attendedSessions.length} session{attendedSessions.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          
          <div className="grid gap-6">
            {attendedSessions.map((session) => (
              <SessionCard key={session.id} session={session} isUpcoming={false} />
            ))}
          </div>
        </div>
      )}
      
      {attendedSessions.length === 0 && upcomingSessions.length > 0 && (
        <Card className="border-dashed bg-muted/20">
          <CardContent className="text-center py-8">
            <Video className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
            <h3 className="font-medium mb-1">Session Recordings</h3>
            <p className="text-sm text-muted-foreground">
              Your attended session recordings will appear here
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LiveSessions;