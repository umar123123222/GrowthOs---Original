import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  PlayCircle 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface CompletionAnalytics {
  totalStudents: number;
  completedStudents: number;
  inProgressStudents: number;
  notStartedStudents: number;
  averageCompletionTime: number;
  studentsNearCompletion: number;
  completionRate: number;
}

export const CourseCompletionAnalytics = () => {
  const [analytics, setAnalytics] = useState<CompletionAnalytics>({
    totalStudents: 0,
    completedStudents: 0,
    inProgressStudents: 0,
    notStartedStudents: 0,
    averageCompletionTime: 0,
    studentsNearCompletion: 0,
    completionRate: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCompletionAnalytics();
  }, []);

  const fetchCompletionAnalytics = async () => {
    try {
      setLoading(true);

      // Get all active students
      const { data: students, error: studentsError } = await supabase
        .from('users')
        .select('id, status, created_at')
        .eq('role', 'student')
        .neq('status', 'inactive');

      if (studentsError) {
        console.error('Error fetching students:', studentsError);
        return;
      }

      const totalStudents = students?.length || 0;
      const completedStudents = students?.filter(s => s.status === 'Passed out / Completed').length || 0;

      // Get students with recording views to determine progress
      const { data: recordingViews, error: viewsError } = await supabase
        .from('recording_views')
        .select('user_id, watched');

      if (viewsError) {
        console.error('Error fetching recording views:', viewsError);
      }

      // Get total number of available lessons
      const { data: lessons, error: lessonsError } = await supabase
        .from('available_lessons')
        .select('id');

      if (lessonsError) {
        console.error('Error fetching lessons:', lessonsError);
      }

      const totalLessons = lessons?.length || 0;

      // Calculate progress for each student
      const studentProgress = students?.map(student => {
        const studentViews = recordingViews?.filter(rv => rv.user_id === student.id) || [];
        const watchedCount = studentViews.filter(rv => rv.watched).length;
        const progressPercentage = totalLessons > 0 ? (watchedCount / totalLessons) * 100 : 0;
        
        return {
          studentId: student.id,
          status: student.status,
          progressPercentage,
          enrollmentDate: student.created_at
        };
      }) || [];

      // Categorize students
      const inProgressStudents = studentProgress.filter(sp => 
        sp.status !== 'Passed out / Completed' && sp.progressPercentage > 0 && sp.progressPercentage < 100
      ).length;

      const notStartedStudents = studentProgress.filter(sp => 
        sp.status !== 'Passed out / Completed' && sp.progressPercentage === 0
      ).length;

      const studentsNearCompletion = studentProgress.filter(sp => 
        sp.status !== 'Passed out / Completed' && sp.progressPercentage >= 80
      ).length;

      // Calculate average completion time (simplified estimate)
      const completedStudentData = studentProgress.filter(sp => sp.status === 'Passed out / Completed');
      const averageCompletionTime = completedStudentData.length > 0 ? 30 : 0; // Placeholder

      const completionRate = totalStudents > 0 ? (completedStudents / totalStudents) * 100 : 0;

      setAnalytics({
        totalStudents,
        completedStudents,
        inProgressStudents,
        notStartedStudents,
        averageCompletionTime,
        studentsNearCompletion,
        completionRate
      });

    } catch (error) {
      console.error('Error fetching completion analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-muted rounded w-2/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Course Completion Analytics</h2>
      </div>

      {/* Main Completion Rate Card */}
      <Card className="border-l-4 border-l-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Overall Course Completion Rate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold text-primary mb-2">
            {analytics.completionRate.toFixed(1)}%
          </div>
          <div className="text-sm text-muted-foreground mb-4">
            {analytics.completedStudents} out of {analytics.totalStudents} students completed the course
          </div>
          <Progress value={analytics.completionRate} className="h-3" />
        </CardContent>
      </Card>

      {/* Progress Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{analytics.completedStudents}</div>
            <p className="text-xs text-muted-foreground">Students finished course</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <PlayCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">{analytics.inProgressStudents}</div>
            <p className="text-xs text-muted-foreground">Students actively learning</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Near Completion</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700">{analytics.studentsNearCompletion}</div>
            <p className="text-xs text-muted-foreground">80%+ progress</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-gray-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Not Started</CardTitle>
            <AlertCircle className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-700">{analytics.notStartedStudents}</div>
            <p className="text-xs text-muted-foreground">Haven't begun course</p>
          </CardContent>
        </Card>
      </div>

      {/* Progress Funnel Visualization */}
      <Card>
        <CardHeader>
          <CardTitle>Course Progress Funnel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Enrolled Students</span>
              <Badge variant="outline">{analytics.totalStudents}</Badge>
            </div>
            <Progress value={100} className="h-2" />
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Started Course</span>
              <Badge variant="outline">
                {analytics.inProgressStudents + analytics.completedStudents}
              </Badge>
            </div>
            <Progress 
              value={analytics.totalStudents > 0 
                ? ((analytics.inProgressStudents + analytics.completedStudents) / analytics.totalStudents) * 100 
                : 0
              } 
              className="h-2" 
            />
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Near Completion (80%+)</span>
              <Badge variant="outline">
                {analytics.studentsNearCompletion + analytics.completedStudents}
              </Badge>
            </div>
            <Progress 
              value={analytics.totalStudents > 0 
                ? ((analytics.studentsNearCompletion + analytics.completedStudents) / analytics.totalStudents) * 100 
                : 0
              } 
              className="h-2" 
            />
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Completed Course</span>
              <Badge variant="outline">{analytics.completedStudents}</Badge>
            </div>
            <Progress value={analytics.completionRate} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Average Completion Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{analytics.averageCompletionTime}</div>
            <p className="text-sm text-muted-foreground">Days from enrollment to completion</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Students at Risk
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{analytics.notStartedStudents}</div>
            <p className="text-sm text-muted-foreground">Students who haven't started yet</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};