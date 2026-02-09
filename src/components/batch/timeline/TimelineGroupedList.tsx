import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Video, Calendar, Radio, BookOpen } from 'lucide-react';
import type { TimelineItem } from '@/hooks/useBatchTimeline';
import { supabase } from '@/integrations/supabase/client';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { TimelineGroupItem } from './TimelineGroupItem';

interface CourseInfo {
  id: string;
  title: string;
}

interface GroupData {
  id: string;
  label: string;
  icon: React.ReactNode;
  items: TimelineItem[];
}

interface TimelineGroupedListProps {
  timelineItems: TimelineItem[];
  batchStartDate?: string;
  onEdit: (item: TimelineItem) => void;
  onDelete: (itemId: string) => void;
  onDeleteGroup: (items: TimelineItem[]) => void;
  onReorderGroups: (groupOrder: string[], groups: GroupData[]) => void;
  deletingProgress?: { total: number; deleted: number } | null;
}

export function TimelineGroupedList({
  timelineItems,
  batchStartDate,
  onEdit,
  onDelete,
  onDeleteGroup,
  onReorderGroups,
  deletingProgress,
}: TimelineGroupedListProps) {
  const [courses, setCourses] = useState<Record<string, CourseInfo>>({});
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [groupOrder, setGroupOrder] = useState<string[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    fetchCourseNames();
  }, [timelineItems]);

  const fetchCourseNames = async () => {
    const recordingIds = timelineItems
      .filter(item => item.recording_id)
      .map(item => item.recording_id!);

    if (recordingIds.length === 0) return;

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

    const recordingToCourse: Record<string, string> = {};
    (recordings || []).forEach(r => {
      const mod = r.module as any;
      if (mod?.course_id) recordingToCourse[r.id as string] = mod.course_id;
    });

    const courseMap: Record<string, CourseInfo> = {};
    (coursesData || []).forEach(c => { courseMap[c.id] = c; });

    const result: Record<string, CourseInfo> = {};
    Object.entries(recordingToCourse).forEach(([recId, courseId]) => {
      if (courseMap[courseId]) result[recId] = courseMap[courseId];
    });

    setCourses(result);
  };

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  // Build groups from timeline items
  const builtGroups = useMemo(() => {
    const groups: GroupData[] = [];

    const liveSessionItems = timelineItems.filter(item => item.type === 'LIVE_SESSION');
    const recordingItems = timelineItems.filter(item => item.type === 'RECORDING');

    const courseGroupsMap = new Map<string, TimelineItem[]>();
    const uncategorized: TimelineItem[] = [];

    recordingItems.forEach(item => {
      const courseInfo = item.recording_id ? courses[item.recording_id] : null;
      if (courseInfo) {
        if (!courseGroupsMap.has(courseInfo.id)) courseGroupsMap.set(courseInfo.id, []);
        courseGroupsMap.get(courseInfo.id)!.push(item);
      } else {
        uncategorized.push(item);
      }
    });

    courseGroupsMap.forEach((items, courseId) => {
      const courseInfo = Object.values(courses).find(c => c.id === courseId);
      groups.push({
        id: courseId,
        label: courseInfo?.title || 'Unknown Course',
        icon: <BookOpen className="w-4 h-4" />,
        items: items.sort((a, b) => a.drip_offset_days - b.drip_offset_days || a.sequence_order - b.sequence_order),
      });
    });

    if (uncategorized.length > 0) {
      groups.push({
        id: 'uncategorized',
        label: 'Other Recordings',
        icon: <Video className="w-4 h-4" />,
        items: uncategorized,
      });
    }

    if (liveSessionItems.length > 0) {
      groups.push({
        id: 'live-sessions',
        label: 'Live Sessions',
        icon: <Radio className="w-4 h-4" />,
        items: liveSessionItems.sort((a, b) => a.drip_offset_days - b.drip_offset_days),
      });
    }

    return groups;
  }, [timelineItems, courses]);

  // Initialize group order when groups change
  useEffect(() => {
    const builtIds = builtGroups.map(g => g.id);
    setGroupOrder(prev => {
      // Keep existing order for known groups, append new ones
      const ordered = prev.filter(id => builtIds.includes(id));
      const newIds = builtIds.filter(id => !ordered.includes(id));
      return [...ordered, ...newIds];
    });
  }, [builtGroups]);

  const orderedGroups = useMemo(() => {
    return groupOrder
      .map(id => builtGroups.find(g => g.id === id))
      .filter((g): g is GroupData => !!g);
  }, [groupOrder, builtGroups]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = groupOrder.indexOf(active.id as string);
    const newIndex = groupOrder.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = [...groupOrder];
    newOrder.splice(oldIndex, 1);
    newOrder.splice(newIndex, 0, active.id as string);
    setGroupOrder(newOrder);

    // Recalculate drip offsets based on new group order
    const reorderedGroups = newOrder
      .map(id => builtGroups.find(g => g.id === id))
      .filter((g): g is GroupData => !!g);
    onReorderGroups(newOrder, reorderedGroups);
  };

  const handleDeleteGroup = (_groupId: string, items: TimelineItem[]) => {
    onDeleteGroup(items);
  };

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
    <Card className="relative">
      {/* Deleting progress overlay */}
      {deletingProgress && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center rounded-lg">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="font-medium">Deleting items...</p>
            <div className="w-48 mx-auto">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${(deletingProgress.deleted / deletingProgress.total) * 100}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {deletingProgress.deleted} / {deletingProgress.total}
              </p>
            </div>
          </div>
        </div>
      )}

      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Content Timeline
          <Badge variant="secondary" className="ml-auto">{timelineItems.length} items</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={groupOrder} strategy={verticalListSortingStrategy}>
            {orderedGroups.map(group => (
              <TimelineGroupItem
                key={group.id}
                group={group}
                isCollapsed={collapsedGroups.has(group.id)}
                batchStartDate={batchStartDate}
                onToggle={() => toggleGroup(group.id)}
                onEdit={onEdit}
                onDelete={onDelete}
                onDeleteGroup={handleDeleteGroup}
              />
            ))}
          </SortableContext>
        </DndContext>
      </CardContent>
    </Card>
  );
}
