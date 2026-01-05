import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, Route, Plus, Trash2, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Course {
  id: string;
  title: string;
  is_published: boolean;
  is_active: boolean;
  isPathwayOnly?: boolean; // True if course is only accessible via pathway
}

interface Pathway {
  id: string;
  name: string;
  is_published: boolean;
  is_active: boolean;
}

interface Enrollment {
  id: string;
  course_id: string | null;
  pathway_id: string | null;
  status: string;
  enrolled_at: string | null;
}

interface PathwayCourse {
  course_id: string;
  pathway_id: string;
}

interface StudentAccessManagementProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string; // This is the students.id (student_record_id)
  studentUserId: string; // This is the users.id
  studentName: string;
  onAccessUpdated?: () => void;
}

export function StudentAccessManagement({
  open,
  onOpenChange,
  studentId,
  studentUserId,
  studentName,
  onAccessUpdated
}: StudentAccessManagementProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [standaloneCourses, setStandaloneCourses] = useState<Course[]>([]); // Courses not in any pathway
  const [pathways, setPathways] = useState<Pathway[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set());
  const [selectedPathways, setSelectedPathways] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && studentId) {
      fetchData();
    }
  }, [open, studentId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [coursesRes, pathwaysRes, enrollmentsRes, pathwayCoursesRes] = await Promise.all([
        supabase.from('courses').select('id, title, is_published, is_active').eq('is_active', true).order('title'),
        supabase.from('learning_pathways').select('id, name, is_published, is_active').eq('is_active', true).order('name'),
        supabase.from('course_enrollments').select('*').eq('student_id', studentId),
        supabase.from('pathway_courses').select('course_id, pathway_id')
      ]);

      if (coursesRes.error) throw coursesRes.error;
      if (pathwaysRes.error) throw pathwaysRes.error;
      if (enrollmentsRes.error) throw enrollmentsRes.error;
      if (pathwayCoursesRes.error) throw pathwayCoursesRes.error;

      // Get set of course IDs that are part of any pathway
      const coursesInPathways = new Set(
        (pathwayCoursesRes.data || []).map(pc => pc.course_id)
      );

      // All courses
      const allCourses = coursesRes.data || [];
      setCourses(allCourses);

      // Filter to only standalone courses (not part of any pathway)
      const standalone = allCourses.filter(c => !coursesInPathways.has(c.id));
      setStandaloneCourses(standalone);

      setPathways(pathwaysRes.data || []);
      setEnrollments(enrollmentsRes.data || []);

      // Set selected based on current enrollments
      const enrolledCourseIds = new Set(
        (enrollmentsRes.data || [])
          .filter(e => e.course_id && e.status === 'active')
          .map(e => e.course_id as string)
      );
      const enrolledPathwayIds = new Set(
        (enrollmentsRes.data || [])
          .filter(e => e.pathway_id && e.status === 'active')
          .map(e => e.pathway_id as string)
      );

      setSelectedCourses(enrolledCourseIds);
      setSelectedPathways(enrolledPathwayIds);
    } catch (error) {
      console.error('Error fetching access data:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch access data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getEnrollmentForCourse = (courseId: string) => {
    return enrollments.find(e => e.course_id === courseId);
  };

  const getEnrollmentForPathway = (pathwayId: string) => {
    return enrollments.find(e => e.pathway_id === pathwayId);
  };

  const handleToggleCourse = async (courseId: string) => {
    const isCurrentlyEnrolled = selectedCourses.has(courseId);
    const enrollment = getEnrollmentForCourse(courseId);

    setSaving(true);
    try {
      if (isCurrentlyEnrolled && enrollment) {
        // Terminate access
        const { error } = await supabase
          .from('course_enrollments')
          .update({ status: 'inactive', updated_at: new Date().toISOString() })
          .eq('id', enrollment.id);
        if (error) throw error;

        setSelectedCourses(prev => {
          const next = new Set(prev);
          next.delete(courseId);
          return next;
        });
        toast({ title: 'Access Terminated', description: 'Course access has been removed' });
      } else if (!isCurrentlyEnrolled && enrollment) {
        // Reactivate existing enrollment
        const { error } = await supabase
          .from('course_enrollments')
          .update({ status: 'active', updated_at: new Date().toISOString() })
          .eq('id', enrollment.id);
        if (error) throw error;

        setSelectedCourses(prev => new Set(prev).add(courseId));
        toast({ title: 'Access Granted', description: 'Course access has been restored' });
      } else {
        // Create new enrollment
        const { error } = await supabase.from('course_enrollments').insert({
          student_id: studentId,
          course_id: courseId,
          status: 'active',
          progress_percentage: 0,
          enrolled_at: new Date().toISOString()
        });
        if (error) throw error;

        setSelectedCourses(prev => new Set(prev).add(courseId));
        toast({ title: 'Access Granted', description: 'Course access has been added' });
      }

      // Refresh enrollments
      const { data } = await supabase.from('course_enrollments').select('*').eq('student_id', studentId);
      setEnrollments(data || []);
      onAccessUpdated?.();
    } catch (error) {
      console.error('Error updating course access:', error);
      toast({ title: 'Error', description: 'Failed to update course access', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePathway = async (pathwayId: string) => {
    const isCurrentlyEnrolled = selectedPathways.has(pathwayId);
    const enrollment = getEnrollmentForPathway(pathwayId);

    setSaving(true);
    try {
      if (isCurrentlyEnrolled && enrollment) {
        // Terminate access
        const { error } = await supabase
          .from('course_enrollments')
          .update({ status: 'inactive', updated_at: new Date().toISOString() })
          .eq('id', enrollment.id);
        if (error) throw error;

        setSelectedPathways(prev => {
          const next = new Set(prev);
          next.delete(pathwayId);
          return next;
        });
        toast({ title: 'Access Terminated', description: 'Pathway access has been removed' });
      } else if (!isCurrentlyEnrolled && enrollment) {
        // Reactivate existing enrollment
        const { error } = await supabase
          .from('course_enrollments')
          .update({ status: 'active', updated_at: new Date().toISOString() })
          .eq('id', enrollment.id);
        if (error) throw error;

        setSelectedPathways(prev => new Set(prev).add(pathwayId));
        toast({ title: 'Access Granted', description: 'Pathway access has been restored' });
      } else {
        // Create new enrollment
        const { error } = await supabase.from('course_enrollments').insert({
          student_id: studentId,
          course_id: null as unknown as string,
          pathway_id: pathwayId,
          status: 'active',
          progress_percentage: 0,
          enrolled_at: new Date().toISOString()
        });
        if (error) throw error;

        setSelectedPathways(prev => new Set(prev).add(pathwayId));
        toast({ title: 'Access Granted', description: 'Pathway access has been added' });
      }

      // Refresh enrollments
      const { data } = await supabase.from('course_enrollments').select('*').eq('student_id', studentId);
      setEnrollments(data || []);
      onAccessUpdated?.();
    } catch (error) {
      console.error('Error updating pathway access:', error);
      toast({ title: 'Error', description: 'Failed to update pathway access', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleBulkAssignCourses = async () => {
    const unassignedCourses = standaloneCourses.filter(c => !selectedCourses.has(c.id));
    if (unassignedCourses.length === 0) {
      toast({ title: 'Info', description: 'All standalone courses are already assigned' });
      return;
    }

    setSaving(true);
    try {
      for (const course of unassignedCourses) {
        const { error } = await supabase.from('course_enrollments').insert({
          student_id: studentId,
          course_id: course.id,
          status: 'active',
          progress_percentage: 0,
          enrolled_at: new Date().toISOString()
        });
        if (error) throw error;
      }

      // Update selected to include all standalone courses
      setSelectedCourses(prev => {
        const next = new Set(prev);
        standaloneCourses.forEach(c => next.add(c.id));
        return next;
      });
      const { data } = await supabase.from('course_enrollments').select('*').eq('student_id', studentId);
      setEnrollments(data || []);
      onAccessUpdated?.();
      toast({ title: 'Success', description: `Assigned ${unassignedCourses.length} courses` });
    } catch (error) {
      console.error('Error bulk assigning courses:', error);
      toast({ title: 'Error', description: 'Failed to assign courses', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleBulkTerminateCourses = async () => {
    const enrolledCourseEnrollments = enrollments.filter(e => e.course_id && e.status === 'active');
    if (enrolledCourseEnrollments.length === 0) {
      toast({ title: 'Info', description: 'No active course enrollments to terminate' });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('course_enrollments')
        .update({ status: 'inactive', updated_at: new Date().toISOString() })
        .in('id', enrolledCourseEnrollments.map(e => e.id));
      if (error) throw error;

      setSelectedCourses(new Set());
      const { data } = await supabase.from('course_enrollments').select('*').eq('student_id', studentId);
      setEnrollments(data || []);
      onAccessUpdated?.();
      toast({ title: 'Success', description: 'All course access terminated' });
    } catch (error) {
      console.error('Error terminating courses:', error);
      toast({ title: 'Error', description: 'Failed to terminate access', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleBulkAssignPathways = async () => {
    const unassignedPathways = pathways.filter(p => !selectedPathways.has(p.id));
    if (unassignedPathways.length === 0) {
      toast({ title: 'Info', description: 'All pathways are already assigned' });
      return;
    }

    setSaving(true);
    try {
      for (const pathway of unassignedPathways) {
        const { error } = await supabase.from('course_enrollments').insert({
          student_id: studentId,
          course_id: null as unknown as string, // pathway-only enrollment
          pathway_id: pathway.id,
          status: 'active',
          progress_percentage: 0,
          enrolled_at: new Date().toISOString()
        });
        if (error) throw error;
      }

      setSelectedPathways(new Set(pathways.map(p => p.id)));
      const { data } = await supabase.from('course_enrollments').select('*').eq('student_id', studentId);
      setEnrollments(data || []);
      onAccessUpdated?.();
      toast({ title: 'Success', description: `Assigned ${unassignedPathways.length} pathways` });
    } catch (error) {
      console.error('Error bulk assigning pathways:', error);
      toast({ title: 'Error', description: 'Failed to assign pathways', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleBulkTerminatePathways = async () => {
    const enrolledPathwayEnrollments = enrollments.filter(e => e.pathway_id && e.status === 'active');
    if (enrolledPathwayEnrollments.length === 0) {
      toast({ title: 'Info', description: 'No active pathway enrollments to terminate' });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('course_enrollments')
        .update({ status: 'inactive', updated_at: new Date().toISOString() })
        .in('id', enrolledPathwayEnrollments.map(e => e.id));
      if (error) throw error;

      setSelectedPathways(new Set());
      const { data } = await supabase.from('course_enrollments').select('*').eq('student_id', studentId);
      setEnrollments(data || []);
      onAccessUpdated?.();
      toast({ title: 'Success', description: 'All pathway access terminated' });
    } catch (error) {
      console.error('Error terminating pathways:', error);
      toast({ title: 'Error', description: 'Failed to terminate access', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleBulkAssignAll = async () => {
    setSaving(true);
    try {
      const unassignedCourses = standaloneCourses.filter(c => !selectedCourses.has(c.id));
      const unassignedPathways = pathways.filter(p => !selectedPathways.has(p.id));

      // Insert standalone courses only
      for (const course of unassignedCourses) {
        const { error } = await supabase.from('course_enrollments').insert({
          student_id: studentId,
          course_id: course.id,
          status: 'active',
          progress_percentage: 0,
          enrolled_at: new Date().toISOString()
        });
        if (error) throw error;
      }

      // Insert pathways
      for (const pathway of unassignedPathways) {
        const { error } = await supabase.from('course_enrollments').insert({
          student_id: studentId,
          course_id: null as unknown as string,
          pathway_id: pathway.id,
          status: 'active',
          progress_percentage: 0,
          enrolled_at: new Date().toISOString()
        });
        if (error) throw error;
      }

      // Update selected to include all standalone courses and pathways
      setSelectedCourses(prev => {
        const next = new Set(prev);
        standaloneCourses.forEach(c => next.add(c.id));
        return next;
      });
      setSelectedPathways(new Set(pathways.map(p => p.id)));
      const { data } = await supabase.from('course_enrollments').select('*').eq('student_id', studentId);
      setEnrollments(data || []);
      onAccessUpdated?.();
      toast({ title: 'Success', description: 'All access granted' });
    } catch (error) {
      console.error('Error assigning all:', error);
      toast({ title: 'Error', description: 'Failed to grant access', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleBulkTerminateAll = async () => {
    const activeEnrollments = enrollments.filter(e => e.status === 'active');
    if (activeEnrollments.length === 0) {
      toast({ title: 'Info', description: 'No active enrollments to terminate' });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('course_enrollments')
        .update({ status: 'inactive', updated_at: new Date().toISOString() })
        .in('id', activeEnrollments.map(e => e.id));
      if (error) throw error;

      setSelectedCourses(new Set());
      setSelectedPathways(new Set());
      const { data } = await supabase.from('course_enrollments').select('*').eq('student_id', studentId);
      setEnrollments(data || []);
      onAccessUpdated?.();
      toast({ title: 'Success', description: 'All access terminated' });
    } catch (error) {
      console.error('Error terminating all:', error);
      toast({ title: 'Error', description: 'Failed to terminate access', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Manage Access - {studentName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Summary */}
            <div className="flex gap-4 mb-4">
              <Card className="flex-1">
                <CardContent className="p-4 flex items-center gap-3">
                  <BookOpen className="w-8 h-8 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold">{selectedCourses.size}</p>
                    <p className="text-sm text-muted-foreground">Active Courses</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="flex-1">
                <CardContent className="p-4 flex items-center gap-3">
                  <Route className="w-8 h-8 text-purple-500" />
                  <div>
                    <p className="text-2xl font-bold">{selectedPathways.size}</p>
                    <p className="text-sm text-muted-foreground">Active Pathways</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Bulk Actions */}
            <div className="flex gap-2 mb-4 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkAssignAll}
                disabled={saving}
                className="text-green-600 border-green-300 hover:bg-green-50"
              >
                <Plus className="w-4 h-4 mr-1" />
                Assign All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkTerminateAll}
                disabled={saving}
                className="text-red-600 border-red-300 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Terminate All
              </Button>
            </div>

            <Tabs defaultValue="courses" className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="courses" className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  Courses ({standaloneCourses.filter(c => selectedCourses.has(c.id)).length}/{standaloneCourses.length})
                </TabsTrigger>
                <TabsTrigger value="pathways" className="flex items-center gap-2">
                  <Route className="w-4 h-4" />
                  Pathways ({selectedPathways.size}/{pathways.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="courses" className="flex-1 overflow-hidden mt-4">
                <div className="flex gap-2 mb-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBulkAssignCourses}
                    disabled={saving}
                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Assign All Courses
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBulkTerminateCourses}
                    disabled={saving}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Terminate All Courses
                  </Button>
                </div>
                <ScrollArea className="h-[300px] border rounded-lg">
                  <div className="p-3 space-y-2">
                    {standaloneCourses.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">No standalone courses available. All courses are part of pathways.</p>
                    ) : (
                      standaloneCourses.map(course => {
                        const isEnrolled = selectedCourses.has(course.id);
                        return (
                          <div
                            key={course.id}
                            className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                              isEnrolled ? 'bg-green-50 border-green-200' : 'bg-muted/30 border-border'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={isEnrolled}
                                onCheckedChange={() => handleToggleCourse(course.id)}
                                disabled={saving}
                              />
                              <div>
                                <p className="font-medium">{course.title}</p>
                                <div className="flex gap-2 mt-1">
                                  {course.is_published ? (
                                    <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-200">Published</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-700 border-yellow-200">Draft</Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <Button
                              variant={isEnrolled ? "destructive" : "default"}
                              size="sm"
                              onClick={() => handleToggleCourse(course.id)}
                              disabled={saving}
                            >
                              {saving ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : isEnrolled ? (
                                <>
                                  <XCircle className="w-4 h-4 mr-1" />
                                  Revoke
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Grant
                                </>
                              )}
                            </Button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="pathways" className="flex-1 overflow-hidden mt-4">
                <div className="flex gap-2 mb-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBulkAssignPathways}
                    disabled={saving}
                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Assign All Pathways
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBulkTerminatePathways}
                    disabled={saving}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Terminate All Pathways
                  </Button>
                </div>
                <ScrollArea className="h-[300px] border rounded-lg">
                  <div className="p-3 space-y-2">
                    {pathways.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">No pathways available</p>
                    ) : (
                      pathways.map(pathway => {
                        const isEnrolled = selectedPathways.has(pathway.id);
                        return (
                          <div
                            key={pathway.id}
                            className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                              isEnrolled ? 'bg-purple-50 border-purple-200' : 'bg-muted/30 border-border'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={isEnrolled}
                                onCheckedChange={() => handleTogglePathway(pathway.id)}
                                disabled={saving}
                              />
                              <div>
                                <p className="font-medium">{pathway.name}</p>
                                <div className="flex gap-2 mt-1">
                                  {pathway.is_published ? (
                                    <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-200">Published</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-700 border-yellow-200">Draft</Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <Button
                              variant={isEnrolled ? "destructive" : "default"}
                              size="sm"
                              onClick={() => handleTogglePathway(pathway.id)}
                              disabled={saving}
                            >
                              {saving ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : isEnrolled ? (
                                <>
                                  <XCircle className="w-4 h-4 mr-1" />
                                  Revoke
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Grant
                                </>
                              )}
                            </Button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
