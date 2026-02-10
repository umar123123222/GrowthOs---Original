import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, CalendarDays, Video, BookOpen, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, addWeeks, subWeeks, isSameDay, isSameMonth, isToday } from 'date-fns';

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: 'recording' | 'session';
  batchName: string;
  batchId: string;
  moduleName?: string;
  courseName: string;
  hostName?: string;
  status: 'done' | 'upcoming' | 'cancelled';
}

interface BatchInfo {
  id: string;
  name: string;
  start_date: string;
  course_id: string | null;
  pathway_id: string | null;
}

export function ContentScheduleCalendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'monthly' | 'weekly'>('monthly');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedBatch, setSelectedBatch] = useState<string>('all');
  const [batches, setBatches] = useState<BatchInfo[]>([]);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  useEffect(() => {
    fetchCalendarData();
  }, []);

  const fetchCalendarData = async () => {
    setLoading(true);
    try {
      // Fetch all active batches with start dates
      const { data: batchData } = await supabase
        .from('batches')
        .select('id, name, start_date, course_id, pathway_id')
        .eq('status', 'active');

      const activeBatches: BatchInfo[] = (batchData || []).filter(b => b.start_date);
      setBatches(activeBatches);

      if (!activeBatches.length) {
        setEvents([]);
        setLoading(false);
        return;
      }

      // Fetch all courses for names
      const { data: coursesData } = await supabase
        .from('courses')
        .select('id, title');
      const courseMap = new Map((coursesData || []).map(c => [c.id, c.title]));

      // Fetch all modules
      const { data: modulesData } = await supabase
        .from('modules')
        .select('id, title, course_id, order');
      const moduleMap = new Map((modulesData || []).map(m => [m.id, { title: m.title, course_id: m.course_id }]));

      // Fetch all recordings with drip_days
      const { data: recordingsData } = await supabase
        .from('available_lessons')
        .select('id, recording_title, drip_days, module, sequence_order');

      // Fetch all sessions with drip_days
      const { data: sessionsData } = await supabase
        .from('success_sessions')
        .select('id, title, course_id, mentor_name, status, schedule_date');

      // Fetch mentor assignments for courses
      const { data: mentorAssignments } = await supabase
        .from('mentor_course_assignments')
        .select('course_id, profiles!mentor_course_assignments_mentor_id_fkey(full_name)')
        .order('is_primary', { ascending: false });
      
      const courseMentorMap = new Map<string, string>();
      (mentorAssignments || []).forEach(ma => {
        if (!courseMentorMap.has(ma.course_id)) {
          courseMentorMap.set(ma.course_id, (ma.profiles as any)?.full_name || 'Unknown');
        }
      });

      // For pathway batches, fetch pathway courses
      const { data: pathwayCourses } = await supabase
        .from('pathway_courses')
        .select('pathway_id, course_id, step_number');

      const pathwayCourseMap = new Map<string, string[]>();
      (pathwayCourses || []).forEach(pc => {
        const existing = pathwayCourseMap.get(pc.pathway_id) || [];
        existing.push(pc.course_id);
        pathwayCourseMap.set(pc.pathway_id, existing);
      });

      const allEvents: CalendarEvent[] = [];
      const now = new Date();

      for (const batch of activeBatches) {
        const batchStart = new Date(batch.start_date);
        
        // Determine which courses belong to this batch
        let courseIds: string[] = [];
        if (batch.pathway_id) {
          courseIds = pathwayCourseMap.get(batch.pathway_id) || [];
        } else if (batch.course_id) {
          courseIds = [batch.course_id];
        }

        if (!courseIds.length) continue;

        // Get module IDs for these courses
        const relevantModuleIds = (modulesData || [])
          .filter(m => courseIds.includes(m.course_id))
          .map(m => m.id);

        // Map recordings to events
        (recordingsData || []).forEach(rec => {
          if (!rec.module || !relevantModuleIds.includes(rec.module)) return;
          if (rec.drip_days == null) return;

          const eventDate = new Date(batchStart);
          eventDate.setDate(eventDate.getDate() + rec.drip_days);

          const mod = moduleMap.get(rec.module);
          const courseId = mod?.course_id || '';

          allEvents.push({
            id: `${batch.id}-rec-${rec.id}`,
            title: rec.recording_title || 'Untitled Recording',
            date: eventDate,
            type: 'recording',
            batchName: batch.name,
            batchId: batch.id,
            moduleName: mod?.title || 'Unknown Module',
            courseName: courseMap.get(courseId) || 'Unknown Course',
            hostName: courseMentorMap.get(courseId),
            status: eventDate < now ? 'done' : 'upcoming',
          });
        });

        // Map sessions to events
        (sessionsData || []).forEach(session => {
          if (!session.course_id || !courseIds.includes(session.course_id)) return;
          
          const dripDays = (session as any).drip_days;
          let eventDate: Date;
          
          if (dripDays != null) {
            eventDate = new Date(batchStart);
            eventDate.setDate(eventDate.getDate() + dripDays);
          } else if (session.schedule_date) {
            eventDate = new Date(session.schedule_date);
          } else {
            return;
          }

          let status: 'done' | 'upcoming' | 'cancelled' = 'upcoming';
          if (session.status === 'completed') status = 'done';
          else if (session.status === 'cancelled') status = 'cancelled';
          else if (eventDate < now) status = 'done';

          allEvents.push({
            id: `${batch.id}-ses-${session.id}`,
            title: session.title || 'Untitled Session',
            date: eventDate,
            type: 'session',
            batchName: batch.name,
            batchId: batch.id,
            courseName: courseMap.get(session.course_id) || 'Unknown Course',
            hostName: session.mentor_name || courseMentorMap.get(session.course_id),
            status,
          });
        });
      }

      setEvents(allEvents);
    } catch (error) {
      console.error('Error fetching calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = useMemo(() => {
    if (selectedBatch === 'all') return events;
    return events.filter(e => e.batchId === selectedBatch);
  }, [events, selectedBatch]);

  const daysToDisplay = useMemo(() => {
    if (viewMode === 'weekly') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return eachDayOfInterval({ start, end });
    } else {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      const monthDays = eachDayOfInterval({ start, end });
      // Pad to start of week
      const firstDay = startOfWeek(start, { weekStartsOn: 1 });
      const lastDay = endOfWeek(end, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: firstDay, end: lastDay });
    }
  }, [currentDate, viewMode]);

  const navigatePrev = () => {
    setCurrentDate(prev => viewMode === 'monthly' ? subMonths(prev, 1) : subWeeks(prev, 1));
  };

  const navigateNext = () => {
    setCurrentDate(prev => viewMode === 'monthly' ? addMonths(prev, 1) : addWeeks(prev, 1));
  };

  const getEventsForDay = (day: Date) => {
    return filteredEvents.filter(e => isSameDay(e.date, day));
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'done': return 'bg-green-100 border-green-300 text-green-800';
      case 'cancelled': return 'bg-red-100 border-red-300 text-red-800';
      default: return 'bg-muted/50 border-border text-foreground';
    }
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'done': return 'bg-green-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-muted-foreground';
    }
  };

  const headerLabel = viewMode === 'monthly'
    ? format(currentDate, 'MMMM yyyy')
    : `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d')} - ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d, yyyy')}`;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading schedule...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-xl">
            <CalendarDays className="w-5 h-5 text-primary" />
            Content Schedule
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={selectedBatch} onValueChange={setSelectedBatch}>
              <SelectTrigger className="w-[180px] h-8 text-sm">
                <SelectValue placeholder="All Batches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Batches</SelectItem>
                {batches.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex border rounded-md overflow-hidden">
              <Button
                variant={viewMode === 'weekly' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none h-8 text-xs"
                onClick={() => setViewMode('weekly')}
              >
                Week
              </Button>
              <Button
                variant={viewMode === 'monthly' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none h-8 text-xs"
                onClick={() => setViewMode('monthly')}
              >
                Month
              </Button>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between mt-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={navigatePrev}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="font-semibold text-sm">{headerLabel}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={navigateNext}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-px mb-1">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-px bg-border rounded-md overflow-hidden">
          {daysToDisplay.map(day => {
            const dayEvents = getEventsForDay(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isExpanded = expandedDay === format(day, 'yyyy-MM-dd');
            const maxVisible = viewMode === 'weekly' ? 8 : 3;

            return (
              <div
                key={day.toISOString()}
                className={`bg-background ${viewMode === 'weekly' ? 'min-h-[140px]' : 'min-h-[90px]'} p-1 ${
                  !isCurrentMonth && viewMode === 'monthly' ? 'opacity-40' : ''
                } ${isToday(day) ? 'ring-2 ring-primary/30 ring-inset' : ''}`}
                onClick={() => dayEvents.length > maxVisible && setExpandedDay(isExpanded ? null : format(day, 'yyyy-MM-dd'))}
              >
                <div className={`text-xs font-medium mb-0.5 ${isToday(day) ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, isExpanded ? undefined : maxVisible).map(event => (
                    <div
                      key={event.id}
                      className={`text-[10px] leading-tight px-1 py-0.5 rounded border truncate ${getStatusBg(event.status)}`}
                      title={`${event.type === 'session' ? '🎥' : '📖'} ${event.title}\nBatch: ${event.batchName}\nCourse: ${event.courseName}${event.moduleName ? `\nModule: ${event.moduleName}` : ''}${event.hostName ? `\nHost: ${event.hostName}` : ''}\nStatus: ${event.status}`}
                    >
                      <span className="mr-0.5">{event.type === 'session' ? '🎥' : '📖'}</span>
                      {event.title}
                    </div>
                  ))}
                  {dayEvents.length > maxVisible && !isExpanded && (
                    <div className="text-[10px] text-primary font-medium cursor-pointer px-1">
                      +{dayEvents.length - maxVisible} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className={`w-2.5 h-2.5 rounded-full ${getStatusDot('done')}`} />
            <span>Done</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-2.5 h-2.5 rounded-full ${getStatusDot('upcoming')}`} />
            <span>Upcoming</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-2.5 h-2.5 rounded-full ${getStatusDot('cancelled')}`} />
            <span>Cancelled</span>
          </div>
          <div className="flex items-center gap-1 ml-2">
            <span>📖 Recording</span>
          </div>
          <div className="flex items-center gap-1">
            <span>🎥 Live Session</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
