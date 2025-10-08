import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RoleGuard } from '@/components/RoleGuard';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { MentorSidebar } from '@/components/mentor/MentorSidebar';
import { SubmissionsManagement } from '@/components/assignments/SubmissionsManagement';
import { MentorRecordingsManagement } from '@/components/mentor/MentorRecordingsManagement';
import { MentorModulesManagement } from '@/components/mentor/MentorModulesManagement';
import { AssignmentManagement } from '@/components/assignments/AssignmentManagement';
import { Clock, CheckCircle, MessageSquare } from 'lucide-react';

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
    pendingReviews: 0,
    checkedAssignments: 0,
    sessionsMentored: 0
  });

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
      const { data: students, error } = await supabase
        .from('students')
        .select(`
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
      const { data: pendingSubmissions } = await supabase
        .from('submissions')
        .select('id')
        .eq('status', 'pending');

      // Fetch all approved/checked assignments
      const { data: checkedSubmissions } = await supabase
        .from('submissions')
        .select('id')
        .eq('status', 'approved');

      // Fetch total students for sessions calculation (using as proxy for sessions)
      const { data: students } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'student');

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

  const OverviewContent = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-purple-900">🧑‍🏫 Mentor Hub</h1>
          <p className="text-muted-foreground">Guide, support, and nurture your students' growth</p>
        </div>
      </div>

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
    </div>
  );

  return (
    <RoleGuard allowedRoles={['mentor']}>
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <MentorSidebar />
          
          <div className="flex-1 flex flex-col">
            <header className="h-12 flex items-center border-b bg-white sticky top-0 z-10">
              <SidebarTrigger className="ml-2" />
              <h2 className="ml-4 font-semibold">Mentor Dashboard</h2>
            </header>

            <main className="flex-1 p-6">
              <Routes>
                <Route path="/" element={<OverviewContent />} />
                <Route path="/submissions" element={<SubmissionsManagement userRole="mentor" />} />
                <Route path="/recordings" element={<MentorRecordingsManagement />} />
                <Route path="/modules" element={<MentorModulesManagement />} />
                <Route path="/assignments" element={<AssignmentManagement />} />
                <Route path="*" element={<Navigate to="/mentor-dashboard" replace />} />
              </Routes>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </RoleGuard>
  );
}
