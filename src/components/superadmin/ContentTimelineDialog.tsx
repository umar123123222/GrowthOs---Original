import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Clock, Save, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';

interface ContentTimelineDialogProps {
  type: 'course' | 'pathway';
  entityId: string;
  entityName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface RecordingItem {
  id: string;
  recording_title: string | null;
  sequence_order: number | null;
  duration_min: number | null;
  drip_days: number | null;
  module_id: string | null;
  module_title: string;
  course_id: string | null;
  course_title: string;
  step_number: number | null;
}

export function ContentTimelineDialog({ type, entityId, entityName, open, onOpenChange }: ContentTimelineDialogProps) {
  const [recordings, setRecordings] = useState<RecordingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editedDripDays, setEditedDripDays] = useState<Record<string, number | null>>({});
  const { toast } = useToast();

  useEffect(() => {
    if (open && entityId) {
      fetchRecordings();
      setEditedDripDays({});
    }
  }, [open, entityId]);

  const fetchRecordings = async () => {
    setLoading(true);
    try {
      if (type === 'course') {
        await fetchCourseRecordings(entityId);
      } else {
        await fetchPathwayRecordings(entityId);
      }
    } catch (error) {
      logger.error('Error fetching recordings for timeline:', error);
      toast({ title: "Error", description: "Failed to load recordings", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchCourseRecordings = async (courseId: string, courseTitle?: string, stepNumber?: number) => {
    console.log('[Timeline] Fetching modules for courseId:', courseId, 'courseTitle:', courseTitle || entityName);
    const { data: modules } = await supabase
      .from('modules')
      .select('id, title, order')
      .eq('course_id', courseId)
      .order('order', { ascending: true });

    console.log('[Timeline] Modules found:', modules?.map(m => ({ id: m.id, title: m.title })));
    if (!modules?.length) return [];

    const moduleIds = modules.map(m => m.id);
    const { data: lessons } = await supabase
      .from('available_lessons')
      .select('id, recording_title, sequence_order, duration_min, drip_days, module')
      .in('module', moduleIds)
      .order('sequence_order', { ascending: true });

    const items: RecordingItem[] = (lessons || []).map(l => {
      const mod = modules.find(m => m.id === l.module);
      return {
        id: l.id,
        recording_title: l.recording_title,
        sequence_order: l.sequence_order,
        duration_min: l.duration_min,
        drip_days: l.drip_days,
        module_id: l.module,
        module_title: mod?.title || 'Unknown Module',
        course_id: courseId,
        course_title: courseTitle || entityName,
        step_number: stepNumber ?? null,
      };
    });

    if (type === 'course') {
      setRecordings(items);
    }
    return items;
  };

  const fetchPathwayRecordings = async (pathwayId: string) => {
    const { data: pathwayCourses } = await supabase
      .from('pathway_courses')
      .select('course_id, step_number, courses(title)')
      .eq('pathway_id', pathwayId)
      .order('step_number', { ascending: true });

    if (!pathwayCourses?.length) {
      setRecordings([]);
      return;
    }

    const allItems: RecordingItem[] = [];
    for (const pc of pathwayCourses) {
      const courseTitle = (pc.courses as any)?.title || 'Unknown Course';
      const items = await fetchCourseRecordings(pc.course_id, courseTitle, pc.step_number);
      if (items) allItems.push(...items);
    }
    setRecordings(allItems);
  };

  const handleDripDaysChange = (recordingId: string, value: string) => {
    const numValue = value === '' ? null : parseInt(value);
    setEditedDripDays(prev => ({ ...prev, [recordingId]: numValue }));
  };

  const getDripDaysValue = (recording: RecordingItem): number | null => {
    if (recording.id in editedDripDays) return editedDripDays[recording.id];
    return recording.drip_days;
  };

  const hasChanges = Object.keys(editedDripDays).length > 0;

  const handleSave = async () => {
    if (!hasChanges) return;
    setSaving(true);
    try {
      const updates = Object.entries(editedDripDays);
      for (const [id, drip_days] of updates) {
        const { error } = await supabase
          .from('available_lessons')
          .update({ drip_days })
          .eq('id', id);
        if (error) throw error;
      }

      toast({ title: "Success", description: `Updated drip days for ${updates.length} recording(s)` });
      setEditedDripDays({});
      await fetchRecordings();
    } catch (error) {
      logger.error('Error saving drip days:', error);
      toast({ title: "Error", description: "Failed to save changes", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Group recordings by course (for pathway) then by module
  const groupedByCourse = recordings.reduce((acc, r) => {
    const courseKey = r.course_id || 'unknown';
    if (!acc[courseKey]) {
      acc[courseKey] = { title: r.course_title, stepNumber: r.step_number, modules: {} };
    }
    const moduleKey = r.module_id || 'unknown';
    if (!acc[courseKey].modules[moduleKey]) {
      acc[courseKey].modules[moduleKey] = { title: r.module_title, recordings: [] };
    }
    acc[courseKey].modules[moduleKey].recordings.push(r);
    return acc;
  }, {} as Record<string, { title: string; stepNumber: number | null; modules: Record<string, { title: string; recordings: RecordingItem[] }> }>);

  const courseEntries = Object.entries(groupedByCourse).sort(
    ([, a], [, b]) => (a.stepNumber ?? 0) - (b.stepNumber ?? 0)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Content Timeline - {entityName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : recordings.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No recordings found. Add modules and recordings first.
          </p>
        ) : (
          <div className="space-y-4">
            {courseEntries.map(([courseId, courseData]) => (
              <div key={courseId} className="space-y-3">
                {type === 'pathway' && (
                  <div className="flex items-center gap-2 pt-2 border-t first:border-t-0 first:pt-0">
                    <Badge variant="outline" className="text-xs">
                      Step {courseData.stepNumber}
                    </Badge>
                    <span className="font-semibold text-sm">{courseData.title}</span>
                  </div>
                )}

                {Object.entries(courseData.modules).map(([moduleId, moduleData]) => (
                  <div key={moduleId} className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pl-1">
                      {moduleData.title}
                    </p>
                    <div className="border rounded-md divide-y">
                      {moduleData.recordings.map((rec) => {
                        const currentValue = getDripDaysValue(rec);
                        const isEdited = rec.id in editedDripDays;
                        return (
                          <div key={rec.id} className="flex items-center gap-3 px-3 py-2">
                            <span className="text-xs text-muted-foreground w-6 text-right shrink-0">
                              {rec.sequence_order ?? '-'}
                            </span>
                            <span className="text-sm flex-1 truncate">{rec.recording_title || 'Untitled'}</span>
                            {rec.duration_min != null && (
                              <span className="text-xs text-muted-foreground shrink-0">
                                {rec.duration_min}m
                              </span>
                            )}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Input
                                type="number"
                                min={0}
                                value={currentValue ?? ''}
                                onChange={(e) => handleDripDaysChange(rec.id, e.target.value)}
                                className={`w-20 h-8 text-sm ${isEdited ? 'border-primary ring-1 ring-primary/30' : ''}`}
                                placeholder="0"
                              />
                              <span className="text-xs text-muted-foreground">days</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save All
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
