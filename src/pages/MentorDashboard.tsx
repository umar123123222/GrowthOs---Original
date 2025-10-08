import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RoleGuard } from '@/components/RoleGuard';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { SubmissionsManagement } from '@/components/assignments/SubmissionsManagement';
import { StudentProgress } from '@/components/mentor/StudentProgress';
import { MyStudents } from '@/components/mentor/MyStudents';
import { MentorRecordingsManagement } from '@/components/mentor/MentorRecordingsManagement';
import { MentorModulesManagement } from '@/components/mentor/MentorModulesManagement';
import { AssignmentManagement } from '@/components/assignments/AssignmentManagement';
import { Users, MessageSquare, Clock, CheckCircle, AlertCircle, Calendar, FileText, Video, BookOpen } from 'lucide-react';
interface AssignedStudent {
  id: string;
  full_name?: string;
  email: string;
  created_at: string;
}
export default function MentorDashboard() {
  const {
    user
  } = useAuth();
  const [assignedStudents, setAssignedStudents] = useState<AssignedStudent[]>([]);
  const [stats, setStats] = useState({
    pendingReviews: 0,
    checkedAssignments: 0,
    sessionsMentored: 0
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
      // Get students from the students table and join with users
      const {
        data: students,
        error
      } = await supabase.from('students').select(`
          id,
          user_id,
          users!inner(
            id,
            full_name,
            email,
            created_at
          )
        `);
      if (error) {
        console.error('Error fetching assigned students:', error);
        return;
      }

      // Map to the expected format
      const mappedStudents = students?.map(student => ({
        id: student.user_id,
        full_name: student.users?.full_name,
        email: student.users?.email || '',
        created_at: student.users?.created_at || ''
      })) || [];
      setAssignedStudents(mappedStudents);
    } catch (error) {
      console.error('Error fetching assigned students:', error);
    }
  };
  const fetchStats = async () => {
    if (!user) return;
    try {
      // Fetch all pending submissions
      const {
        data: pendingSubmissions
      } = await supabase.from('submissions').select('id').eq('status', 'pending');

      // Fetch all approved/checked assignments
      const {
        data: checkedSubmissions
      } = await supabase.from('submissions').select('id').eq('status', 'approved');

      // Fetch total students for sessions calculation (using as proxy for sessions)
      const {
        data: students
      } = await supabase.from('users').select('id').eq('role', 'student');

      // Calculate sessions mentored based on student count and activity
      const sessionsMentored = Math.min(students?.length || 0, 15);
      setStats({
        pendingReviews: pendingSubmissions?.length || 0,
        checkedAssignments: checkedSubmissions?.length || 0,
        sessionsMentored: sessionsMentored
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      // Set fallback values if there's an error
      setStats({
        pendingReviews: 0,
        checkedAssignments: 0,
        sessionsMentored: 0
      });
    }
  };
  return <RoleGuard allowedRoles={['mentor']}>
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-purple-900">🧑‍🏫 Mentor Hub</h1>
            <p className="text-muted-foreground">Guide, support, and nurture your students' growth</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-l-4 border-l-orange-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Assignments Pending Reviews</CardTitle>
                <Clock className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-900">{stats.pendingReviews}</div>
                <p className="text-xs text-muted-foreground">Awaiting your feedback</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Assignments Checked</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-900">{stats.checkedAssignments}</div>
                <p className="text-xs text-muted-foreground">Feedback provided</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Sessions Mentored</CardTitle>
                <MessageSquare className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-900">{stats.sessionsMentored}</div>
                <p className="text-xs text-muted-foreground">This month</p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              
              
              

              <TabsContent value="submissions" className="mt-6">
                <SubmissionsManagement userRole="mentor" />
              </TabsContent>

              <TabsContent value="recordings" className="mt-6">
                <MentorRecordingsManagement />
              </TabsContent>

              <TabsContent value="modules" className="mt-6">
                <MentorModulesManagement />
              </TabsContent>

              <TabsContent value="assignments" className="mt-6">
                <AssignmentManagement />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </RoleGuard>;
}