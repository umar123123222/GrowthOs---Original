import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { RoleGuard } from "@/components/RoleGuard";
import { safeLogger } from '@/lib/safe-logger';
import { VideoPreviewDialog } from '@/components/VideoPreviewDialog';
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
  course_id?: string;
  batch_id?: string | null;
}

interface SessionAttendance {
  id: string;
  user_id: string;
  session_id: string;
  attended_at: string;
  created_at: string;
}

interface LiveSessionsProps {
  user?: any;
}

const LiveSessions = ({ user }: LiveSessionsProps = {}) => {
  const [upcomingSessions, setUpcomingSessions] = useState<LiveSession[]>([]);
  const [recordedSessions, setRecordedSessions] = useState<LiveSession[]>([]);
  const [attendance, setAttendance] = useState<SessionAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLMSStatus, setUserLMSStatus] = useState('active');
  const [videoPreview, setVideoPreview] = useState<{ title: string; url: string } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    safeLogger.info('LiveSessions useEffect triggered, user:', { user });
    if (user?.id) {
      fetchAttendance();
    } else {
      // No user – show nothing (RLS will enforce visibility anyway)
      setLoading(false);
    }
  }, [user?.id]);

  // Authenticated user session fetching – relies on RLS policy for filtering
  const fetchSessions = async (enrolledAt?: string) => {
    safeLogger.info('fetchSessions called');
    try {
      const { data, error } = await supabase
        .from('success_sessions')
        .select('*')
        .order('start_time', { ascending: true });

      safeLogger.info('Sessions fetched:', { count: data?.length });
      
      if (error) {
        safeLogger.error('Supabase error:', error);
        throw error;
      }
      
      const now = new Date();
      const enrolledDate = enrolledAt ? new Date(enrolledAt) : undefined;

      const upcoming = (data || []).filter(session => {
        const sessionStart = new Date(session.start_time);
        return sessionStart >= now;
      });

      // Past sessions – optionally filtered to after enrollment date
      const pastSessions = (data || []).filter(session => {
        const sessionEnd = new Date(session.end_time);
        const sessionStart = new Date(session.start_time);
        if (sessionEnd >= now) return false;
        if (enrolledDate && sessionStart < enrolledDate) return false;
        return true;
      });
      
      setUpcomingSessions(upcoming);
      setRecordedSessions(pastSessions);
    } catch (error) {
      safeLogger.error('Error fetching sessions:', error);
      toast({
        title: "Error",
        description: "Failed to load success sessions",
        variant: "destructive",
      });
    }
  };

  const fetchAttendance = async () => {
    safeLogger.info('fetchAttendance called, user:', { user });
    try {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      // Fetch user's LMS status
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('lms_status')
        .eq('id', user.id)
        .maybeSingle();
      
      if (userError) throw userError;
      setUserLMSStatus(userData?.lms_status || 'active');

      // Fetch earliest enrolled_at from active enrollments (for filtering past sessions)
      const { data: studentData } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      let earliestEnrolledAt: string | undefined;
      if (studentData?.id) {
        const { data: enrollments } = await supabase
          .from('course_enrollments')
          .select('enrolled_at')
          .eq('student_id', studentData.id)
          .eq('status', 'active')
          .order('enrolled_at', { ascending: true })
          .limit(1);
        earliestEnrolledAt = enrollments?.[0]?.enrolled_at;
      }

      // Fetch user's attendance records
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('session_attendance')
        .select('*')
        .eq('user_id', user.id);
      
      if (attendanceError) {
        safeLogger.error('Error fetching attendance:', attendanceError);
        setAttendance([]);
      } else {
        setAttendance(attendanceData || []);
      }
      
      // Now fetch sessions – RLS will automatically filter to the student's enrolled courses/batches
      await fetchSessions(earliestEnrolledAt);
    } catch (error) {
      safeLogger.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  // joinSession and helpers unchanged below

  const joinSession = async (sessionId: string, sessionLink: string) => {
    try {
      if (!user?.id) throw new Error('No authenticated user');

      // Record attendance in session_attendance table
      const { error } = await supabase
        .from('session_attendance')
        .insert({
          user_id: user.id,
          session_id: sessionId
        });

      if (error && error.code !== '23505') { // Ignore duplicate key errors
        throw error;
      }

      // Open session link
      window.open(sessionLink, '_blank');
      
      await fetchAttendance();
      
      toast({
        title: "Joined Session",
        description: "Attendance recorded successfully",
      });
    } catch (error) {
      safeLogger.error('Error joining session:', error);
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
    return attendance.some(a => a.session_id === sessionId);
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
            
            {sessionStatus.status === 'completed' && session.link ? (
              <Button
                onClick={() => setVideoPreview({ title: session.title, url: session.link })}
                disabled={userLMSStatus !== 'active'}
                variant="default"
              >
                {userLMSStatus !== 'active' ? (
                  'Locked - Payment Required'
                ) : (
                  <>
                    <Video className="w-4 h-4 mr-2" />
                    Watch Now
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={() => joinSession(session.id, session.link)}
                disabled={userLMSStatus !== 'active'}
                variant="default"
              >
                {userLMSStatus !== 'active' ? (
                  'Locked - Payment Required'
                ) : (
                  <>
                    <Calendar className="w-4 h-4 mr-2" />
                    Join Now
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <RoleGuard allowedRoles={['student', 'admin', 'mentor', 'superadmin']}>
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
          {upcomingSessions.length > 0 && (
            <Badge variant="default" className="ml-auto">
              {upcomingSessions.length} session{upcomingSessions.length !== 1 ? 's' : ''} scheduled
            </Badge>
          )}
        </div>
        {upcomingSessions.length > 0 ? (
          <div className="grid gap-6">
            {upcomingSessions.map((session) => (
              <SessionCard key={session.id} session={session} isUpcoming={true} />
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="text-center py-12">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-medium mb-2">No Upcoming Sessions</h3>
              <p className="text-muted-foreground">
                Check back soon for newly scheduled success sessions
              </p>
            </CardContent>
          </Card>
        )}
      </div>
      {/* Recorded Sessions - Show all sessions after user joined */}
      {recordedSessions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-1 h-6 bg-secondary rounded-full"></div>
            <h2 className="text-xl font-semibold">Recorded Sessions</h2>
            <Badge variant="secondary" className="ml-auto">
              {recordedSessions.length} recording{recordedSessions.length !== 1 ? 's' : ''} available
            </Badge>
          </div>
          
          <div className="grid gap-6">
            {recordedSessions.map((session) => (
              <SessionCard key={session.id} session={session} isUpcoming={false} />
            ))}
          </div>
        </div>
      )}
      </div>

      <VideoPreviewDialog
        open={!!videoPreview}
        onOpenChange={(open) => { if (!open) setVideoPreview(null); }}
        recordingTitle={videoPreview?.title || ''}
        recordingUrl={videoPreview?.url || ''}
      />
    </RoleGuard>
  );
};

export default LiveSessions;