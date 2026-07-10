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
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [recordedPage, setRecordedPage] = useState(1);
  const PAGE_SIZE = 10;
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

  const fetchSessions = async (studentBatchId?: string, studentCourseIds: string[] = []) => {
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
        // Server-side filter: include global sessions, batch-targeted sessions
        // for the student's batch, and any session flagged for unbatched targeting.
        // The client-side filter below then enforces the course match on unbatched.
        const visibilityClauses = studentBatchId
          ? [
              `batch_id.eq.${studentBatchId}`,
              `batch_ids.cs.${JSON.stringify([studentBatchId])}`,
              'and(batch_id.is.null,batch_ids.is.null)',
              'batch_ids.eq.[]',
              `batch_ids.cs.${JSON.stringify(['unbatched'])}`,
            ]
          : [
              'and(batch_id.is.null,batch_ids.is.null)',
              'batch_ids.eq.[]',
              `batch_ids.cs.${JSON.stringify(['unbatched'])}`,
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

      // Strict targeting: a session is visible only if
      //  - it is global (no targeting), OR
      //  - the student's batch is included in batch_ids, OR
      //  - it targets 'unbatched' AND the student has no batch AND is enrolled in the session's course.
      const isVisibleToStudent = (session: LiveSession) => {
        const batchIds = normalizeBatchIds(session.batch_ids);
        const isGlobalSession = (session.batch_id == null && session.batch_ids == null) || batchIds.length === 0;

        if (isGlobalSession) return true;

        const targetsUnbatched = batchIds.includes('unbatched');
        const realTargets = batchIds.filter(id => id !== 'unbatched');

        // Batched student: only match on their real batch id
        if (studentBatchId) {
          if (session.batch_id === studentBatchId) return true;
          return realTargets.includes(studentBatchId);
        }

        // Unbatched student: needs the 'unbatched' flag AND course enrollment
        if (!targetsUnbatched) return false;
        if (!session.course_id) return true; // unbatched targeting without a course — show to all unbatched
        return studentCourseIds.includes(session.course_id);
      };

      const visible = (data || []).filter(session => user?.role === 'student' ? isVisibleToStudent(session as LiveSession) : true) as LiveSession[];

      // Compute effective end: if end_time is missing or <= start (bad data
      // where an AM end was entered against a PM start, e.g. 8:30 PM–9:30 AM),
      // treat it as start + 1 hour so the session still shows as upcoming.
      const effectiveEnd = (session: LiveSession) => {
        const start = new Date(session.start_time);
        const rawEnd = session.end_time ? new Date(session.end_time) : null;
        if (!rawEnd || rawEnd.getTime() <= start.getTime()) {
          return new Date(start.getTime() + 60 * 60 * 1000);
        }
        return rawEnd;
      };

      // Upcoming & live: session hasn't ended yet
      const upcoming = visible.filter(session => effectiveEnd(session) > now);
      // Past recordings: session has ended. No enrollment-date cutoff —
      // recordings are evergreen learning content for all enrolled students.
      const pastSessions = visible.filter(session => {
        const hasRecordingLink = typeof session.link === 'string' && session.link.trim().length > 0;
        return effectiveEnd(session) < now && hasRecordingLink;
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
      let studentCourseIds: string[] = [];
      if (studentData?.id) {
        const { data: enrollments } = await supabase
          .from('course_enrollments').select('batch_id, course_id, enrolled_at, status')
          .eq('student_id', studentData.id).eq('status', 'active')
          .order('enrolled_at', { ascending: true });

        const rows = enrollments || [];
        studentBatchId = rows.find(r => r.batch_id)?.batch_id || undefined;
        studentCourseIds = Array.from(new Set(rows.map(r => r.course_id).filter(Boolean))) as string[];
      }

      const { data: attendanceData, error: attendanceError } = await supabase
        .from('session_attendance').select('*').eq('user_id', user.id);
      
      if (attendanceError) {
        safeLogger.error('Error fetching attendance:', attendanceError);
        setAttendance([]);
      } else {
        setAttendance(attendanceData || []);
      }
      
      await fetchSessions(studentBatchId, studentCourseIds);
    } catch (error) {
      safeLogger.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const joinSession = async (sessionId: string, sessionLink: string) => {
    try {
      if (!user?.id) throw new Error('No authenticated user');
      const session = [...upcomingSessions, ...recordedSessions].find(s => s.id === sessionId);

      // Only mark attendance if within the attendance window:
      // from 5 minutes before start_time onwards (through end of session).
      const now = new Date();
      const startTime = session?.start_time ? new Date(session.start_time) : null;
      const attendanceOpensAt = startTime ? new Date(startTime.getTime() - 5 * 60 * 1000) : null;
      const withinAttendanceWindow = !!attendanceOpensAt && now >= attendanceOpensAt;

      if (withinAttendanceWindow) {
        const { error } = await supabase
          .from('session_attendance').insert({ user_id: user.id, session_id: sessionId });
        if (error && error.code !== '23505') throw error;

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
      }

      window.open(sessionLink, '_blank');
      if (withinAttendanceWindow) {
        await fetchAttendance();
        toast({ title: "Joined Session", description: "Attendance recorded successfully" });
      } else {
        toast({
          title: "Joined Early",
          description: "Attendance will be recorded when you join within 5 minutes of the start time.",
        });
      }
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
            <>
              <div className="grid gap-6">
                {upcomingSessions
                  .slice((upcomingPage - 1) * PAGE_SIZE, upcomingPage * PAGE_SIZE)
                  .map((session) => (
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
              {upcomingSessions.length > PAGE_SIZE && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm text-muted-foreground">
                    Page {upcomingPage} of {Math.ceil(upcomingSessions.length / PAGE_SIZE)}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={upcomingPage === 1}
                      onClick={() => setUpcomingPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={upcomingPage >= Math.ceil(upcomingSessions.length / PAGE_SIZE)}
                      onClick={() => setUpcomingPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
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
              {recordedSessions
                .slice((recordedPage - 1) * PAGE_SIZE, recordedPage * PAGE_SIZE)
                .map((session) => (
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
            {recordedSessions.length > PAGE_SIZE && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-sm text-muted-foreground">
                  Page {recordedPage} of {Math.ceil(recordedSessions.length / PAGE_SIZE)}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={recordedPage === 1}
                    onClick={() => setRecordedPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={recordedPage >= Math.ceil(recordedSessions.length / PAGE_SIZE)}
                    onClick={() => setRecordedPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}

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
