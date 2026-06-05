import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { RoleGuard } from "@/components/RoleGuard";
import { safeLogger } from '@/lib/safe-logger';
import { VideoPreviewDialog } from '@/components/VideoPreviewDialog';
import { InactiveLMSBanner } from '@/components/InactiveLMSBanner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { logToAdminLogs } from '@/lib/activity-logger';

import { 
  Video, 
  Calendar, 
  Clock, 
  Users, 
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
  batch_ids?: string[] | null;
}

interface SessionAttendance {
  id: string;
  user_id: string;
  session_id: string;
  attended_at: string;
  created_at: string;
}

interface SessionCardProps {
  session: LiveSession;
  isUpcoming?: boolean;
  userLMSStatus: string;
  hasAttended: boolean;
  onJoin: (sessionId: string, sessionLink: string) => void;
  onWatchRecording: (title: string, url: string) => void;
}

const getSessionStatus = (session: LiveSession) => {
  const now = new Date();
  const startTime = new Date(session.start_time);
  const endTime = new Date(session.end_time);
  
  if (now < startTime) return { status: 'upcoming', color: 'bg-blue-100 text-blue-800' };
  if (now >= startTime && now <= endTime) return { status: 'live', color: 'bg-red-100 text-red-800' };
  return { status: 'completed', color: 'bg-gray-100 text-gray-800' };
};

const SessionCard = ({ session, isUpcoming, userLMSStatus, hasAttended, onJoin, onWatchRecording }: SessionCardProps) => {
  const sessionStatus = getSessionStatus(session);
  const hasLink = !!session.link;
  
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
                  weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' 
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
                  hour: '2-digit', minute: '2-digit', hour12: true 
                })}{session.end_time ? ` - ${new Date(session.end_time).toLocaleTimeString('en-US', { 
                  hour: '2-digit', minute: '2-digit', hour12: true 
                })}` : ''}
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
            {hasAttended && (
              <div className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm">
                <CheckCircle className="w-4 h-4" />
                <span>Attended</span>
              </div>
            )}
          </div>
          
          {sessionStatus.status === 'completed' && hasLink ? (
            <Button
              onClick={() => onWatchRecording(session.title, session.link)}
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
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      onClick={() => onJoin(session.id, session.link)}
                      disabled={userLMSStatus !== 'active' || !hasLink}
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
                  </span>
                </TooltipTrigger>
                {!hasLink && userLMSStatus === 'active' && (
                  <TooltipContent>Link not available yet</TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

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
      setLoading(false);
    }
  }, [user?.id]);

  const normalizeBatchIds = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
  };

  const fetchSessions = async (studentBatchId?: string) => {
    safeLogger.info('fetchSessions called');
    try {
      const sessionSelect = `
        id,
        title,
        description,
        start_time,
        end_time,
        link,
        status,
        mentor_name,
        schedule_date,
        created_at,
        created_by,
        course_id,
        batch_id,
        batch_ids
      `;

      let sessionsQuery = supabase
        .from('success_sessions')
        .select(sessionSelect)
        .in('status', ['upcoming', 'live', 'completed'])
        .order('start_time', { ascending: true });

      if (user?.role === 'student') {
        const visibilityClauses = studentBatchId
          ? [
              `batch_id.eq.${studentBatchId}`,
              `batch_ids.cs.${JSON.stringify([studentBatchId])}`,
              'and(batch_id.is.null,batch_ids.is.null)',
              'batch_ids.eq.[]',
            ]
          : [
              'and(batch_id.is.null,batch_ids.is.null)',
              'batch_ids.eq.[]',
            ];

        sessionsQuery = sessionsQuery.or(visibilityClauses.join(','));
      }

      const { data, error } = await sessionsQuery;

      safeLogger.info('Sessions fetched:', { count: data?.length });
      if (error) {
        safeLogger.error('Supabase error:', error);
        throw error;
      }

      const now = new Date();

      // Strict batch targeting: a session (upcoming OR recorded) is visible only if
      //  - it has no batch targeting (global session), OR
      //  - the student's active batch is explicitly included in batch_ids.
      // Students without an active batch only see global sessions.
      const isVisibleToStudent = (session: LiveSession) => {
        const batchIds = normalizeBatchIds(session.batch_ids);
        const isGlobalSession = (session.batch_id == null && session.batch_ids == null) || batchIds.length === 0;

        if (isGlobalSession) return true;
        if (batchIds.length === 0) return true; // global session — visible to everyone
        if (!studentBatchId) return false; // targeted session, but student has no batch
        return session.batch_id === studentBatchId || batchIds.includes(studentBatchId);
      };

      const visible = (data || []).filter(session => user?.role === 'student' ? isVisibleToStudent(session as LiveSession) : true) as LiveSession[];

      // Upcoming & live: session hasn't ended yet (use end_time or fallback start+1hr)
      const upcoming = visible.filter(session => {
        const start = new Date(session.start_time);
        const end = session.end_time ? new Date(session.end_time) : new Date(start.getTime() + 60 * 60 * 1000);
        return end > now;
      });
      // Past recordings: session has ended. No enrollment-date cutoff —
      // recordings are evergreen learning content for all enrolled students.
      const pastSessions = visible.filter(session => {
        const start = new Date(session.start_time);
        const end = session.end_time ? new Date(session.end_time) : new Date(start.getTime() + 60 * 60 * 1000);
        const hasRecordingLink = typeof session.link === 'string' && session.link.trim().length > 0;
        return end < now && hasRecordingLink;
      });

      setUpcomingSessions(upcoming);
      setRecordedSessions(pastSessions);
    } catch (error) {
      safeLogger.error('Error fetching sessions:', error);
      toast({ title: "Error", description: "Failed to load success sessions", variant: "destructive" });
    }
  };

  const fetchAttendance = async () => {
    safeLogger.info('fetchAttendance called, user:', { user });
    try {
      if (!user?.id) { setLoading(false); return; }

      const { data: userData, error: userError } = await supabase
        .from('users').select('lms_status').eq('id', user.id).maybeSingle();
      if (userError) throw userError;
      setUserLMSStatus(userData?.lms_status || 'active');

      const { data: studentData } = await supabase
        .from('students').select('id').eq('user_id', user.id).maybeSingle();

      let studentBatchId: string | undefined;
      if (studentData?.id) {
        const { data: enrollments } = await supabase
          .from('course_enrollments').select('batch_id')
          .eq('student_id', studentData.id).eq('status', 'active')
          .not('batch_id', 'is', null)
          .order('enrolled_at', { ascending: true }).limit(1);

        studentBatchId = enrollments?.[0]?.batch_id || undefined;
      }

      const { data: attendanceData, error: attendanceError } = await supabase
        .from('session_attendance').select('*').eq('user_id', user.id);
      
      if (attendanceError) {
        safeLogger.error('Error fetching attendance:', attendanceError);
        setAttendance([]);
      } else {
        setAttendance(attendanceData || []);
      }
      
      await fetchSessions(studentBatchId);
    } catch (error) {
      safeLogger.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const joinSession = async (sessionId: string, sessionLink: string) => {
    try {
      if (!user?.id) throw new Error('No authenticated user');
      const { error } = await supabase
        .from('session_attendance').insert({ user_id: user.id, session_id: sessionId });
      if (error && error.code !== '23505') throw error;

      // Log to admin_logs so it shows in the activity log dialog
      const session = [...upcomingSessions, ...recordedSessions].find(s => s.id === sessionId);
      await logToAdminLogs({
        performed_by: user.id,
        target_user_id: user.id,
        entity_type: 'live_session',
        entity_id: sessionId,
        action: 'live_session_joined',
        description: `Joined live session: ${session?.title || 'Unknown'}`,
        data: {
          session_id: sessionId,
          session_title: session?.title || null,
          session_date: session?.start_time || session?.schedule_date || null,
          host_name: session?.mentor_name || null,
        }
      });

      window.open(sessionLink, '_blank');
      await fetchAttendance();
      toast({ title: "Joined Session", description: "Attendance recorded successfully" });
    } catch (error) {
      safeLogger.error('Error joining session:', error);
      toast({ title: "Error", description: "Failed to join session", variant: "destructive" });
    }
  };


  const hasAttended = (sessionId: string) => attendance.some(a => a.session_id === sessionId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <RoleGuard allowedRoles={['student', 'admin', 'mentor', 'superadmin']}>
      <div className="space-y-8 animate-fade-in">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Success Sessions</h1>
          <p className="text-muted-foreground text-lg">
            Connect with mentors and fellow students in our success sessions
          </p>
        </div>

        <InactiveLMSBanner show={userLMSStatus !== 'active'} />

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
                <SessionCard
                  key={session.id}
                  session={session}
                  isUpcoming={true}
                  userLMSStatus={userLMSStatus}
                  hasAttended={hasAttended(session.id)}
                  onJoin={joinSession}
                  onWatchRecording={(title, url) => setVideoPreview({ title, url })}
                />
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

        {/* Recorded Sessions */}
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
                <SessionCard
                  key={session.id}
                  session={session}
                  isUpcoming={false}
                  userLMSStatus={userLMSStatus}
                  hasAttended={hasAttended(session.id)}
                  onJoin={joinSession}
                  onWatchRecording={(title, url) => setVideoPreview({ title, url })}
                />
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
