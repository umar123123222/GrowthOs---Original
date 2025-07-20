
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RoleGuard } from '@/components/RoleGuard';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AssignmentFeedback } from '@/components/mentor/AssignmentFeedback';
import { StudentProgress } from '@/components/mentor/StudentProgress';
import { MyStudents } from '@/components/mentor/MyStudents';
import { Users, MessageSquare, Clock, CheckCircle, AlertCircle, Calendar, FileText } from 'lucide-react';

interface AssignedStudent {
  id: string;
  full_name?: string;
  email: string;
  created_at: string;
}

export default function MentorDashboard() {
  const { user } = useAuth();
  const [assignedStudents, setAssignedStudents] = useState<AssignedStudent[]>([]);
  const [stats, setStats] = useState({
    totalStudents: 0,
    pendingFeedback: 0,
    completedModules: 0,
    avgProgress: 0
  });
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (user) {
      fetchAssignedStudents();
      fetchStats();
    }
  }, [user]);

  const fetchAssignedStudents = async () => {
    if (!user) return;

    try {
      // Fetch students assigned to this mentor
      const { data: students, error } = await supabase
        .from('users')
        .select('id, full_name, email, created_at')
        .eq('mentor_id', user.id)
        .eq('role', 'student');

      if (error) {
        console.error('Error fetching assigned students:', error);
        return;
      }

      setAssignedStudents(students || []);
    } catch (error) {
      console.error('Error fetching assigned students:', error);
    }
  };

  const fetchStats = async () => {
    if (!user) return;

    try {
      // Fetch students assigned to this mentor
      const { data: students } = await supabase
        .from('users')
        .select('id')
        .eq('mentor_id', user.id)
        .eq('role', 'student');

      // Fetch pending submissions for review
      const { data: pendingSubmissions } = await supabase
        .from('assignment_submissions')
        .select('id')
        .eq('status', 'submitted')
        .in('user_id', students?.map(s => s.id) || []);

      // Fetch completed modules by assigned students
      const { data: completedModules } = await supabase
        .from('user_module_progress')
        .select('id')
        .eq('is_completed', true)
        .in('user_id', students?.map(s => s.id) || []);

      setStats({
        totalStudents: students?.length || 0,
        pendingFeedback: pendingSubmissions?.length || 0,
        completedModules: completedModules?.length || 0,
        avgProgress: 65 // Would need more complex calculation
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  return (
    <RoleGuard allowedRoles={['mentor']}>
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-purple-900">🧑‍🏫 Mentor Hub</h1>
            <p className="text-muted-foreground">Guide, support, and nurture your students' growth</p>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm">
              <Calendar className="w-4 h-4 mr-2" />
              Schedule Session
            </Button>
            <Badge variant="secondary" className="text-sm bg-purple-100 text-purple-800">
              {assignedStudents.length} Students Under Guidance
            </Badge>
          </div>
        </div>

        {/* Overview Content */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-l-4 border-l-purple-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Students Mentoring</CardTitle>
                <Users className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-900">{stats.totalStudents}</div>
                <p className="text-xs text-muted-foreground">Under your guidance</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-orange-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
                <Clock className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-900">{stats.pendingFeedback}</div>
                <p className="text-xs text-muted-foreground">Awaiting your feedback</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Feedback Given</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-900">47</div>
                <p className="text-xs text-muted-foreground">This week</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Sessions Held</CardTitle>
                <MessageSquare className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-900">12</div>
                <p className="text-xs text-muted-foreground">This month</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <AlertCircle className="w-5 h-5 mr-2 text-red-500" />
                  Students Needing Attention
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-3 bg-red-50 rounded-lg">
                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                      <span className="text-red-600 font-semibold text-sm">JS</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">John Smith</p>
                      <p className="text-xs text-muted-foreground">No submission for 5 days</p>
                    </div>
                    <Badge variant="destructive" className="text-xs">Urgent</Badge>
                  </div>
                  <div className="flex items-center gap-4 p-3 bg-yellow-50 rounded-lg">
                    <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                      <span className="text-yellow-600 font-semibold text-sm">EM</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Emma Miller</p>
                      <p className="text-xs text-muted-foreground">Low quiz scores</p>
                    </div>
                    <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600">Monitor</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CheckCircle className="w-5 h-5 mr-2 text-green-500" />
                  Top Performers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-3 bg-green-50 rounded-lg">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-green-600 font-semibold text-sm">AK</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Alice Kim</p>
                      <p className="text-xs text-muted-foreground">Completed all modules</p>
                    </div>
                    <span className="text-xs text-green-600 font-medium">95%</span>
                  </div>
                  <div className="flex items-center gap-4 p-3 bg-blue-50 rounded-lg">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold text-sm">DR</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">David Rodriguez</p>
                      <p className="text-xs text-muted-foreground">Excellent progress</p>
                    </div>
                    <span className="text-xs text-blue-600 font-medium">89%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
