import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarIcon, CalendarDays, Clock, Video, User, Link as LinkIcon, Plus, Edit, Trash2, BookOpen, Users2, Search, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { safeQuery } from '@/lib/database-safety';
import type { SuccessSessionResult } from '@/types/database';
import { format, isSameDay } from 'date-fns';
import { notifyMentorOfSuccessSessionScheduled } from '@/lib/notification-service';
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
  batch_id: string;
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
    batch_id: ''
  });
  const [publishing, setPublishing] = useState<string | null>(null);
  const { toast } = useToast();

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
        return 'bg-yellow-100 text-yellow-800';
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
      status: 'draft',
      course_id: '__all__',
      batch_id: ''
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
        mentor_id: session.mentor_id || '',
        schedule_date: session.schedule_date || '',
        start_time: session.start_time || '',
        end_time: session.end_time || '',
        link: session.link || '',
        zoom_meeting_id: session.zoom_meeting_id || '',
        zoom_passcode: session.zoom_passcode || '',
        host_login_email: session.host_login_email || '',
        host_login_pwd: session.host_login_pwd || '',
        status: session.status || 'upcoming',
        course_id: session.course_id || '__all__',
        batch_id: session.batch_id || ''
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
        batch_id: formData.batch_id === '' || formData.batch_id === 'unbatched' ? null : formData.batch_id
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
        const result = await safeQuery<SuccessSessionResult>(
          supabase
            .from('success_sessions')
            .insert([sessionData])
            .select()
            .single(),
          'create new success session'
        );

        if (!result.success) throw result.error;
        const newSession = result.data;


        // Notify the assigned mentor about the new session
        if (formData.mentor_id && newSession) {
          try {
            await notifyMentorOfSuccessSessionScheduled(
              formData.mentor_id,
              formData.title,
              sessionData.start_time || formData.schedule_date,
              newSession.id
            );
          } catch (notificationError) {
            console.error('Failed to notify mentor:', notificationError);
            // Don't fail the session creation if notification fails
          }
        }

        // Notify batch students via email + in-app notifications
        if (sessionData.batch_id && newSession) {
          try {
            await supabase.functions.invoke('send-batch-content-notification', {
              body: {
                batch_id: sessionData.batch_id,
                item_type: 'LIVE_SESSION',
                item_id: newSession.id,
                title: sessionData.title,
                description: sessionData.description,
                meeting_link: sessionData.link,
                start_datetime: sessionData.start_time
              }
            });
            toast({
              title: "Success",
              description: "Session created and students notified successfully",
            });
          } catch (notifyError) {
            console.error('Failed to notify batch students:', notifyError);
            toast({
              title: "Success",
              description: "Session created, but student notifications may have failed",
            });
          }
        } else {
          toast({
            title: "Success",
            description: "Session created successfully",
          });
        }
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

      // Notify batch students via email + in-app
      if (session.batch_id) {
        try {
          await supabase.functions.invoke('send-batch-content-notification', {
            body: {
              batch_id: session.batch_id,
              item_type: 'LIVE_SESSION',
              item_id: session.id,
              title: session.title,
              description: session.description,
              meeting_link: session.link,
              start_datetime: session.start_time
            }
          });
        } catch (notifyError) {
          console.error('Failed to notify batch students:', notifyError);
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
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="upcoming">Upcoming</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Course & Batch Targeting */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                    <BookOpen className="w-4 h-4 text-muted-foreground" />
                    Target Course
                  </label>
                  <Select
                    value={formData.course_id}
                    onValueChange={(value) => setFormData({ ...formData, course_id: value, batch_id: '' })}
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
                <div>
                  <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                    <Users2 className="w-4 h-4 text-muted-foreground" />
                    Target Batch
                  </label>
                  <Select
                    value={formData.batch_id}
                    onValueChange={(value) => setFormData({ ...formData, batch_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select batch" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unbatched">Unbatched students</SelectItem>
                      {filteredBatches.map((batch) => (
                        <SelectItem key={batch.id} value={batch.id}>
                          {batch.name}
                        </SelectItem>
                      ))}
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

      <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50 animate-fade-in">
        <CardHeader className="bg-gradient-to-r from-orange-50 to-red-50 border-b space-y-3">
          <CardTitle className="flex items-center text-xl">
            <Video className="w-6 h-6 mr-3 text-orange-600" />
            All Success Sessions
          </CardTitle>

          {/* Filter Row */}
          <div className="flex flex-wrap gap-2 items-end">
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
              if (filterBatch !== '__all__' && s.batch_id !== filterBatch) return false;
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
              <div className="text-center py-16 animate-fade-in">
                <Video className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-muted-foreground mb-2">No sessions found</h3>
                <p className="text-muted-foreground">{sessions.length > 0 ? 'Try adjusting your filters' : 'Schedule your first success session to get started'}</p>
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
                          <User className="w-4 h-4 mr-2 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium truncate">{session.mentor_name || 'TBD'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[160px]">
                        <div className="flex flex-col gap-1">
                          {(() => {
                            const pathwayName = getPathwayForCourse(session.course_id);
                            return pathwayName ? (
                              <Badge variant="secondary" className="text-[10px] w-fit">
                                🎯 {pathwayName}
                              </Badge>
                            ) : null;
                          })()}
                          <span className="truncate text-sm font-medium">
                            {courses.find(c => c.id === session.course_id)?.title || 'All Courses'}
                          </span>
                          <Badge variant="outline" className="text-xs w-fit">
                            {session.batch_id
                              ? batches.find(b => b.id === session.batch_id)?.name || 'Unknown Batch'
                              : 'All Batches'}
                          </Badge>
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
                        <div className="flex space-x-2">
                          {session.status === 'draft' && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handlePublish(session)}
                              disabled={!session.link || !session.start_time || publishing === session.id}
                              className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white"
                              title={!session.link || !session.start_time ? "Add Zoom link & start time first" : "Publish & notify students"}
                            >
                              <Send className="w-4 h-4 mr-1" />
                              {publishing === session.id ? 'Publishing...' : 'Publish'}
                            </Button>
                          )}
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
  const now = new Date();
  const sevenDaysLater = new Date(now);
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

  const getPathway = (courseId?: string) => {
    if (!courseId) return null;
    const pc = pathwayCourses.find(p => p.course_id === courseId);
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

    if (dripDays != null) {
      let relevantBatches: Batch[];
      if (session.batch_id) {
        relevantBatches = batches.filter(b => b.id === session.batch_id);
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
          const batchName = session.batch_id
            ? batches.find(b => b.id === session.batch_id)?.name || 'Unknown'
            : 'All Batches';
          computedSessions.push({
            session,
            computedDate: sessionDate,
            batchId: session.batch_id || '__all__',
            batchName,
          });
        }
      } catch { /* skip invalid dates */ }
    }
  }

  const filtered = selectedBatch === '__all__'
    ? computedSessions
    : computedSessions.filter(cs => cs.batchId === selectedBatch);

  filtered.sort((a, b) => a.computedDate.getTime() - b.computedDate.getTime());

  const batchesWithSessions = Array.from(
    new Map(computedSessions.map(cs => [cs.batchId, cs.batchName])).entries()
  );

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
            <Badge variant="secondary" className="ml-2">{filtered.length}</Badge>
          </CardTitle>
          <Select value={selectedBatch} onValueChange={setSelectedBatch}>
            <SelectTrigger className="w-[200px] h-8 text-xs">
              <SelectValue placeholder="Filter by batch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Batches</SelectItem>
              {batchesWithSessions.map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {filtered.length === 0 ? (
          <div className="text-center py-8">
            <CalendarDays className="w-10 h-10 mx-auto mb-2 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No live classes scheduled in the next 7 days</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Sessions will appear here based on course timelines and batch start dates</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((cs, idx) => {
              const { session, computedDate, batchName } = cs;
              const missing = needsAttention(session);
              const courseName = courses.find(c => c.id === session.course_id)?.title;
              const pathwayName = getPathway(session.course_id);

              return (
                <div
                  key={`${session.id}-${cs.batchId}-${idx}`}
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
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{batchName}</Badge>
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
