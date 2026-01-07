import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  Lock, Unlock, Calendar, BookOpen, ChevronRight, ChevronDown,
  Video, FileText, FolderOpen, Play
} from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface Course {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  is_published: boolean;
  is_active: boolean;
  price: number | null;
  access_duration_days: number | null;
}

interface Enrollment {
  id: string;
  course_id: string;
  status: string;
  enrolled_at: string | null;
  access_expires_at: string | null;
}

interface Module {
  id: string;
  title: string;
  description: string | null;
  order: number | null;
  course_id: string | null;
}

interface Recording {
  id: string;
  recording_title: string | null;
  module: string | null;
  sequence_order: number | null;
}

interface Assignment {
  id: string;
  name: string;
  course_id: string | null;
}

const Catalog = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user?.id) {
      fetchData();
    }
  }, [user?.id]);

  const fetchData = async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      // Fetch student record to get student_id
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (studentError) throw studentError;
      
      const currentStudentId = studentData?.id || null;
      setStudentId(currentStudentId);

      // Fetch all active courses
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select('id, title, description, thumbnail_url, is_published, is_active, price, access_duration_days')
        .eq('is_active', true)
        .order('sequence_order', { ascending: true });

      if (coursesError) throw coursesError;
      setCourses(coursesData || []);

      // Fetch all modules
      const { data: modulesData, error: modulesError } = await supabase
        .from('modules')
        .select('id, title, description, order, course_id')
        .order('order', { ascending: true });

      if (modulesError) throw modulesError;
      setModules(modulesData || []);

      // Fetch all recordings
      const { data: recordingsData, error: recordingsError } = await supabase
        .from('available_lessons')
        .select('id, recording_title, module, sequence_order')
        .order('sequence_order', { ascending: true });

      if (recordingsError) throw recordingsError;
      setRecordings(recordingsData || []);

      // Fetch all assignments
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('assignments')
        .select('id, name, course_id')
        .order('name', { ascending: true });

      if (assignmentsError) throw assignmentsError;
      setAssignments(assignmentsData || []);

      // Fetch user's enrollments if they have a student record
      if (currentStudentId) {
        const { data: enrollmentsData, error: enrollmentsError } = await supabase
          .from('course_enrollments')
          .select('id, course_id, status, enrolled_at, access_expires_at')
          .eq('student_id', currentStudentId)
          .eq('status', 'active');

        if (enrollmentsError) throw enrollmentsError;
        setEnrollments(enrollmentsData || []);
      }
    } catch (error) {
      console.error('Error fetching catalog data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEnrollment = (courseId: string) => {
    return enrollments.find(e => e.course_id === courseId);
  };

  const isUnlocked = (courseId: string) => {
    const enrollment = getEnrollment(courseId);
    if (!enrollment) return false;
    
    // Check if access has expired
    if (enrollment.access_expires_at) {
      const expiryDate = new Date(enrollment.access_expires_at);
      if (expiryDate < new Date()) return false;
    }
    
    return enrollment.status === 'active';
  };

  const getAccessExpiry = (courseId: string) => {
    const enrollment = getEnrollment(courseId);
    if (!enrollment?.access_expires_at) return null;
    return new Date(enrollment.access_expires_at);
  };

  const getCourseModules = (courseId: string) => {
    return modules.filter(m => m.course_id === courseId);
  };

  const getModuleRecordings = (moduleId: string) => {
    return recordings.filter(r => r.module === moduleId);
  };

  const getCourseAssignments = (courseId: string) => {
    return assignments.filter(a => a.course_id === courseId);
  };

  const toggleCourse = (courseId: string) => {
    setExpandedCourses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(courseId)) {
        newSet.delete(courseId);
      } else {
        newSet.add(courseId);
      }
      return newSet;
    });
  };

  const toggleModule = (moduleId: string) => {
    setExpandedModules(prev => {
      const newSet = new Set(prev);
      if (newSet.has(moduleId)) {
        newSet.delete(moduleId);
      } else {
        newSet.add(moduleId);
      }
      return newSet;
    });
  };

  const handleVideoClick = (recordingId: string, unlocked: boolean) => {
    if (unlocked) {
      navigate(`/video/${recordingId}`);
    }
  };

  const handleAssignmentClick = (assignmentId: string, unlocked: boolean) => {
    if (unlocked) {
      navigate('/assignments');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Course Catalog</h1>
          <p className="text-muted-foreground mt-1">Browse all available courses</p>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const unlockedCourses = courses.filter(c => isUnlocked(c.id));
  const lockedCourses = courses.filter(c => !isUnlocked(c.id));

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Course Catalog</h1>
        <p className="text-muted-foreground mt-1">
          Browse all available courses • {unlockedCourses.length} unlocked, {lockedCourses.length} locked
        </p>
      </div>

      {courses.length === 0 ? (
        <Card className="p-8 text-center">
          <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No Courses Available</h3>
          <p className="text-muted-foreground">
            There are no courses available at the moment. Please check back later.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {/* Show unlocked courses first, then locked ones */}
          {[...unlockedCourses, ...lockedCourses].map((course) => {
            const unlocked = isUnlocked(course.id);
            const expiryDate = getAccessExpiry(course.id);
            const isExpiringSoon = expiryDate && 
              (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24) <= 7;
            const courseModules = getCourseModules(course.id);
            const courseAssignments = getCourseAssignments(course.id);
            const isExpanded = expandedCourses.has(course.id);

            return (
              <Card 
                key={course.id} 
                className={`overflow-hidden transition-all duration-200 ${
                  unlocked 
                    ? 'border-primary/20' 
                    : 'opacity-75'
                }`}
              >
                <Collapsible open={isExpanded} onOpenChange={() => unlocked && toggleCourse(course.id)}>
                  <CollapsibleTrigger asChild>
                    <div 
                      className={`flex items-center justify-between p-4 ${
                        unlocked ? 'cursor-pointer hover:bg-muted/50' : 'cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`p-2 rounded-lg ${
                          unlocked 
                            ? 'bg-green-500/10 text-green-600' 
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {unlocked ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground truncate">
                              {course.title}
                            </h3>
                            {unlocked && (
                              <Badge variant="outline" className="text-green-600 border-green-600/30 shrink-0">
                                Unlocked
                              </Badge>
                            )}
                          </div>
                          
                          {unlocked && expiryDate && (
                            <div className={`flex items-center text-xs mt-1 ${
                              isExpiringSoon ? 'text-orange-600' : 'text-muted-foreground'
                            }`}>
                              <Calendar className="w-3 h-3 mr-1" />
                              Access until {format(expiryDate, 'MMM d, yyyy')}
                            </div>
                          )}
                          
                          {!unlocked && (
                            <p className="text-sm text-muted-foreground">
                              Contact admin to unlock this course
                            </p>
                          )}
                        </div>
                      </div>

                      {unlocked && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <span className="text-xs">
                            {courseModules.length} modules
                          </span>
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5" />
                          ) : (
                            <ChevronRight className="w-5 h-5" />
                          )}
                        </div>
                      )}
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="border-t border-border">
                      {/* Modules Section */}
                      {courseModules.length > 0 && (
                        <div className="p-2">
                          {courseModules.map((module) => {
                            const moduleRecordings = getModuleRecordings(module.id);
                            const isModuleExpanded = expandedModules.has(module.id);

                            return (
                              <Collapsible 
                                key={module.id} 
                                open={isModuleExpanded} 
                                onOpenChange={() => toggleModule(module.id)}
                              >
                                <CollapsibleTrigger asChild>
                                  <div className="flex items-center justify-between p-3 ml-4 rounded-lg hover:bg-muted/50 cursor-pointer">
                                    <div className="flex items-center gap-2">
                                      <FolderOpen className="w-4 h-4 text-primary" />
                                      <span className="font-medium text-sm">{module.title}</span>
                                      <Badge variant="secondary" className="text-xs">
                                        {moduleRecordings.length} videos
                                      </Badge>
                                    </div>
                                    {isModuleExpanded ? (
                                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                    )}
                                  </div>
                                </CollapsibleTrigger>

                                <CollapsibleContent>
                                  <div className="ml-8 space-y-1 pb-2">
                                    {/* Videos */}
                                    {moduleRecordings.map((recording) => (
                                      <div
                                        key={recording.id}
                                        onClick={() => handleVideoClick(recording.id, unlocked)}
                                        className="flex items-center gap-2 p-2 pl-4 rounded-md hover:bg-muted/50 cursor-pointer group"
                                      >
                                        <Video className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary" />
                                        <span className="text-sm text-muted-foreground group-hover:text-foreground truncate">
                                          {recording.recording_title || 'Untitled Video'}
                                        </span>
                                        <Play className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 text-primary" />
                                      </div>
                                    ))}
                                    
                                    {moduleRecordings.length === 0 && (
                                      <p className="text-xs text-muted-foreground pl-4 py-2">
                                        No videos in this module
                                      </p>
                                    )}
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            );
                          })}
                        </div>
                      )}

                      {/* Assignments Section */}
                      {courseAssignments.length > 0 && (
                        <div className="border-t border-border p-2">
                          <div className="p-3 ml-4">
                            <div className="flex items-center gap-2 mb-2">
                              <FileText className="w-4 h-4 text-orange-500" />
                              <span className="font-medium text-sm">Assignments</span>
                              <Badge variant="secondary" className="text-xs">
                                {courseAssignments.length}
                              </Badge>
                            </div>
                            <div className="ml-6 space-y-1">
                              {courseAssignments.map((assignment) => (
                                <div
                                  key={assignment.id}
                                  onClick={() => handleAssignmentClick(assignment.id, unlocked)}
                                  className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer group"
                                >
                                  <FileText className="w-3.5 h-3.5 text-muted-foreground group-hover:text-orange-500" />
                                  <span className="text-sm text-muted-foreground group-hover:text-foreground truncate">
                                    {assignment.name}
                                  </span>
                                  <ChevronRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 text-primary" />
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {courseModules.length === 0 && courseAssignments.length === 0 && (
                        <div className="p-4 text-center text-muted-foreground text-sm">
                          No content available for this course yet
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Catalog;
