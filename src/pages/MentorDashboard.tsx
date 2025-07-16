import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { RoleGuard } from '@/components/RoleGuard';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AssignmentFeedback } from '@/components/mentor/AssignmentFeedback';
import { StudentProgress } from '@/components/mentor/StudentProgress';
import { MyStudents } from '@/components/mentor/MyStudents';
import { Users, BookOpen, MessageSquare, TrendingUp } from 'lucide-react';

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

    // Mock data until types are regenerated
    const mockStudents: AssignedStudent[] = [
      {
        id: '1',
        full_name: 'John Doe',
        email: 'john@example.com',
        created_at: '2024-01-15'
      },
      {
        id: '2',
        full_name: 'Jane Smith',
        email: 'jane@example.com',
        created_at: '2024-01-10'
      }
    ];
    setAssignedStudents(mockStudents);
  };

  const fetchStats = async () => {
    if (!user) return;

    // This would be replaced with actual queries
    setStats({
      totalStudents: assignedStudents.length,
      pendingFeedback: 5,
      completedModules: 24,
      avgProgress: 65
    });
  };

  return (
    <RoleGuard allowedRoles={['mentor']}>
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Mentor Dashboard</h1>
            <p className="text-muted-foreground">Manage your assigned students and provide feedback</p>
          </div>
          <Badge variant="outline" className="text-sm">
            {assignedStudents.length} Students Assigned
          </Badge>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="students">My Students</TabsTrigger>
            <TabsTrigger value="feedback">Feedback</TabsTrigger>
            <TabsTrigger value="progress">Progress</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Assigned Students</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalStudents}</div>
                  <p className="text-xs text-muted-foreground">Active students under your guidance</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending Feedback</CardTitle>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.pendingFeedback}</div>
                  <p className="text-xs text-muted-foreground">Assignments awaiting review</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Completed Modules</CardTitle>
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.completedModules}</div>
                  <p className="text-xs text-muted-foreground">Total across all students</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Progress</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.avgProgress}%</div>
                  <p className="text-xs text-muted-foreground">Across all assigned students</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Student Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm">Sarah completed Module 2</span>
                      <span className="text-xs text-muted-foreground ml-auto">1 hour ago</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="text-sm">Mike submitted Assignment 4</span>
                      <span className="text-xs text-muted-foreground ml-auto">3 hours ago</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      <span className="text-sm">Emma requested help on Module 1</span>
                      <span className="text-xs text-muted-foreground ml-auto">5 hours ago</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Student Performance Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm">On Track</span>
                      <span className="text-sm font-medium text-green-600">70%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Needs Support</span>
                      <span className="text-sm font-medium text-yellow-600">25%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">At Risk</span>
                      <span className="text-sm font-medium text-red-600">5%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="students">
            <MyStudents students={assignedStudents} />
          </TabsContent>

          <TabsContent value="feedback">
            <AssignmentFeedback />
          </TabsContent>

          <TabsContent value="progress">
            <StudentProgress students={assignedStudents} />
          </TabsContent>
        </Tabs>
      </div>
    </RoleGuard>
  );
}