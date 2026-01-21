import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Users, BookOpen, GraduationCap, Search, CalendarIcon, X, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, isWithinInterval, parseISO } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';

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
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('all');
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedLmsStatus, setSelectedLmsStatus] = useState<string>('all');
  const [selectedEnrollmentType, setSelectedEnrollmentType] = useState<string>('all');

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
          batch_id,
          batches(id, name),
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
          batch_id,
          batches(id, name),
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
          
          // Get batch name from the batches relation
          const batchName = enrollment.batches?.name || null;

          courseMap.get(courseId)!.students.push({
            student_id: student.student_id || student.id,
            student_name: student.users?.full_name || 'Unknown',
            student_batch: batchName,
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
          
          // Get batch name from the batches relation
          const batchName = enrollment.batches?.name || null;

          courseMap.get(courseId)!.students.push({
            student_id: student.student_id || student.id,
            student_name: student.users?.full_name || 'Unknown',
            student_batch: batchName,
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

  // Extract unique batches from all students
  const availableBatches = useMemo(() => {
    const batches = new Set<string>();
    coursesWithStudents.forEach(course => {
      course.students.forEach(s => {
        if (s.student_batch) batches.add(s.student_batch);
      });
    });
    return Array.from(batches).sort();
  }, [coursesWithStudents]);

  // Filter courses based on selection
  const filteredCourses = useMemo(() => {
    if (selectedCourseId === 'all') {
      return coursesWithStudents;
    }
    return coursesWithStudents.filter(c => c.course_id === selectedCourseId);
  }, [coursesWithStudents, selectedCourseId]);

  // Apply all filters to get filtered students per course
  const filteredCoursesWithStudents = useMemo(() => {
    return filteredCourses.map(course => {
      let students = [...course.students];

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        students = students.filter(s => 
          s.student_name.toLowerCase().includes(query) ||
          s.student_id.toLowerCase().includes(query)
        );
      }

      // Batch filter (multi-select)
      if (selectedBatches.length > 0) {
        students = students.filter(s => 
          s.student_batch ? selectedBatches.includes(s.student_batch) : false
        );
      }

      // Date range filter
      if (dateRange?.from) {
        students = students.filter(s => {
          if (!s.joining_date) return false;
          const joinDate = parseISO(s.joining_date);
          if (dateRange.to) {
            return isWithinInterval(joinDate, { start: dateRange.from!, end: dateRange.to });
          }
          return joinDate >= dateRange.from!;
        });
      }

      // LMS status filter
      if (selectedLmsStatus !== 'all') {
        students = students.filter(s => s.lms_status === selectedLmsStatus);
      }

      // Enrollment type filter
      if (selectedEnrollmentType !== 'all') {
        students = students.filter(s => s.enrollment_type === selectedEnrollmentType);
      }

      return { ...course, students };
    }).filter(course => course.students.length > 0);
  }, [filteredCourses, searchQuery, selectedBatches, dateRange, selectedLmsStatus, selectedEnrollmentType]);

  // Calculate stats based on filtered courses
  const filteredTotalStudents = useMemo(() => {
    const uniqueStudentIds = new Set<string>();
    filteredCoursesWithStudents.forEach(course => {
      course.students.forEach(s => uniqueStudentIds.add(s.student_id));
    });
    return uniqueStudentIds.size;
  }, [filteredCoursesWithStudents]);

  const filteredActiveStudents = useMemo(() => {
    return filteredCoursesWithStudents.reduce((acc, course) => 
      acc + course.students.filter(s => s.lms_status === 'active').length, 0
    );
  }, [filteredCoursesWithStudents]);

  const handleBatchToggle = (batch: string) => {
    setSelectedBatches(prev => 
      prev.includes(batch) 
        ? prev.filter(b => b !== batch)
        : [...prev, batch]
    );
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedCourseId('all');
    setSelectedBatches([]);
    setDateRange(undefined);
    setSelectedLmsStatus('all');
    setSelectedEnrollmentType('all');
  };

  const hasActiveFilters = searchQuery || selectedCourseId !== 'all' || selectedBatches.length > 0 || 
    dateRange?.from || selectedLmsStatus !== 'all' || selectedEnrollmentType !== 'all';

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
      {/* Filter Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* First Row: Search and Course */}
          <div className="flex flex-wrap gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or student ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Course Filter */}
            <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Courses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {coursesWithStudents.map((course) => (
                  <SelectItem key={course.course_id} value={course.course_id}>
                    {course.course_title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Second Row: Other Filters */}
          <div className="flex flex-wrap gap-3">
            {/* Batch Multi-Select */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="min-w-[150px] justify-start">
                  {selectedBatches.length > 0 ? (
                    <span className="truncate">
                      {selectedBatches.length} batch{selectedBatches.length > 1 ? 'es' : ''} selected
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Select Batches</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-2" align="start">
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {availableBatches.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-2">No batches available</p>
                  ) : (
                    availableBatches.map((batch) => (
                      <div key={batch} className="flex items-center space-x-2">
                        <Checkbox
                          id={`batch-${batch}`}
                          checked={selectedBatches.includes(batch)}
                          onCheckedChange={() => handleBatchToggle(batch)}
                        />
                        <label
                          htmlFor={`batch-${batch}`}
                          className="text-sm cursor-pointer flex-1"
                        >
                          {batch}
                        </label>
                      </div>
                    ))
                  )}
                </div>
                {selectedBatches.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => setSelectedBatches([])}
                  >
                    Clear
                  </Button>
                )}
              </PopoverContent>
            </Popover>

            {/* Date Range Picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "min-w-[200px] justify-start text-left font-normal",
                    !dateRange?.from && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "MMM d")} - {format(dateRange.to, "MMM d, yyyy")}
                      </>
                    ) : (
                      format(dateRange.from, "MMM d, yyyy")
                    )
                  ) : (
                    <span>Joining Date Range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                />
                {dateRange?.from && (
                  <div className="p-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => setDateRange(undefined)}
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>

            {/* LMS Status */}
            <Select value={selectedLmsStatus} onValueChange={setSelectedLmsStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="LMS Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>

            {/* Enrollment Type */}
            <Select value={selectedEnrollmentType} onValueChange={setSelectedEnrollmentType}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Enrollment Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="direct">Direct</SelectItem>
                <SelectItem value="pathway">Pathway</SelectItem>
              </SelectContent>
            </Select>

            {/* Clear All Button */}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-muted-foreground">
                <X className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredTotalStudents}</div>
            <p className="text-xs text-muted-foreground">
              {hasActiveFilters ? 'Matching filters' : 'Across all your courses'}
            </p>
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
            <div className="text-2xl font-bold">{filteredActiveStudents}</div>
            <p className="text-xs text-muted-foreground">Currently learning</p>
          </CardContent>
        </Card>
      </div>

      {/* Student List */}
      {coursesWithStudents.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No courses assigned yet. Contact an administrator to get course assignments.</p>
          </CardContent>
        </Card>
      ) : filteredCoursesWithStudents.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No students match your filters.</p>
            <Button variant="link" onClick={clearAllFilters}>Clear all filters</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredCoursesWithStudents.map(course => (
            <Card key={course.course_id}>
              <CardHeader>
                <CardTitle>{course.course_title}</CardTitle>
                <CardDescription>
                  {course.students.length} student{course.students.length !== 1 ? 's' : ''} {hasActiveFilters ? 'matching' : 'enrolled'}
                </CardDescription>
              </CardHeader>
              <CardContent>
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
                        <TableCell>
                          {student.student_batch ? (
                            <Badge variant="outline">{student.student_batch}</Badge>
                          ) : (
                            <span className="text-muted-foreground">No Batch</span>
                          )}
                        </TableCell>
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
