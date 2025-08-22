import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { Play, CheckCircle, Clock, FileText, Target, TrendingUp, Users, Video } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface StudentAnalytics {
  id: string;
  full_name: string;
  email: string;
  status: string;
  enrollment_date: string;
  videos_watched: number;
  videos_total: number;
  assignments_completed: number;
  assignments_total: number;
  last_activity: string;
  progress_percentage: number;
  current_module?: string;
}

interface OverviewStats {
  total_students: number;
  active_students: number;
  avg_progress: number;
  total_completions: number;
  videos_watched_today: number;
  assignments_submitted_today: number;
}

export const StudentAnalytics = () => {
  const [students, setStudents] = useState<StudentAnalytics[]>([]);
  const [overviewStats, setOverviewStats] = useState<OverviewStats>({
    total_students: 0,
    active_students: 0,
    avg_progress: 0,
    total_completions: 0,
    videos_watched_today: 0,
    assignments_submitted_today: 0
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      
      // Fetch students with their progress data
      const { data: studentsData, error: studentsError } = await supabase
        .from('users')
        .select(`
          id,
          full_name,
          email,
          status,
          created_at,
          students!inner(
            enrollment_date,
            onboarding_completed
          )
        `)
        .eq('role', 'student');

      if (studentsError) throw studentsError;

      // Fetch recording views for each student
      const { data: recordingViews, error: viewsError } = await supabase
        .from('recording_views')
        .select('user_id, recording_id, watched, watched_at');

      if (viewsError) throw viewsError;

      // Fetch total available recordings
      const { data: totalRecordings, error: recordingsError } = await supabase
        .from('available_lessons')
        .select('id');

      if (recordingsError) throw recordingsError;

      // Fetch assignments data
      const { data: assignments, error: assignmentsError } = await supabase
        .from('assignments')
        .select('id');

      if (assignmentsError) throw assignmentsError;

      // Fetch submissions for each student
      const { data: submissions, error: submissionsError } = await supabase
        .from('submissions')
        .select('student_id, assignment_id, status, submitted_at');

      if (submissionsError) throw submissionsError;

      // Fetch recent activity
      const { data: recentActivity, error: activityError } = await supabase
        .from('user_activity_logs')
        .select('user_id, created_at')
        .order('created_at', { ascending: false });

      if (activityError) throw activityError;

      // Process student analytics
      const processedStudents = studentsData?.map(student => {
        const studentViews = recordingViews?.filter(view => view.user_id === student.id) || [];
        const watchedVideos = studentViews.filter(view => view.watched).length;
        
        const studentSubmissions = submissions?.filter(sub => sub.student_id === student.id) || [];
        const completedAssignments = studentSubmissions.filter(sub => sub.status === 'approved').length;
        
        const lastActivity = recentActivity?.find(activity => activity.user_id === student.id);
        
        const progress = Math.round(
          ((watchedVideos / (totalRecordings?.length || 1)) * 0.6 + 
           (completedAssignments / (assignments?.length || 1)) * 0.4) * 100
        );

        return {
          id: student.id,
          full_name: student.full_name || 'Unknown',
          email: student.email || '',
          status: student.status || 'active',
          enrollment_date: student.students?.[0]?.enrollment_date || student.created_at,
          videos_watched: watchedVideos,
          videos_total: totalRecordings?.length || 0,
          assignments_completed: completedAssignments,
          assignments_total: assignments?.length || 0,
          last_activity: lastActivity?.created_at || 'Never',
          progress_percentage: progress,
          current_module: 'Module 1' // This would need proper module tracking
        };
      }) || [];

      // Calculate overview stats
      const today = new Date().toISOString().split('T')[0];
      const todayViews = recordingViews?.filter(view => 
        view.watched_at && view.watched_at.startsWith(today)
      ).length || 0;
      
      const todaySubmissions = submissions?.filter(sub => 
        sub.submitted_at && sub.submitted_at.startsWith(today)
      ).length || 0;

      const stats: OverviewStats = {
        total_students: processedStudents.length,
        active_students: processedStudents.filter(s => s.status === 'active').length,
        avg_progress: Math.round(processedStudents.reduce((acc, s) => acc + s.progress_percentage, 0) / processedStudents.length) || 0,
        total_completions: processedStudents.filter(s => s.progress_percentage >= 100).length,
        videos_watched_today: todayViews,
        assignments_submitted_today: todaySubmissions
      };

      setStudents(processedStudents);
      setOverviewStats(stats);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast({
        title: "Error",
        description: "Failed to load student analytics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Student Analytics</h1>
        <p className="text-gray-600 mt-2">Comprehensive overview of student progress and engagement</p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
              <Users className="w-4 h-4 mr-2" />
              Total Students
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{overviewStats.total_students}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
              <TrendingUp className="w-4 h-4 mr-2" />
              Active Students
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{overviewStats.active_students}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
              <Target className="w-4 h-4 mr-2" />
              Avg Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{overviewStats.avg_progress}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
              <CheckCircle className="w-4 h-4 mr-2" />
              Completions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{overviewStats.total_completions}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
              <Video className="w-4 h-4 mr-2" />
              Videos Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{overviewStats.videos_watched_today}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
              <FileText className="w-4 h-4 mr-2" />
              Submissions Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-600">{overviewStats.assignments_submitted_today}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="progress">Progress Details</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {students.slice(0, 10).map((student) => (
              <Card key={student.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center space-x-3">
                    <Avatar>
                      <AvatarFallback>{student.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <CardTitle className="text-lg">{student.full_name}</CardTitle>
                      <p className="text-sm text-gray-500">{student.email}</p>
                    </div>
                    <Badge variant={student.status === 'active' ? 'default' : 'secondary'}>
                      {student.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Overall Progress</span>
                      <span>{student.progress_percentage}%</span>
                    </div>
                    <Progress value={student.progress_percentage} className="h-2" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <Play className="w-4 h-4 text-blue-500" />
                      <span>{student.videos_watched}/{student.videos_total} Videos</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <FileText className="w-4 h-4 text-green-500" />
                      <span>{student.assignments_completed}/{student.assignments_total} Assignments</span>
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-500">
                    <Clock className="w-3 h-3 inline mr-1" />
                    Last active: {new Date(student.last_activity).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="progress" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Detailed Progress Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {students.map((student) => (
                  <div key={student.id} className="flex items-center space-x-4 p-3 border rounded-lg">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback>{student.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="font-medium">{student.full_name}</div>
                      <div className="text-sm text-gray-500">
                        Videos: {student.videos_watched}/{student.videos_total} | 
                        Assignments: {student.assignments_completed}/{student.assignments_total}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">{student.progress_percentage}%</div>
                      <Progress value={student.progress_percentage} className="w-20 h-2" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="engagement" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Most Active Students</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {students
                    .sort((a, b) => new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime())
                    .slice(0, 5)
                    .map((student, index) => (
                      <div key={student.id} className="flex items-center space-x-3">
                        <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">
                          {index + 1}
                        </div>
                        <Avatar className="w-8 h-8">
                          <AvatarFallback>{student.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="font-medium text-sm">{student.full_name}</div>
                          <div className="text-xs text-gray-500">
                            {new Date(student.last_activity).toLocaleDateString()}
                          </div>
                        </div>
                        <Badge variant="outline">{student.progress_percentage}%</Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Completion Leaders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {students
                    .sort((a, b) => b.progress_percentage - a.progress_percentage)
                    .slice(0, 5)
                    .map((student, index) => (
                      <div key={student.id} className="flex items-center space-x-3">
                        <div className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-bold">
                          {index + 1}
                        </div>
                        <Avatar className="w-8 h-8">
                          <AvatarFallback>{student.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="font-medium text-sm">{student.full_name}</div>
                          <div className="text-xs text-gray-500">
                            {student.videos_watched} videos, {student.assignments_completed} assignments
                          </div>
                        </div>
                        <Badge variant={student.progress_percentage >= 100 ? "default" : "secondary"}>
                          {student.progress_percentage}%
                        </Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};