import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarIcon, CalendarDays, Clock, Video, User, Link as LinkIcon, Plus, Edit, Trash2, BookOpen, Users2, Search, Send, Filter, Check } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { safeQuery } from '@/lib/database-safety';
import type { SuccessSessionResult } from '@/types/database';
import { format, isSameDay } from 'date-fns';
import { notifyMentorOfSuccessSessionScheduled } from '@/lib/notification-service';
import { logUserActivity, ACTIVITY_TYPES } from '@/lib/activity-logger';
import { useAuth } from '@/hooks/useAuth';
import { AlertTriangle } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

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
  course_id?: string;
  batch_id?: string | null;
  batch_ids?: string[] | null;
  pathway_id?: string | null;
  drip_days?: number | null;
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
  course_id: string;
  batch_ids: string[];
}

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface Course {
  id: string;
  title: string;
}

interface Batch {
  id: string;
  name: string;
  course_id: string | null;
  status: string;
  start_date?: string;
}

interface Pathway {
  id: string;
  name: string;
}

interface PathwayCourse {
  course_id: string;
  pathway_id: string;
}

export function SuccessSessionsManagement() {
  const [sessions, setSessions] = useState<SuccessSession[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [pathways, setPathways] = useState<Pathway[]>([]);
  const [pathwayCourses, setPathwayCourses] = useState<PathwayCourse[]>([]);
  const [filteredBatches, setFilteredBatches] = useState<Batch[]>([]);
  const [batchCourseMap, setBatchCourseMap] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [editingSession, setEditingSession] = useState<SuccessSession | null>(null);
  // Filter state
  const [filterSearch, setFilterSearch] = useState('');
  const [filterHost, setFilterHost] = useState('__all__');
  const [filterCourse, setFilterCourse] = useState('__all__');
  const [filterBatch, setFilterBatch] = useState('__all__');
  const [filterStatus, setFilterStatus] = useState('__all__');
  const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
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
    status: 'draft',
    course_id: '__all__',
    batch_ids: ['__all__']
  });
  const [batchPopoverOpen, setBatchPopoverOpen] = useState(false);
  const [publishing, setPublishing] = useState<string | null>(null);
  const formSubmittedRef = useRef(false);
  const { toast } = useToast();
  const { user: authUser } = useAuth();

  useEffect(() => {
    fetchSessions();
    fetchUsers();
    fetchCourses();
    fetchBatches();
    fetchBatchCourses();
    fetchPathways();
  }, []);

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('success_sessions')
        .select('*')
        .order('start_time', { ascending: false });

      if (error) throw error;
      setSessions((data as any as SuccessSession[]) || []);
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

  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('id, title')
        .order('title', { ascending: true });

      if (error) throw error;
      setCourses(data || []);
    } catch (error) {
      console.error('Error fetching courses:', error);
    }
  };

  const fetchBatches = async () => {
    try {
      const { data, error } = await supabase
        .from('batches')
        .select('id, name, course_id, status, start_date')
        .order('name', { ascending: true });

      if (error) throw error;
      setBatches(data || []);
    } catch (error) {
      console.error('Error fetching batches:', error);
    }
  };

  const fetchBatchCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('batch_courses')
        .select('batch_id, course_id');
      if (error) throw error;
      const map: Record<string, string[]> = {};
      for (const row of data || []) {
        if (!map[row.course_id]) map[row.course_id] = [];
        map[row.course_id].push(row.batch_id);
      }
      setBatchCourseMap(map);
    } catch (error) {
      console.error('Error fetching batch_courses:', error);
    }
  };

  const fetchPathways = async () => {
    try {
      const [{ data: pathData }, { data: pcData }] = await Promise.all([
        supabase.from('learning_pathways').select('id, name').order('name'),
        supabase.from('pathway_courses').select('course_id, pathway_id')
      ]);
      setPathways(pathData || []);
      setPathwayCourses(pcData || []);
    } catch (error) {
      console.error('Error fetching pathways:', error);
    }
  };

  const getPathwayForCourse = (courseId?: string) => {
    if (!courseId) return null;
    const pc = pathwayCourses.find(p => p.course_id === courseId);
    if (!pc) return null;
    return pathways.find(p => p.id === pc.pathway_id)?.name || null;
  };

  // Filter batches when course_id changes
  useEffect(() => {
    if (formData.course_id && formData.course_id !== '__all__') {
      const matching = batches.filter(b => b.course_id === formData.course_id);
      setFilteredBatches(matching);
    } else {
      setFilteredBatches(batches);
    }
  }, [formData.course_id, batches]);

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'draft':
        return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'upcoming':
        return 'bg-blue-50 text-blue-700 border border-blue-200';
      case 'completed':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'cancelled':
        return 'bg-rose-50 text-rose-700 border border-rose-200';
      default:
        return 'bg-muted text-muted-foreground border border-border';
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
      status: 'draft',
      course_id: '__all__',
      batch_ids: ['__all__']
    });
    setEditingSession(null);
  };

  const extractTimeFromTimestamp = (timestamp: string | undefined | null): string => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return '';
      return format(date, 'HH:mm');
    } catch {
      return '';
    }
  };

  const handleOpenDialog = (session?: SuccessSession) => {
    formSubmittedRef.current = false;
    if (session) {
      setEditingSession(session);
      setFormData({
        title: session.title,
        description: session.description || '',
        mentor_name: session.mentor_name || '',
        mentor_id: session.mentor_id || '',
        schedule_date: session.schedule_date || '',
        start_time: extractTimeFromTimestamp(session.start_time),
        end_time: extractTimeFromTimestamp(session.end_time),
        link: session.link || '',
        zoom_meeting_id: session.zoom_meeting_id || '',
        zoom_passcode: session.zoom_passcode || '',
        host_login_email: session.host_login_email || '',
        host_login_pwd: session.host_login_pwd || '',
        status: session.status || 'upcoming',
        course_id: session.course_id || '__all__',
        batch_ids: session.batch_ids && Array.isArray(session.batch_ids) && session.batch_ids.length > 0
          ? session.batch_ids
          : session.batch_id ? [session.batch_id] : ['__all__']
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = async () => {
    // If form was not submitted and has meaningful data, save as draft
    if (!formSubmittedRef.current && !editingSession && formData.title.trim()) {
      try {
        const selectedUser = users.find(user => user.id === formData.mentor_id);
        const combineDateTime = (date: string, time: string) => {
          if (!date || !time) return null;
          return `${date}T${time}:00`;
        };

        const baseSessionData = {
          title: formData.title,
          description: formData.description,
          mentor_name: selectedUser ? selectedUser.full_name : formData.mentor_name,
          mentor_id: formData.mentor_id || null,
          schedule_date: formData.schedule_date || null,
          start_time: combineDateTime(formData.schedule_date, formData.start_time),
          end_time: formData.end_time ? combineDateTime(formData.schedule_date, formData.end_time) : null,
          link: formData.link || null,
          zoom_meeting_id: formData.zoom_meeting_id || null,
          zoom_passcode: formData.zoom_passcode || null,
          host_login_email: formData.host_login_email || null,
          host_login_pwd: formData.host_login_pwd || null,
          status: 'draft',
          course_id: formData.course_id === '__all__' ? null : (formData.course_id || null),
          batch_id: null,
          batch_ids: formData.batch_ids.includes('__all__') ? null : formData.batch_ids.filter(id => id !== 'unbatched'),
          pathway_id: null as string | null
        };

        await supabase
          .from('success_sessions')
          .insert([baseSessionData] as any);

        toast({
          title: "Draft Saved",
          description: "Session saved as draft. You can continue editing it later.",
        });

        fetchSessions();
      } catch (error) {
        console.error('Error saving draft:', error);
      }
    }
    formSubmittedRef.current = false;
    setSubmitSuccess(false);
    setDialogOpen(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    formSubmittedRef.current = true;
    try {
      // Find the selected user to get their name
      const selectedUser = users.find(user => user.id === formData.mentor_id);
      
      // Combine date with time to create proper timestamps
      const combineDateTime = (date: string, time: string) => {
        if (!date || !time) return null;
        return `${date}T${time}:00`;
      };

      const baseSessionData = {
        title: formData.title,
        description: formData.description,
        mentor_name: selectedUser ? selectedUser.full_name : formData.mentor_name,
        mentor_id: formData.mentor_id || null,
        schedule_date: formData.schedule_date,
        start_time: combineDateTime(formData.schedule_date, formData.start_time),
        end_time: formData.end_time ? combineDateTime(formData.schedule_date, formData.end_time) : null,
        link: formData.link,
        zoom_meeting_id: formData.zoom_meeting_id,
        zoom_passcode: formData.zoom_passcode,
        host_login_email: formData.host_login_email,
        host_login_pwd: formData.host_login_pwd,
        status: formData.status,
        course_id: formData.course_id === '__all__' ? null : (formData.course_id || null),
        pathway_id: null as string | null
      };

      // Resolve batch_ids for JSONB column: '__all__' means null (all batches)
      const resolvedBatchIds = formData.batch_ids.includes('__all__')
        ? null
        : formData.batch_ids.filter(id => id !== 'unbatched');

      if (editingSession) {
        const sessionData = {
          ...baseSessionData,
          batch_id: null,
          batch_ids: resolvedBatchIds && resolvedBatchIds.length > 0 ? resolvedBatchIds : null
        };
        const { error } = await supabase
          .from('success_sessions')
          .update(sessionData as any)
          .eq('id', editingSession.id);

        if (error) throw error;

        // Reset reminder flag so a fresh 3h reminder will be sent for the new schedule
        await supabase
          .from('success_sessions')
          .update({ reminder_3h_sent_at: null } as any)
          .eq('id', editingSession.id);

        // Determine if this is a recording update (session already happened / marked completed)
        const sessionStart = baseSessionData.start_time ? new Date(baseSessionData.start_time) : null;
        const isPast = sessionStart ? sessionStart.getTime() < Date.now() : false;
        const isRecordingUpdate = baseSessionData.status === 'completed' || isPast;

        // Notify batch students about the schedule update (or recording availability)
        const updateBatchIds = resolvedBatchIds && resolvedBatchIds.length > 0 ? resolvedBatchIds : [];
        for (const batchId of updateBatchIds) {
          if (!batchId) continue;
          try {
            await supabase.functions.invoke('send-batch-content-notification', {
              body: {
                batch_id: batchId,
                item_type: 'LIVE_SESSION',
                item_id: editingSession.id,
                title: baseSessionData.title,
                description: baseSessionData.description,
                meeting_link: baseSessionData.link,
                start_datetime: baseSessionData.start_time,
                mentor_name: baseSessionData.mentor_name,
                cta_path: isRecordingUpdate ? '/videos' : '/live-sessions',
                is_recording_update: isRecordingUpdate,
              }
            });
          } catch (notifyError) {
            console.error('Failed to notify batch students:', notifyError);
          }
        }

        if (authUser?.id) {
          logUserActivity({
            user_id: authUser.id,
            activity_type: ACTIVITY_TYPES.SUCCESS_SESSION_SCHEDULED,
            metadata: {
              session_title: baseSessionData.title,
              session_date: baseSessionData.start_time || formData.schedule_date,
              scheduled_by: authUser.full_name || 'Admin',
              action: 'updated'
            }
          });
        }

        toast({
          title: "Success",
          description: "Session updated successfully",
        });
      } else {
        // Creating a single session record with batch_ids JSONB
        const courseId = baseSessionData.course_id;
        const relevantPathwayIds = courseId
          ? pathwayCourses.filter(pc => pc.course_id === courseId).map(pc => pc.pathway_id)
          : [];

        const sessionToInsert = {
          ...baseSessionData,
          batch_id: null,
          batch_ids: resolvedBatchIds && resolvedBatchIds.length > 0 ? resolvedBatchIds : null,
          pathway_id: relevantPathwayIds.length === 1 ? relevantPathwayIds[0] : null
        };

        const result = await safeQuery<SuccessSessionResult[]>(
          supabase
            .from('success_sessions')
            .insert([sessionToInsert] as any)
            .select(),
          'create success sessions'
        );

        if (!result.success) throw result.error;
        const newSessions = result.data || [];

        if (authUser?.id) {
          logUserActivity({
            user_id: authUser.id,
            activity_type: ACTIVITY_TYPES.SUCCESS_SESSION_SCHEDULED,
            metadata: {
              session_title: baseSessionData.title,
              session_date: baseSessionData.start_time || formData.schedule_date,
              scheduled_by: authUser.full_name || 'Admin',
              action: 'created',
              sessions_created: 1,
              batch_ids: resolvedBatchIds
            }
          });
        }

        // Notify mentor
        if (formData.mentor_id && newSessions.length > 0) {
          try {
            await notifyMentorOfSuccessSessionScheduled(
              formData.mentor_id,
              formData.title,
              baseSessionData.start_time || formData.schedule_date,
              newSessions[0].id
            );
          } catch (notificationError) {
            console.error('Failed to notify mentor:', notificationError);
          }
        }

        // Notify batch students for each batch in batch_ids
        if (resolvedBatchIds && resolvedBatchIds.length > 0 && newSessions.length > 0) {
          for (const batchId of resolvedBatchIds) {
            if (batchId) {
              try {
                await supabase.functions.invoke('send-batch-content-notification', {
                  body: {
                    batch_id: batchId,
                    item_type: 'LIVE_SESSION',
                    item_id: newSessions[0].id,
                    title: baseSessionData.title,
                    description: baseSessionData.description,
                    meeting_link: baseSessionData.link,
                    start_datetime: baseSessionData.start_time,
                    mentor_name: baseSessionData.mentor_name,
                    cta_path: '/live-sessions',
                  }
                });
              } catch (notifyError) {
                console.error('Failed to notify batch students:', notifyError);
              }
            }
          }
        }

        toast({
          title: "Success",
          description: resolvedBatchIds && resolvedBatchIds.length > 1
            ? `Session created for ${resolvedBatchIds.length} batches`
            : "Session created successfully",
        });
      }

      fetchSessions();
      setSubmitSuccess(true);
      setTimeout(() => {
        setSubmitSuccess(false);
        setDialogOpen(false);
        resetForm();
        formSubmittedRef.current = false;
      }, 1500);
    } catch (error) {
      toast({
        title: "Error",
        description: editingSession ? "Failed to update session" : "Failed to create session",
        variant: "destructive"
      });
    }
  };

  const handlePublish = async (session: SuccessSession) => {
    if (!session.link || !session.start_time) {
      toast({ title: "Cannot Publish", description: "Session must have a Zoom link and start time before publishing.", variant: "destructive" });
      return;
    }
    setPublishing(session.id);
    try {
      const { error } = await supabase
        .from('success_sessions')
        .update({ status: 'upcoming' })
        .eq('id', session.id);
      if (error) throw error;

      // Notify batch students via email + in-app for all batch_ids
      const sessionBatchIds: string[] = (session as any).batch_ids || (session.batch_id ? [session.batch_id] : []);
      for (const batchId of sessionBatchIds) {
        if (batchId) {
          try {
            await supabase.functions.invoke('send-batch-content-notification', {
              body: {
                batch_id: batchId,
                item_type: 'LIVE_SESSION',
                item_id: session.id,
                title: session.title,
                description: session.description,
                meeting_link: session.link,
                start_datetime: session.start_time,
                mentor_name: session.mentor_name,
                cta_path: '/live-sessions',
              }
            });
          } catch (notifyError) {
            console.error('Failed to notify batch students:', notifyError);
          }
        }
      }

      toast({ title: "Published!", description: "Session is now visible to students and notifications have been sent." });
      fetchSessions();
    } catch (error) {
      toast({ title: "Error", description: "Failed to publish session", variant: "destructive" });
    } finally {
      setPublishing(null);
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

  const handleToggleShared = async (session: SuccessSession) => {
    try {
      if (session.pathway_id) {
        // Currently scoped to a pathway — make it shared (null pathway_id)
        const { error } = await supabase
          .from('success_sessions')
          .update({ pathway_id: null } as any)
          .eq('id', session.id);
        if (error) throw error;
        toast({ title: "Shared", description: "Session is now shared across all pathways" });
      } else {
        // Currently shared — scope it to pathways (clone per pathway)
        const courseId = session.course_id;
        if (!courseId) {
          toast({ title: "Cannot scope", description: "Session has no course assigned", variant: "destructive" });
          return;
        }
        const relevantPathwayIds = pathwayCourses
          .filter(pc => pc.course_id === courseId)
          .map(pc => pc.pathway_id);

        if (relevantPathwayIds.length === 0) {
          toast({ title: "No pathways", description: "This course is not part of any pathway", variant: "destructive" });
          return;
        }

        // Update original to first pathway
        const { error: updateError } = await supabase
          .from('success_sessions')
          .update({ pathway_id: relevantPathwayIds[0] } as any)
          .eq('id', session.id);
        if (updateError) throw updateError;

        // Clone for remaining pathways
        if (relevantPathwayIds.length > 1) {
          const { id, created_at, created_by, ...sessionBase } = session;
          const clones = relevantPathwayIds.slice(1).map(pid => ({
            ...sessionBase,
            pathway_id: pid
          }));
          const { error: insertError } = await supabase
            .from('success_sessions')
            .insert(clones as any);
          if (insertError) throw insertError;
        }

        toast({ title: "Separated", description: `Session split into ${relevantPathwayIds.length} pathway-specific sessions` });
      }
      fetchSessions();
    } catch (error) {
      toast({ title: "Error", description: "Failed to update session sharing", variant: "destructive" });
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

  const stats = (() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let upcoming = 0, drafts = 0, completed = 0, todayCount = 0;
    sessions.forEach(s => {
      const status = (s.status || '').toLowerCase();
      if (status === 'draft') drafts++;
      else if (status === 'upcoming') upcoming++;
      else if (status === 'completed') completed++;
      try {
        const d = new Date(s.schedule_date);
        d.setHours(0, 0, 0, 0);
        if (d.getTime() === today.getTime()) todayCount++;
      } catch {}
    });
    return { total: sessions.length, upcoming, drafts, completed, today: todayCount };
  })();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            Success Sessions
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Schedule, publish and manage live mentor sessions for your batches.
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) handleCloseDialog(); else setDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button
              onClick={() => handleOpenDialog()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Schedule Session
            </Button>
          </DialogTrigger>
          <DialogContent
            className="max-w-2xl max-h-[90vh] p-0 overflow-hidden gap-0"
            onPointerDownOutside={(e) => { if (submitSuccess) e.preventDefault(); }}
          >
            {submitSuccess ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4 animate-fade-in">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Check className="w-8 h-8 text-emerald-600" />
                </div>
                <p className="text-lg font-semibold text-foreground">
                  {editingSession ? 'Session Updated!' : 'Session Scheduled!'}
                </p>
                <p className="text-sm text-muted-foreground">Closing automatically…</p>
              </div>
            ) : (
            <>
            <DialogHeader className="px-6 pt-6 pb-5 border-b border-border/60 bg-gradient-to-br from-primary/10 via-primary/5 to-background">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20 shrink-0">
                  <Video className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <DialogTitle className="text-xl font-semibold tracking-tight">
                    {editingSession ? 'Edit Success Session' : 'Schedule New Success Session'}
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground">
                    {editingSession
                      ? 'Update session details. Republishing will re-notify selected batches.'
                      : 'Set up a live mentor session. Students in selected batches will be notified when you publish.'}
                  </p>
                </div>
              </div>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="flex flex-col max-h-[calc(90vh-140px)]">
              <div className="overflow-y-auto px-6 py-5 space-y-5">

                {/* Section: Session details */}
                <section className="rounded-xl border border-indigo-200/70 dark:border-indigo-500/20 bg-indigo-50/40 dark:bg-indigo-500/5 p-5 space-y-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-200 dark:ring-indigo-500/20">
                      <Video className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">Session Details</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-foreground">Session Title <span className="text-rose-500">*</span></label>
                      <Input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({...formData, title: e.target.value})}
                        required
                        placeholder="e.g. Week 3 Q&A with Umar"
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-foreground">Host / Mentor <span className="text-rose-500">*</span></label>
                      <Select
                        value={formData.mentor_id}
                        onValueChange={(value) => setFormData({...formData, mentor_id: value})}
                        required
                      >
                        <SelectTrigger className="bg-background">
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
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-foreground">Description</label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      placeholder="What will this session cover? (shown to students in emails and the portal)"
                      rows={3}
                      className="resize-none bg-background"
                    />
                  </div>
                </section>

                {/* Section: Schedule */}
                <section className="rounded-xl border border-amber-200/70 dark:border-amber-500/20 bg-amber-50/40 dark:bg-amber-500/5 p-5 space-y-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-500/20">
                      <Clock className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">Schedule</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-foreground">Date <span className="text-rose-500">*</span></label>
                      <Input
                        type="date"
                        value={formData.schedule_date}
                        onChange={(e) => setFormData({...formData, schedule_date: e.target.value})}
                        required
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-foreground">Start Time <span className="text-rose-500">*</span></label>
                      <Input
                        type="time"
                        value={formData.start_time}
                        onChange={(e) => setFormData({...formData, start_time: e.target.value})}
                        required
                        step="900"
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-foreground">End Time</label>
                      <Input
                        type="time"
                        value={formData.end_time}
                        onChange={(e) => setFormData({...formData, end_time: e.target.value})}
                        step="900"
                        className="bg-background"
                      />
                    </div>
                  </div>
                </section>


                {/* Section: Zoom access */}
                <section className="rounded-xl border border-sky-200/70 dark:border-sky-500/20 bg-sky-50/40 dark:bg-sky-500/5 p-5 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-500/15 text-sky-600 dark:text-sky-400 ring-1 ring-sky-200 dark:ring-sky-500/20">
                        <LinkIcon className="w-4 h-4" />
                      </div>
                      <h3 className="text-sm font-semibold text-foreground">Zoom Access</h3>
                    </div>
                    <span className="text-[11px] text-sky-700 dark:text-sky-400 bg-sky-100/80 dark:bg-sky-500/10 px-2 py-0.5 rounded-full">🔒 Host credentials kept private</span>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-foreground">Session Link <span className="text-rose-500">*</span></label>
                    <Input
                      type="url"
                      value={formData.link}
                      onChange={(e) => setFormData({...formData, link: e.target.value})}
                      placeholder="https://zoom.us/j/..."
                      required
                      className="bg-background"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-foreground">Zoom Meeting ID <span className="text-rose-500">*</span></label>
                      <Input
                        type="text"
                        value={formData.zoom_meeting_id}
                        onChange={(e) => setFormData({...formData, zoom_meeting_id: e.target.value})}
                        required
                        placeholder="123 456 7890"
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-foreground">Zoom Passcode <span className="text-rose-500">*</span></label>
                      <Input
                        type="text"
                        value={formData.zoom_passcode}
                        onChange={(e) => setFormData({...formData, zoom_passcode: e.target.value})}
                        required
                        placeholder="Passcode"
                        className="bg-background"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-foreground">Host Login Email <span className="text-rose-500">*</span></label>
                      <Input
                        type="email"
                        value={formData.host_login_email}
                        onChange={(e) => setFormData({...formData, host_login_email: e.target.value})}
                        required
                        placeholder="host@example.com"
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-foreground">Host Login Password <span className="text-rose-500">*</span></label>
                      <Input
                        type="password"
                        value={formData.host_login_pwd}
                        onChange={(e) => setFormData({...formData, host_login_pwd: e.target.value})}
                        required
                        placeholder="••••••••"
                        className="bg-background"
                      />
                    </div>
                  </div>
                </section>

                {/* Section: Audience */}
                <section className="rounded-xl border border-emerald-200/70 dark:border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-500/5 p-5 space-y-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-500/20">
                      <Users2 className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">Audience &amp; Status</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
                        Target Course
                      </label>
                      <Select
                        value={formData.course_id}
                        onValueChange={(value) => setFormData({ ...formData, course_id: value, batch_ids: ['__all__'] })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All students (no filter)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">All students (no filter)</SelectItem>
                          {courses.map((course) => (
                            <SelectItem key={course.id} value={course.id}>
                              {course.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                        <Users2 className="w-3.5 h-3.5 text-muted-foreground" />
                        Target Batch
                      </label>
                      <Popover open={batchPopoverOpen} onOpenChange={setBatchPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-between font-normal">
                            <span className="truncate">
                              {formData.batch_ids.includes('__all__')
                                ? 'All Batches'
                                : formData.batch_ids.length === 1
                                  ? (formData.batch_ids[0] === 'unbatched'
                                    ? 'Unbatched students'
                                    : filteredBatches.find(b => b.id === formData.batch_ids[0])?.name || formData.batch_ids[0])
                                  : `${formData.batch_ids.length} batches selected`}
                            </span>
                            <Users2 className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[260px] p-2 max-h-[240px] overflow-y-auto" align="start">
                          <div className="space-y-1">
                            {/* All Batches option */}
                            <label className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                              <Checkbox
                                checked={formData.batch_ids.includes('__all__')}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setFormData({ ...formData, batch_ids: ['__all__'] });
                                  } else {
                                    setFormData({ ...formData, batch_ids: [] });
                                  }
                                }}
                              />
                              <span className="font-medium">All Batches</span>
                            </label>
                            {/* Unbatched option */}
                            <label className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                              <Checkbox
                                checked={formData.batch_ids.includes('unbatched') || formData.batch_ids.includes('__all__')}
                                onCheckedChange={(checked) => {
                                  if (formData.batch_ids.includes('__all__')) {
                                    const allBatchIds = filteredBatches.map(b => b.id);
                                    setFormData({ ...formData, batch_ids: checked ? ['unbatched', ...allBatchIds] : allBatchIds });
                                    return;
                                  }
                                  const without = formData.batch_ids.filter(id => id !== 'unbatched');
                                  if (checked) {
                                    setFormData({ ...formData, batch_ids: [...without, 'unbatched'] });
                                  } else {
                                    setFormData({ ...formData, batch_ids: without.length ? without : ['__all__'] });
                                  }
                                }}
                              />
                              <span>Unbatched students</span>
                            </label>
                            <div className="border-t my-1" />
                            {filteredBatches.map((batch) => (
                              <label key={batch.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                                <Checkbox
                                  checked={formData.batch_ids.includes(batch.id) || formData.batch_ids.includes('__all__')}
                                  onCheckedChange={(checked) => {
                                    if (formData.batch_ids.includes('__all__')) {
                                      const allBatchIds = filteredBatches.map(b => b.id).filter(id => id !== batch.id);
                                      const withUnbatched = [...allBatchIds, 'unbatched'];
                                      setFormData({ ...formData, batch_ids: checked ? [...withUnbatched, batch.id] : withUnbatched });
                                      return;
                                    }
                                    const without = formData.batch_ids.filter(id => id !== batch.id);
                                    if (checked) {
                                      setFormData({ ...formData, batch_ids: [...without, batch.id] });
                                    } else {
                                      setFormData({ ...formData, batch_ids: without.length ? without : ['__all__'] });
                                    }
                                  }}
                                />
                                <span>{batch.name}</span>
                              </label>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-foreground">Status <span className="text-rose-500">*</span></label>
                    <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft — save without notifying</SelectItem>
                        <SelectItem value="upcoming">Upcoming — visible to students</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">Tip: save as <strong>Draft</strong> first, then hit Publish from the table to notify students.</p>
                  </div>
                </section>
              </div>

              {/* Sticky footer */}
              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border/60 bg-muted/30">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  {editingSession ? 'Update Session' : 'Schedule Session'}
                </Button>
              </div>
            </form>
            </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, accent: 'text-foreground' },
          { label: 'Today', value: stats.today, accent: 'text-primary' },
          { label: 'Upcoming', value: stats.upcoming, accent: 'text-blue-600' },
          { label: 'Drafts', value: stats.drafts, accent: 'text-amber-600' },
        ].map(s => (
          <Card key={s.label} className="border border-border/60 shadow-none">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{s.label}</p>
              <p className={`text-2xl font-semibold mt-1 ${s.accent}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>


      {/* Upcoming 7 Days Sessions */}
      <UpcomingSessionsPreview
        sessions={sessions}
        courses={courses}
        batches={batches}
        batchCourseMap={batchCourseMap}
        pathways={pathways}
        pathwayCourses={pathwayCourses}
        onEdit={handleOpenDialog}
      />

      <Card className="border border-border/60 shadow-sm animate-fade-in">
        <CardHeader className="border-b border-border/60 bg-muted/30 space-y-3 py-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center text-base font-semibold text-foreground">
              <Video className="w-5 h-5 mr-2 text-primary" />
              All Success Sessions
            </CardTitle>
          </div>

          {/* Filter Row */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[180px] max-w-[260px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title..."
                value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
            <Select value={filterHost} onValueChange={setFilterHost}>
              <SelectTrigger className="w-[160px] h-9 text-sm">
                <SelectValue placeholder="All Hosts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Hosts</SelectItem>
                {users.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterCourse} onValueChange={v => { setFilterCourse(v); setFilterBatch('__all__'); }}>
              <SelectTrigger className="w-[160px] h-9 text-sm">
                <SelectValue placeholder="All Courses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Courses</SelectItem>
                {courses.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterBatch} onValueChange={setFilterBatch}>
              <SelectTrigger className="w-[150px] h-9 text-sm">
                <SelectValue placeholder="All Batches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Batches</SelectItem>
                {(filterCourse !== '__all__' ? batches.filter(b => b.course_id === filterCourse) : batches).map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px] h-9 text-sm">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 text-sm gap-1.5">
                  <CalendarIcon className="w-3.5 h-3.5" />
                  {filterDate ? format(filterDate, 'MMM d, yyyy') : 'Pick date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filterDate}
                  onSelect={setFilterDate}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            {(filterSearch || filterHost !== '__all__' || filterCourse !== '__all__' || filterBatch !== '__all__' || filterStatus !== '__all__' || filterDate) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-xs"
                onClick={() => {
                  setFilterSearch('');
                  setFilterHost('__all__');
                  setFilterCourse('__all__');
                  setFilterBatch('__all__');
                  setFilterStatus('__all__');
                  setFilterDate(undefined);
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {(() => {
            const filtered = sessions.filter(s => {
              if (filterSearch && !s.title.toLowerCase().includes(filterSearch.toLowerCase())) return false;
              if (filterHost !== '__all__' && s.mentor_id !== filterHost) return false;
              if (filterCourse !== '__all__' && s.course_id !== filterCourse) return false;
              if (filterBatch !== '__all__') {
                const sBatchIds: string[] = (s as any).batch_ids || (s.batch_id ? [s.batch_id] : []);
                if (sBatchIds.length === 0 || !sBatchIds.includes(filterBatch)) return false;
              }
              if (filterStatus !== '__all__' && s.status !== filterStatus) return false;
              if (filterDate) {
                try {
                  const sessionDate = new Date(s.schedule_date || s.start_time);
                  if (!isSameDay(sessionDate, filterDate)) return false;
                } catch { return false; }
              }
              return true;
            });
            if (filtered.length === 0) return (
              <div className="text-center py-16 px-6 animate-fade-in">
                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                  <Video className="w-7 h-7 text-muted-foreground" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1">No sessions found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {sessions.length > 0 ? 'Try adjusting your filters to see more results.' : 'Schedule your first success session to get started.'}
                </p>
                {sessions.length === 0 && (
                  <Button onClick={() => handleOpenDialog()} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    <Plus className="w-4 h-4 mr-2" />
                    Schedule Session
                  </Button>
                )}
              </div>
            );
            return (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="font-semibold min-w-[200px]">Session Title</TableHead>
                    <TableHead className="font-semibold min-w-[140px]">Host</TableHead>
                    <TableHead className="font-semibold min-w-[160px]">Pathway / Course / Batch</TableHead>
                    <TableHead className="font-semibold min-w-[120px]">Schedule Date</TableHead>
                    <TableHead className="font-semibold min-w-[100px]">Day</TableHead>
                    <TableHead className="font-semibold min-w-[140px]">Time</TableHead>
                    <TableHead className="font-semibold min-w-[100px]">Status</TableHead>
                    <TableHead className="font-semibold min-w-[140px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((session, index) => (
                    <TableRow
                      key={session.id}
                      className="hover:bg-muted/40 transition-colors animate-fade-in"
                      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
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
                          <User className="w-4 h-4 mr-2 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium truncate">{session.mentor_name || 'TBD'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[160px]">
                        <div className="flex flex-col gap-1">
                          {(() => {
                            const pathwayName = session.pathway_id 
                              ? pathways.find(p => p.id === session.pathway_id)?.name
                              : getPathwayForCourse(session.course_id);
                            return pathwayName ? (
                              <Badge variant="secondary" className="text-[10px] w-fit">
                                🎯 {pathwayName}
                              </Badge>
                            ) : !session.pathway_id && session.course_id && pathwayCourses.filter(pc => pc.course_id === session.course_id).length > 0 ? (
                              <Badge variant="outline" className="text-[10px] w-fit border-primary/30 text-primary">
                                🔗 Shared
                              </Badge>
                            ) : null;
                          })()}
                          <span className="truncate text-sm font-medium">
                            {courses.find(c => c.id === session.course_id)?.title || 'All Courses'}
                          </span>
                          {(() => {
                            const rawBatchIds = (session as any).batch_ids;
                            let sessionBatchIds: string[] = [];
                            if (Array.isArray(rawBatchIds)) {
                              sessionBatchIds = rawBatchIds.map(String);
                            } else if (typeof rawBatchIds === 'string') {
                              try { const p = JSON.parse(rawBatchIds); sessionBatchIds = Array.isArray(p) ? p.map(String) : []; } catch { /* ignore */ }
                            } else if (session.batch_id) {
                              sessionBatchIds = [session.batch_id];
                            }
                            if (sessionBatchIds.length === 0) {
                              return <Badge variant="outline" className="text-xs w-fit">All Batches</Badge>;
                            }
                            return (
                              <div className="flex flex-wrap gap-0.5">
                                {sessionBatchIds.map(bid => (
                                  <Badge key={bid} variant="outline" className="text-xs w-fit">
                                    {batches.find(b => b.id === bid)?.name || bid}
                                  </Badge>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[120px]">
                        <div className="flex items-center">
                          <CalendarIcon className="w-4 h-4 mr-2 text-muted-foreground flex-shrink-0" />
                          <span className="whitespace-nowrap">{formatDate(session.schedule_date)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[100px]">
                        <Badge variant="outline" className="whitespace-nowrap">
                          {getDayOfWeek(session.schedule_date)}
                        </Badge>
                      </TableCell>
                      <TableCell className="min-w-[140px]">
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 mr-2 text-muted-foreground flex-shrink-0" />
                          <span className="whitespace-nowrap">{formatTime(session.start_time)}</span>
                          {session.end_time && (
                            <span className="text-muted-foreground ml-1 whitespace-nowrap">- {formatTime(session.end_time)}</span>
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
                      <TableCell className="min-w-[180px]">
                        <div className="flex items-center gap-1">
                          {session.status === 'draft' && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handlePublish(session)}
                              disabled={!session.link || !session.start_time || publishing === session.id}
                              className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                              title={!session.link || !session.start_time ? "Add Zoom link & start time first" : "Publish & notify students"}
                            >
                              <Send className="w-3.5 h-3.5 mr-1" />
                              {publishing === session.id ? 'Publishing…' : 'Publish'}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
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
                            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                            disabled={!session.link}
                            title="Open session link"
                          >
                            <LinkIcon className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(session)}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                            title="Edit session"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          {session.course_id && pathwayCourses.some(pc => pc.course_id === session.course_id) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleToggleShared(session)}
                              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                              title={session.pathway_id ? 'Make shared across pathways' : 'Separate per pathway'}
                            >
                              {session.pathway_id ? <LinkIcon className="w-4 h-4" /> : <Users2 className="w-4 h-4" />}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(session.id)}
                            className="h-8 w-8 text-muted-foreground hover:text-rose-600 hover:bg-rose-50"
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
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}

interface UpcomingSessionsPreviewProps {
  sessions: SuccessSession[];
  courses: Course[];
  batches: Batch[];
  batchCourseMap: Record<string, string[]>;
  pathways: Pathway[];
  pathwayCourses: PathwayCourse[];
  onEdit: (session: SuccessSession) => void;
}

interface ComputedWeekSession {
  session: SuccessSession;
  computedDate: Date;
  batchId: string;
  batchName: string;
}

function UpcomingSessionsPreview({ sessions, courses, batches, batchCourseMap, pathways, pathwayCourses, onEdit }: UpcomingSessionsPreviewProps) {
  const [selectedBatch, setSelectedBatch] = useState('__all__');
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const now = new Date();
  const sevenDaysLater = new Date(now);
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

  const getPathway = (session: SuccessSession) => {
    // Use pathway_id directly if available
    if (session.pathway_id) {
      return pathways.find(p => p.id === session.pathway_id)?.name || null;
    }
    // Fallback: look up via course
    if (!session.course_id) return null;
    const pc = pathwayCourses.find(p => p.course_id === session.course_id);
    if (!pc) return null;
    return pathways.find(p => p.id === pc.pathway_id)?.name || null;
  };

  // Compute per-batch schedule dates using drip_days + batch start_date
  const computedSessions: ComputedWeekSession[] = [];

  for (const session of sessions) {
    if (session.status === 'cancelled') continue;

    const dripDays = (session as any).drip_days as number | null;

    // For drip-based sessions, compute date per batch regardless of status
    // (a session can be "completed" for one batch but upcoming for another)
    const skipNonDrip = session.status === 'completed' && dripDays == null;

    // Resolve batch IDs from both legacy batch_id and new batch_ids JSONB
    const sessionBatchIdList: string[] = Array.isArray((session as any).batch_ids)
      ? (session as any).batch_ids
      : typeof (session as any).batch_ids === 'string'
        ? (() => { try { const p = JSON.parse((session as any).batch_ids); return Array.isArray(p) ? p : []; } catch { return []; } })()
        : session.batch_id ? [session.batch_id] : [];

    if (dripDays != null) {
      let relevantBatches: Batch[];
      if (sessionBatchIdList.length > 0) {
        relevantBatches = batches.filter(b => sessionBatchIdList.includes(b.id));
      } else if (session.course_id) {
        const junctionBatchIds = batchCourseMap[session.course_id] || [];
        relevantBatches = batches.filter(b =>
          b.start_date && (b.course_id === session.course_id || junctionBatchIds.includes(b.id))
        );
      } else {
        relevantBatches = batches.filter(b => b.start_date);
      }

      for (const batch of relevantBatches) {
        if (!batch.start_date) continue;
        const batchStart = new Date(batch.start_date);
        const computedDate = new Date(batchStart);
        computedDate.setDate(computedDate.getDate() + dripDays);

        if (computedDate >= now && computedDate <= sevenDaysLater) {
          computedSessions.push({
            session,
            computedDate,
            batchId: batch.id,
            batchName: batch.name,
          });
        }
      }
    } else if (!skipNonDrip && session.schedule_date) {
      try {
        const sessionDate = new Date(session.schedule_date);
        if (sessionDate >= now && sessionDate <= sevenDaysLater) {
          if (sessionBatchIdList.length > 0) {
            // Create an entry per batch so each batch shows individually
            for (const bid of sessionBatchIdList) {
              const bName = batches.find(b => b.id === bid)?.name || bid;
              computedSessions.push({
                session,
                computedDate: sessionDate,
                batchId: bid,
                batchName: bName,
              });
            }
          } else {
            computedSessions.push({
              session,
              computedDate: sessionDate,
              batchId: '__all__',
              batchName: 'All Batches',
            });
          }
        }
      } catch { /* skip invalid dates */ }
    }
  }

  // Build pathway/course filter options
  const filterOptions: { id: string; label: string; type: 'pathway' | 'course' }[] = [];
  const pathwaysInSessions = new Set<string>();
  const coursesInSessions = new Set<string>();

  for (const cs of computedSessions) {
    if (cs.session.course_id) {
      coursesInSessions.add(cs.session.course_id);
    }
    if (cs.session.pathway_id) {
      pathwaysInSessions.add(cs.session.pathway_id);
    } else if (cs.session.course_id) {
      // Fallback for sessions without pathway_id
      const pcs = pathwayCourses.filter(pc => pc.course_id === cs.session.course_id);
      pcs.forEach(pc => pathwaysInSessions.add(pc.pathway_id));
    }
  }

  pathways.filter(p => pathwaysInSessions.has(p.id)).forEach(p => {
    filterOptions.push({ id: `pathway:${p.id}`, label: `🎯 ${p.name}`, type: 'pathway' });
  });
  courses.filter(c => coursesInSessions.has(c.id)).forEach(c => {
    filterOptions.push({ id: `course:${c.id}`, label: c.title, type: 'course' });
  });

  const toggleFilter = (filterId: string) => {
    setSelectedFilters(prev =>
      prev.includes(filterId) ? prev.filter(f => f !== filterId) : [...prev, filterId]
    );
  };

  // Apply batch filter
  let filtered = selectedBatch === '__all__'
    ? computedSessions
    : computedSessions.filter(cs => cs.batchId === selectedBatch);

  // Apply pathway/course multi-select filter
  if (selectedFilters.length > 0) {
    const selectedPathwayIds = new Set<string>();
    const selectedCourseIds = new Set<string>();
    for (const f of selectedFilters) {
      if (f.startsWith('pathway:')) {
        selectedPathwayIds.add(f.replace('pathway:', ''));
      } else if (f.startsWith('course:')) {
        selectedCourseIds.add(f.replace('course:', ''));
      }
    }
    filtered = filtered.filter(cs => {
      // Match by pathway_id directly
      if (cs.session.pathway_id && selectedPathwayIds.has(cs.session.pathway_id)) return true;
      // Match by course_id
      if (cs.session.course_id && selectedCourseIds.has(cs.session.course_id)) return true;
      // Fallback: match course via pathway_courses junction
      if (cs.session.course_id && selectedPathwayIds.size > 0) {
        return pathwayCourses.some(pc => 
          pc.course_id === cs.session.course_id && selectedPathwayIds.has(pc.pathway_id)
        );
      }
      return false;
    });
  }

  filtered.sort((a, b) => a.computedDate.getTime() - b.computedDate.getTime());

  // Deduplicate by session ID: merge batch names into a single entry
  const deduped: (ComputedWeekSession & { allBatchNames: string[] })[] = [];
  const seenSessionIds = new Map<string, number>();
  for (const cs of filtered) {
    const existing = seenSessionIds.get(cs.session.id);
    if (existing !== undefined) {
      if (cs.batchName && !deduped[existing].allBatchNames.includes(cs.batchName)) {
        deduped[existing].allBatchNames.push(cs.batchName);
      }
    } else {
      seenSessionIds.set(cs.session.id, deduped.length);
      deduped.push({ ...cs, allBatchNames: [cs.batchName] });
    }
  }

   const batchesForDropdown = batches.filter(b => b.status === 'active' || computedSessions.some(cs => cs.batchId === b.id));

  const needsAttention = (session: SuccessSession) => {
    return !session.zoom_meeting_id || !session.zoom_passcode || session.link === 'TBD' || !session.link;
  };

  // Always show the section, even if empty

  return (
    <Card className="shadow-lg border-0 bg-gradient-to-br from-amber-50 to-orange-50 animate-fade-in">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center text-lg">
            <CalendarDays className="w-5 h-5 mr-2 text-amber-600" />
            Upcoming Live Classes — Next 7 Days
            <Badge variant="secondary" className="ml-2">{deduped.length}</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            {filterOptions.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                    <Filter className="w-3 h-3" />
                    Pathway / Course
                    {selectedFilters.length > 0 && (
                      <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">{selectedFilters.length}</Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3 bg-popover z-50" align="end">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Filter by pathway or course</p>
                    {filterOptions.map(opt => (
                      <label key={opt.id} className="flex items-center gap-2 cursor-pointer text-sm hover:bg-accent/50 rounded px-1 py-0.5">
                        <Checkbox
                          checked={selectedFilters.includes(opt.id)}
                          onCheckedChange={() => toggleFilter(opt.id)}
                        />
                        <span className="truncate">{opt.label}</span>
                      </label>
                    ))}
                    {selectedFilters.length > 0 && (
                      <Button variant="ghost" size="sm" className="w-full text-xs mt-1" onClick={() => setSelectedFilters([])}>
                        Clear all
                      </Button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            )}
            <Select value={selectedBatch} onValueChange={setSelectedBatch}>
              <SelectTrigger className="w-[200px] h-8 text-xs">
                <SelectValue placeholder="Filter by batch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Batches</SelectItem>
                {batchesForDropdown.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {deduped.length === 0 ? (
          <div className="text-center py-8">
            <CalendarDays className="w-10 h-10 mx-auto mb-2 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No live classes scheduled in the next 7 days</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Sessions will appear here based on course timelines and batch start dates</p>
          </div>
        ) : (
          <div className="space-y-2">
            {deduped.map((cs, idx) => {
              const { session, computedDate, allBatchNames } = cs;
              const missing = needsAttention(session);
              const courseName = courses.find(c => c.id === session.course_id)?.title;
              const pathwayName = getPathway(session);

              return (
                <div
                  key={`${session.id}-${idx}`}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors hover:bg-background/80 ${
                    missing ? 'border-amber-300 bg-amber-50/50' : 'border-green-300 bg-green-50/50'
                  }`}
                  onClick={() => onEdit(session)}
                >
                  {missing ? (
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  ) : (
                    <Video className="w-4 h-4 text-green-500 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{session.title}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                      <span>{format(computedDate, 'EEE, MMM d')}</span>
                      {session.start_time && <span>• {format(new Date(session.start_time), 'h:mm a')}</span>}
                      {pathwayName && <span>• 🎯 {pathwayName}</span>}
                      {courseName && <span>• {courseName}</span>}
                      {allBatchNames.map(bn => (
                        <Badge key={bn} variant="outline" className="text-[10px] px-1.5 py-0">{bn}</Badge>
                      ))}
                    </div>
                  </div>
                  {missing && (
                    <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 shrink-0">
                      Needs Zoom Details
                    </Badge>
                  )}
                  {session.status === 'draft' && (
                    <Badge variant="outline" className="text-[10px] border-yellow-400 text-yellow-700 shrink-0">
                      Draft
                    </Badge>
                  )}
                  {session.mentor_name && (
                    <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {session.mentor_name}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
