import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Video, Radio, Calendar, Edit, Trash2, GripVertical, FileText,
  BookOpen, ChevronDown, ChevronRight
} from 'lucide-react';
import { format, addDays } from 'date-fns';
import type { TimelineItem, TimelineItemType } from '@/hooks/useBatchTimeline';
import { supabase } from '@/integrations/supabase/client';

interface CourseInfo {
  id: string;
  title: string;
}

interface TimelineGroupedListProps {
  timelineItems: TimelineItem[];
  batchStartDate?: string;
  onEdit: (item: TimelineItem) => void;
  onDelete: (itemId: string) => void;
}

export function TimelineGroupedList({ timelineItems, batchStartDate, onEdit, onDelete }: TimelineGroupedListProps) {
  const [courses, setCourses] = useState<Record<string, CourseInfo>>({});
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchCourseNames();
  }, [timelineItems]);

  const fetchCourseNames = async () => {
    const recordingIds = timelineItems
      .filter(item => item.recording_id)
      .map(item => item.recording_id!);

    if (recordingIds.length === 0) return;

    // Use the module join to get course_id in one query
    const { data: recordings } = await supabase
      .from('available_lessons')
      .select('id, module:modules(id, course_id)')
      .in('id', recordingIds);

    const courseIds = [...new Set((recordings || []).map(r => {
      const mod = r.module as any;
      return mod?.course_id;
    }).filter(Boolean))];

    if (courseIds.length === 0) return;

    const { data: coursesData } = await supabase
      .from('courses')
      .select('id, title')
      .in('id', courseIds);

    // Build recording -> course mapping
    const recordingToCourse: Record<string, string> = {};
    (recordings || []).forEach(r => {
      const mod = r.module as any;
      if (mod?.course_id) recordingToCourse[r.id as string] = mod.course_id;
    });

    const courseMap: Record<string, CourseInfo> = {};
    (coursesData || []).forEach(c => { courseMap[c.id] = c; });

    // Store course info keyed by recording_id for easy lookup
    const result: Record<string, CourseInfo> = {};
    Object.entries(recordingToCourse).forEach(([recId, courseId]) => {
      if (courseMap[courseId]) result[recId] = courseMap[courseId];
    });

    setCourses(result);
  };

  const getDeployDate = (offsetDays: number) => {
    if (!batchStartDate) return '-';
    return format(addDays(new Date(batchStartDate), offsetDays), 'MMM dd, yyyy');
  };

  const getItemIcon = (type: TimelineItemType) => {
    return type === 'RECORDING' ? <Video className="w-4 h-4" /> : <Radio className="w-4 h-4" />;
  };

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  // Group items: recordings by course, live sessions separate
  const groups: { id: string; label: string; icon: React.ReactNode; items: TimelineItem[] }[] = [];
  
  const liveSessionItems = timelineItems.filter(item => item.type === 'LIVE_SESSION');
  const recordingItems = timelineItems.filter(item => item.type === 'RECORDING');

  // Group recordings by course
  const courseGroups = new Map<string, TimelineItem[]>();
  const uncategorized: TimelineItem[] = [];

  recordingItems.forEach(item => {
    const courseInfo = item.recording_id ? courses[item.recording_id] : null;
    if (courseInfo) {
      if (!courseGroups.has(courseInfo.id)) courseGroups.set(courseInfo.id, []);
      courseGroups.get(courseInfo.id)!.push(item);
    } else {
      uncategorized.push(item);
    }
  });

  courseGroups.forEach((items, courseId) => {
    const courseInfo = Object.values(courses).find(c => c.id === courseId);
    groups.push({
      id: courseId,
      label: courseInfo?.title || 'Unknown Course',
      icon: <BookOpen className="w-4 h-4" />,
      items: items.sort((a, b) => a.drip_offset_days - b.drip_offset_days || a.sequence_order - b.sequence_order)
    });
  });

  if (uncategorized.length > 0) {
    groups.push({
      id: 'uncategorized',
      label: 'Other Recordings',
      icon: <Video className="w-4 h-4" />,
      items: uncategorized
    });
  }

  if (liveSessionItems.length > 0) {
    groups.push({
      id: 'live-sessions',
      label: 'Live Sessions',
      icon: <Radio className="w-4 h-4" />,
      items: liveSessionItems.sort((a, b) => a.drip_offset_days - b.drip_offset_days)
    });
  }

  if (timelineItems.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Content Timeline
            <Badge variant="secondary" className="ml-auto">0 items</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <Video className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">No Timeline Items</h3>
            <p>Add recordings, import courses, or add live sessions to build your batch timeline</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Content Timeline
          <Badge variant="secondary" className="ml-auto">{timelineItems.length} items</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {groups.map(group => {
          const isCollapsed = collapsedGroups.has(group.id);
          return (
            <div key={group.id} className="border rounded-lg overflow-hidden">
              <button
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center gap-3 p-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
              >
                {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {group.icon}
                <span className="font-medium">{group.label}</span>
                <Badge variant="secondary" className="ml-auto">{group.items.length}</Badge>
              </button>
              
              {!isCollapsed && (
                <div className="divide-y">
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 p-3 px-4 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-2 text-muted-foreground min-w-[80px]">
                        <GripVertical className="w-4 h-4" />
                        <span className="font-mono text-sm">Day {item.drip_offset_days}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {getItemIcon(item.type)}
                        <Badge variant={item.type === 'RECORDING' ? 'default' : 'secondary'} className="text-xs">
                          {item.type === 'RECORDING' ? 'Rec' : 'Live'}
                        </Badge>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate">{item.title}</h4>
                        <p className="text-xs text-muted-foreground">
                          Deploys: {getDeployDate(item.drip_offset_days)}
                          {item.type === 'LIVE_SESSION' && item.start_datetime && (
                            <> • {format(new Date(item.start_datetime), 'MMM dd, h:mm a')}</>
                          )}
                          {item.assignment && (
                            <> • <FileText className="w-3 h-3 inline" /> {item.assignment.name}</>
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(item)}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => onDelete(item.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
