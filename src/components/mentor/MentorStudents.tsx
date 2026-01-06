import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, BookOpen, GraduationCap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

interface EnrolledStudent {
  student_id: string;
  student_name: string;
  student_batch: string | null;
  joining_date: string;
  lms_status: 'active' | 'inactive' | 'completed';
  enrollment_type: 'direct' | 'pathway';
  pathway_name?: string;
}

interface CourseWithStudents {
  course_id: string;
  course_title: string;
  students: EnrolledStudent[];
}

export const MentorStudents = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [coursesWithStudents, setCoursesWithStudents] = useState<CourseWithStudents[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);

  useEffect(() => {
    if (user) {
      fetchMentorStudents();
    }
  }, [user]);

  const fetchMentorStudents = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Get mentor's assigned courses
      const { data: mentorCourses, error: mentorError } = await supabase
        .from('mentor_course_assignments')
        .select('course_id, is_global, courses(id, title)')
        .eq('mentor_id', user.id);

      if (mentorError) {
        console.error('Error fetching mentor courses:', mentorError);
        setLoading(false);
        return;
      }

      const isGlobalMentor = mentorCourses?.some(mc => mc.is_global);
      const courseIds = mentorCourses?.map(mc => mc.course_id).filter(Boolean) || [];

      // Get pathway courses for mentor's assigned courses
      const { data: pathwayCourses } = await supabase
        .from('pathway_courses')
        .select('pathway_id, course_id, learning_pathways(id, name)')
        .in('course_id', courseIds);

      const pathwayIds = [...new Set(pathwayCourses?.map(pc => pc.pathway_id) || [])];

      // Fetch direct enrollments for mentor's courses
      let directEnrollmentsQuery = supabase
        .from('course_enrollments')
        .select(`
          id,
          course_id,
          enrolled_at,
          status,
          pathway_id,
          students!inner(
            id,
            student_id,
            user_id,
            enrollment_date,
            fees_cleared,
            goal_brief,
            users!inner(id, full_name)
          ),
          courses!inner(id, title)
        `)
        .is('pathway_id', null);

      if (!isGlobalMentor && courseIds.length > 0) {
        directEnrollmentsQuery = directEnrollmentsQuery.in('course_id', courseIds);
      }

      const { data: directEnrollments, error: directError } = await directEnrollmentsQuery;

      if (directError) {
        console.error('Error fetching direct enrollments:', directError);
      }

      // Fetch pathway enrollments
      let pathwayEnrollmentsQuery = supabase
        .from('course_enrollments')
        .select(`
          id,
          course_id,
          pathway_id,
          enrolled_at,
          status,
          students!inner(
            id,
            student_id,
            user_id,
            enrollment_date,
            fees_cleared,
            goal_brief,
            users!inner(id, full_name)
          ),
          courses!inner(id, title),
          learning_pathways(id, name)
        `)
        .not('pathway_id', 'is', null);

      if (!isGlobalMentor && courseIds.length > 0) {
        pathwayEnrollmentsQuery = pathwayEnrollmentsQuery.in('course_id', courseIds);
      }

      const { data: pathwayEnrollments, error: pathwayError } = await pathwayEnrollmentsQuery;

      if (pathwayError) {
        console.error('Error fetching pathway enrollments:', pathwayError);
      }

      // Group students by course
      const courseMap = new Map<string, CourseWithStudents>();
      const uniqueStudentIds = new Set<string>();

      // Process direct enrollments
      directEnrollments?.forEach(enrollment => {
        const courseId = enrollment.course_id;
        const courseTitle = enrollment.courses?.title || 'Unknown Course';
        
        if (!courseMap.has(courseId)) {
          courseMap.set(courseId, {
            course_id: courseId,
            course_title: courseTitle,
            students: []
          });
        }

        const student = enrollment.students;
        const studentKey = `${student.user_id}-${courseId}`;
        
        if (!uniqueStudentIds.has(studentKey)) {
          uniqueStudentIds.add(studentKey);
          
          // Extract batch from goal_brief or student_id prefix if available
          const batch = extractBatch(student.student_id, student.goal_brief);

          courseMap.get(courseId)!.students.push({
            student_id: student.student_id || student.id,
            student_name: student.users?.full_name || 'Unknown',
            student_batch: batch,
            joining_date: enrollment.enrolled_at || student.enrollment_date || '',
            lms_status: getLmsStatus(enrollment.status, student.fees_cleared),
            enrollment_type: 'direct'
          });
        }
      });

      // Process pathway enrollments
      pathwayEnrollments?.forEach(enrollment => {
        const courseId = enrollment.course_id;
        const courseTitle = enrollment.courses?.title || 'Unknown Course';
        
        if (!courseMap.has(courseId)) {
          courseMap.set(courseId, {
            course_id: courseId,
            course_title: courseTitle,
            students: []
          });
        }

        const student = enrollment.students;
        const studentKey = `${student.user_id}-${courseId}`;
        
        if (!uniqueStudentIds.has(studentKey)) {
          uniqueStudentIds.add(studentKey);
          
          // Extract batch from goal_brief or student_id prefix if available
          const batch = extractBatch(student.student_id, student.goal_brief);

          courseMap.get(courseId)!.students.push({
            student_id: student.student_id || student.id,
            student_name: student.users?.full_name || 'Unknown',
            student_batch: batch,
            joining_date: enrollment.enrolled_at || student.enrollment_date || '',
            lms_status: getLmsStatus(enrollment.status, student.fees_cleared),
            enrollment_type: 'pathway',
            pathway_name: enrollment.learning_pathways?.name
          });
        }
      });

      const coursesArray = Array.from(courseMap.values()).sort((a, b) => 
        a.course_title.localeCompare(b.course_title)
      );

      // Count unique students across all courses
      const allUniqueStudents = new Set<string>();
      coursesArray.forEach(course => {
        course.students.forEach(s => allUniqueStudents.add(s.student_id));
      });

      setCoursesWithStudents(coursesArray);
      setTotalStudents(allUniqueStudents.size);
    } catch (error) {
      console.error('Error fetching mentor students:', error);
    } finally {
      setLoading(false);
    }
  };

  // Extract batch info from student_id format (e.g., "B12-001") or goal_brief
  const extractBatch = (studentId: string | null, goalBrief: string | null): string | null => {
    if (studentId) {
      const match = studentId.match(/^([A-Z]+\d+)/i);
      if (match) return match[1];
    }
    return null;
  };

  const getLmsStatus = (enrollmentStatus: string | null, feesCleared: boolean | null): 'active' | 'inactive' | 'completed' => {
    if (enrollmentStatus === 'completed') return 'completed';
    if (enrollmentStatus === 'inactive' || feesCleared === false) return 'inactive';
    return 'active';
  };

  const getStatusBadge = (status: 'active' | 'inactive' | 'completed') => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>;
      case 'inactive':
        return <Badge variant="destructive">Inactive</Badge>;
      case 'completed':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Completed</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStudents}</div>
            <p className="text-xs text-muted-foreground">Across all your courses</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Courses Assigned</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{coursesWithStudents.length}</div>
            <p className="text-xs text-muted-foreground">You are mentoring</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Students</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {coursesWithStudents.reduce((acc, course) => 
                acc + course.students.filter(s => s.lms_status === 'active').length, 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">Currently learning</p>
          </CardContent>
        </Card>
      </div>

      {/* Course Tabs */}
      {coursesWithStudents.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No courses assigned yet. Contact an administrator to get course assignments.</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue={coursesWithStudents[0]?.course_id} className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1">
            {coursesWithStudents.map(course => (
              <TabsTrigger key={course.course_id} value={course.course_id} className="flex items-center gap-2">
                {course.course_title}
                <Badge variant="secondary" className="ml-1">{course.students.length}</Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          {coursesWithStudents.map(course => (
            <TabsContent key={course.course_id} value={course.course_id} className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>{course.course_title}</CardTitle>
                  <CardDescription>
                    {course.students.length} student{course.students.length !== 1 ? 's' : ''} enrolled
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {course.students.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No students enrolled in this course yet.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student ID</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Batch</TableHead>
                          <TableHead>Joining Date</TableHead>
                          <TableHead>LMS Status</TableHead>
                          <TableHead>Enrollment</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {course.students.map((student, idx) => (
                          <TableRow key={`${student.student_id}-${idx}`}>
                            <TableCell className="font-mono text-sm">{student.student_id}</TableCell>
                            <TableCell className="font-medium">{student.student_name}</TableCell>
                            <TableCell>{student.student_batch || '-'}</TableCell>
                            <TableCell>
                              {student.joining_date 
                                ? format(new Date(student.joining_date), 'MMM d, yyyy')
                                : '-'}
                            </TableCell>
                            <TableCell>{getStatusBadge(student.lms_status)}</TableCell>
                            <TableCell>
                              {student.enrollment_type === 'pathway' ? (
                                <Badge variant="outline" className="text-xs">
                                  via {student.pathway_name || 'Pathway'}
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">Direct</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
};
