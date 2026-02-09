import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { BookOpen, Download, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { TimelineItemFormData, TimelineItem } from '@/hooks/useBatchTimeline';

interface CourseWithModules {
  id: string;
  title: string;
  modules: {
    id: string;
    title: string;
    order: number;
    recordings: {
      id: string;
      recording_title: string;
      sequence_order: number;
    }[];
  }[];
}

interface ImportCourseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (items: TimelineItemFormData[]) => Promise<void>;
  existingRecordingIds: string[];
  currentItemCount: number;
  timelineItems: TimelineItem[];
}

export function ImportCourseDialog({ open, onOpenChange, onImport, existingRecordingIds, currentItemCount, timelineItems }: ImportCourseDialogProps) {
  const [courses, setCourses] = useState<CourseWithModules[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedRecordings, setSelectedRecordings] = useState<Set<string>>(new Set());
  const [baseDripOffset, setBaseDripOffset] = useState(0);
  const [dripInterval, setDripInterval] = useState(1);
  const { toast } = useToast();

  // Auto-calculate the start day based on existing timeline items
  const getNextAvailableDay = () => {
    if (timelineItems.length === 0) return 0;
    const maxOffset = Math.max(...timelineItems.map(item => item.drip_offset_days));
    return maxOffset + 1; // Start the day after the last item
  };

  useEffect(() => {
    if (open) {
      fetchCoursesWithRecordings();
      setBaseDripOffset(getNextAvailableDay());
    }
  }, [open]);

  const fetchCoursesWithRecordings = async () => {
    setLoading(true);
    try {
      // Fetch courses
      const { data: coursesData } = await supabase
        .from('courses')
        .select('id, title')
        .eq('is_active', true)
        .order('sequence_order');

      // Fetch modules with course_id
      const { data: modulesData } = await supabase
        .from('modules')
        .select('id, title, order, course_id')
        .order('order');

      // Fetch recordings with module join
      const { data: recordingsData } = await supabase
        .from('available_lessons')
        .select('id, recording_title, sequence_order, module:modules(id, title, course_id)')
        .order('sequence_order');

      const courseMap: CourseWithModules[] = (coursesData || []).map(course => {
        const courseModules = (modulesData || [])
          .filter(m => m.course_id === course.id)
          .map(mod => ({
            id: mod.id,
            title: mod.title,
            order: mod.order || 0,
            recordings: (recordingsData || [])
              .filter(r => {
                const modInfo = r.module as any;
                return modInfo?.id === mod.id;
              })
              .map(r => ({
                id: r.id,
                recording_title: r.recording_title,
                sequence_order: r.sequence_order || 0
              }))
          }))
          .filter(m => m.recordings.length > 0);

        return { ...course, modules: courseModules };
      }).filter(c => c.modules.length > 0);

      setCourses(courseMap);
    } catch (error) {
      console.error('Error fetching courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedCourse = courses.find(c => c.id === selectedCourseId);

  const selectAllFromCourse = (course: CourseWithModules) => {
    const allIds = new Set<string>();
    course.modules.forEach(mod => {
      mod.recordings.forEach(rec => {
        if (!existingRecordingIds.includes(rec.id)) {
          allIds.add(rec.id);
        }
      });
    });
    setSelectedRecordings(allIds);
  };

  const toggleRecording = (id: string) => {
    setSelectedRecordings(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectCourse = (courseId: string) => {
    setSelectedCourseId(courseId);
    const course = courses.find(c => c.id === courseId);
    if (course) selectAllFromCourse(course);
  };

  const handleImport = async () => {
    if (!selectedCourse || selectedRecordings.size === 0) return;

    setImporting(true);
    try {
      // Build ordered list of recordings matching selection
      const orderedRecordings: { id: string; title: string }[] = [];
      selectedCourse.modules.forEach(mod => {
        mod.recordings.forEach(rec => {
          if (selectedRecordings.has(rec.id)) {
            orderedRecordings.push({ id: rec.id, title: rec.recording_title });
          }
        });
      });

      const items: TimelineItemFormData[] = orderedRecordings.map((rec, index) => ({
        type: 'RECORDING' as const,
        title: rec.title,
        recording_id: rec.id,
        drip_offset_days: baseDripOffset + (index * dripInterval),
        sequence_order: currentItemCount + index,
      }));

      await onImport(items);

      toast({
        title: 'Course Imported',
        description: `${items.length} recordings added to timeline from "${selectedCourse.title}"`,
      });

      onOpenChange(false);
      setSelectedCourseId(null);
      setSelectedRecordings(new Set());
    } catch (error) {
      toast({
        title: 'Import Failed',
        description: 'Failed to import course recordings',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  const totalAvailable = selectedCourse
    ? selectedCourse.modules.reduce((sum, mod) => 
        sum + mod.recordings.filter(r => !existingRecordingIds.includes(r.id)).length, 0)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Import Course Recordings
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : !selectedCourseId ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Select a course to import all its recordings into the timeline:</p>
            {courses.map(course => {
              const recCount = course.modules.reduce((sum, m) => sum + m.recordings.length, 0);
              const alreadyImported = course.modules.reduce((sum, m) => 
                sum + m.recordings.filter(r => existingRecordingIds.includes(r.id)).length, 0);

              return (
                <button
                  key={course.id}
                  onClick={() => handleSelectCourse(course.id)}
                  className="w-full text-left p-4 border rounded-lg hover:bg-muted/50 transition-colors flex items-center justify-between"
                >
                  <div>
                    <h4 className="font-medium">{course.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      {course.modules.length} modules • {recCount} recordings
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {alreadyImported > 0 && (
                      <Badge variant="secondary" className="text-xs">{alreadyImported} already added</Badge>
                    )}
                    <Badge>{recCount - alreadyImported} available</Badge>
                  </div>
                </button>
              );
            })}
            {courses.length === 0 && (
              <p className="text-center text-muted-foreground py-4">No courses with recordings found</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => { setSelectedCourseId(null); setSelectedRecordings(new Set()); }}>
                ← Back to courses
              </Button>
              <Badge variant="outline">{selectedRecordings.size} selected</Badge>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">Start from Day</Label>
                <Input
                  type="number"
                  min={0}
                  value={baseDripOffset}
                  onChange={e => setBaseDripOffset(parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label className="text-sm">Days between recordings</Label>
                <Input
                  type="number"
                  min={0}
                  value={dripInterval}
                  onChange={e => setDripInterval(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="border rounded-lg divide-y max-h-[40vh] overflow-y-auto">
              {selectedCourse?.modules.map(mod => (
                <div key={mod.id} className="p-3">
                  <h4 className="font-medium text-sm mb-2">{mod.title}</h4>
                  <div className="space-y-1.5 pl-2">
                    {mod.recordings.map(rec => {
                      const alreadyExists = existingRecordingIds.includes(rec.id);
                      return (
                        <div key={rec.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`import-${rec.id}`}
                            checked={selectedRecordings.has(rec.id)}
                            onCheckedChange={() => toggleRecording(rec.id)}
                            disabled={alreadyExists}
                          />
                          <Label
                            htmlFor={`import-${rec.id}`}
                            className={`text-sm cursor-pointer ${alreadyExists ? 'text-muted-foreground line-through' : ''}`}
                          >
                            {rec.recording_title}
                            {alreadyExists && <span className="text-xs ml-1">(already added)</span>}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-2 border-t">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => selectedCourse && selectAllFromCourse(selectedCourse)}>
                  Select All ({totalAvailable})
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSelectedRecordings(new Set())}>
                  Clear
                </Button>
              </div>
              <Button onClick={handleImport} disabled={importing || selectedRecordings.size === 0}>
                {importing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <Download className="w-4 h-4 mr-2" />
                Import {selectedRecordings.size} Recordings
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
