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
  "Mentor Name": string;
  "Schedule Date": string;
  created_at: string;
  created_by: string;
}

interface SessionAttendance {
  id: string;
  live_session_id: string;
  joined_at: string;
  left_at: string;
}

const LiveSessions = () => {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [attendance, setAttendance] = useState<SessionAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchSessions();
    fetchAttendance();
  }, []);

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('Segmented_Weekly_Success_sessions')
        .select('*')
        .order('start_time', { ascending: true });

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      toast({
        title: "Error",
        description: "Failed to load live success sessions",
        variant: "destructive",
      });
    }
  };

  const fetchAttendance = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('session_attendance')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      setAttendance(data || []);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const joinSession = async (sessionId: string, sessionLink: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

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
      
      fetchAttendance();
      
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Live Success Sessions</h1>
        <p className="text-muted-foreground">
          Join live success sessions with mentors and fellow students
        </p>
      </div>

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Video className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium mb-2">No Live Success Sessions Scheduled</h3>
            <p className="text-gray-600">Check back soon for upcoming success sessions</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {sessions.map((session) => {
            const sessionStatus = getSessionStatus(session);
            const attended = hasAttended(session.id);
            
            return (
              <Card key={session.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl">{session.title}</CardTitle>
                      <p className="text-gray-600 mt-1">{session.description}</p>
                    </div>
                    <Badge className={sessionStatus.color}>
                      {sessionStatus.status}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <div>
                        <div className="font-medium">Date</div>
                        <div>{session["Schedule Date"] || new Date(session.start_time).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <div>
                        <div className="font-medium">Time</div>
                        <div>{`${new Date(session.start_time).toLocaleTimeString()} - ${new Date(session.end_time).toLocaleTimeString()}`}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-gray-500" />
                      <div>
                        <div className="font-medium">Mentor</div>
                        <div>{session["Mentor Name"] || "TBA"}</div>
                      </div>
                    </div>
                  </div>

                  {/* Additional session details */}
                  <div className="pt-2 border-t border-gray-100">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-700">Session ID:</span>
                        <span className="ml-2 text-gray-600">{session.id.slice(0, 8)}...</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Status:</span>
                        <span className="ml-2 text-gray-600">{session.status || 'upcoming'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {attended && (
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="w-4 h-4" />
                          <span className="text-sm">Attended</span>
                        </div>
                      )}
                    </div>
                    
                    <Button
                      onClick={() => joinSession(session.id, session.link)}
                      disabled={sessionStatus.status === 'completed'}
                      className={
                        sessionStatus.status === 'live'
                          ? "bg-red-600 hover:bg-red-700 animate-pulse"
                          : ""
                      }
                    >
                      {sessionStatus.status === 'live' ? (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Join Live
                        </>
                      ) : sessionStatus.status === 'upcoming' ? (
                        <>
                          <Calendar className="w-4 h-4 mr-2" />
                          Schedule Reminder
                        </>
                      ) : (
                        <>
                          <ExternalLink className="w-4 h-4 mr-2" />
                          View Recording
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LiveSessions;