
import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Users, Shield, DollarSign, Activity, AlertTriangle, BookOpen, Video, FileText, GraduationCap } from 'lucide-react';
import { RoleGuard } from '@/components/RoleGuard';
import { ModulesManagement } from '@/components/superadmin/ModulesManagement';
import { RecordingsManagement } from '@/components/superadmin/RecordingsManagement';
import { AssignmentsManagement } from '@/components/superadmin/AssignmentsManagement';
import { StudentsManagement } from '@/components/superadmin/StudentsManagement';
import { SuccessSessionsManagement } from '@/components/superadmin/SuccessSessionsManagement';
import { AssignmentFeedback } from '@/components/mentor/AssignmentFeedback';
import { SupportManagement } from '@/components/superadmin/SupportManagement';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface DashboardStats {
  totalAdmins: number;
  totalSuperadmins: number;
  totalMentors: number;
  totalStudents: number;
  activeStudents: number;
  studentsUsingLMS: number;
  courseCompletionRate: number;
  recoveryRate: number;
}

export default function SuperadminDashboard() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const activeTab = searchParams.get('tab') || 'dashboard';

  const renderContent = () => {
    switch (activeTab) {
      case 'modules':
        return <ModulesManagement />;
      case 'recordings':
        return <RecordingsManagement />;
      case 'assignments':
        return <AssignmentsManagement />;
      case 'success-sessions':
        return <SuccessSessionsManagement />;
      case 'students':
        return <StudentsManagement />;
      case 'submissions':
        return <AssignmentFeedback />;
      case 'support':
        return <SupportManagement />;
      default:
        return <DashboardContent />;
    }
  };

  return (
    <RoleGuard allowedRoles={['superadmin']}>
      <div className="container mx-auto p-6 animate-fade-in">
        {renderContent()}
      </div>
    </RoleGuard>
  );
}

function DashboardContent() {
  const [stats, setStats] = useState<DashboardStats>({
    totalAdmins: 0,
    totalSuperadmins: 0,
    totalMentors: 0,
    totalStudents: 0,
    activeStudents: 0,
    studentsUsingLMS: 0,
    courseCompletionRate: 0,
    recoveryRate: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      
      // Fetch user counts by role
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role, lms_status, status');

      if (userError) {
        console.error('Error fetching user data:', userError);
        return;
      }

      // Count users by role
      const totalAdmins = userData?.filter(user => user.role === 'admin').length || 0;
      const totalSuperadmins = userData?.filter(user => user.role === 'superadmin').length || 0;
      const totalMentors = userData?.filter(user => user.role === 'mentor').length || 0;
      const totalStudents = userData?.filter(user => user.role === 'student').length || 0;
      
      // Count active students (status = 'Active')
      const activeStudents = userData?.filter(user => 
        user.role === 'student' && user.status === 'Active'
      ).length || 0;
      
      // Count students using LMS (lms_status = 'active')
      const studentsUsingLMS = userData?.filter(user => 
        user.role === 'student' && user.lms_status === 'active'
      ).length || 0;

      // Fetch course completion data
      const { data: progressData, error: progressError } = await supabase
        .from('user_module_progress')
        .select('user_id, is_completed');

      if (progressError) {
        console.error('Error fetching progress data:', progressError);
      }

      // Calculate completion rate
      let courseCompletionRate = 0;
      if (progressData && progressData.length > 0) {
        const completedModules = progressData.filter(p => p.is_completed).length;
        courseCompletionRate = Math.round((completedModules / progressData.length) * 100);
      }

      // Fetch recovery data
      const { data: recoveryData, error: recoveryError } = await supabase
        .from('performance_record')
        .select('times_recovered');

      if (recoveryError) {
        console.error('Error fetching recovery data:', recoveryError);
      }

      // Calculate recovery rate (simplified - you may want to adjust this logic)
      let recoveryRate = 0;
      if (recoveryData && recoveryData.length > 0) {
        const totalRecoveries = recoveryData.reduce((sum, record) => sum + (record.times_recovered || 0), 0);
        recoveryRate = Math.round((totalRecoveries / recoveryData.length) * 100);
      }

      setStats({
        totalAdmins,
        totalSuperadmins,
        totalMentors,
        totalStudents,
        activeStudents,
        studentsUsingLMS,
        courseCompletionRate,
        recoveryRate
      });

    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div className="animate-fade-in">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            🔧 System Command Center
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">Ultimate platform control and global oversight</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-l-4 border-l-red-500 hover-scale transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-red-50 to-white animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-800">Total Admins</CardTitle>
            <Shield className="h-5 w-5 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-900">{stats.totalAdmins}</div>
            <p className="text-xs text-muted-foreground">Platform administrators</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500 hover-scale transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-purple-50 to-white animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-800">Superadmins</CardTitle>
            <Users className="h-5 w-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-900">{stats.totalSuperadmins}</div>
            <p className="text-xs text-muted-foreground">System superadmins</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500 hover-scale transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-orange-50 to-white animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-800">Mentors</CardTitle>
            <Users className="h-5 w-5 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-900">{stats.totalMentors}</div>
            <p className="text-xs text-muted-foreground">Active mentors</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 hover-scale transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-blue-50 to-white animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-800">Total Students</CardTitle>
            <Users className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-900">{stats.totalStudents}</div>
            <p className="text-xs text-muted-foreground">All registered students</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-l-4 border-l-green-500 hover-scale transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-green-50 to-white animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-800">Active Students</CardTitle>
            <Activity className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-900">{stats.activeStudents}</div>
            <p className="text-xs text-muted-foreground">Currently active students</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-indigo-500 hover-scale transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-indigo-50 to-white animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-indigo-800">Students Currently using LMS</CardTitle>
            <GraduationCap className="h-5 w-5 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-indigo-900">{stats.studentsUsingLMS}</div>
            <p className="text-xs text-muted-foreground">Students actively using LMS</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-cyan-500 hover-scale transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-cyan-50 to-white animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-cyan-800">Course Completion Rate</CardTitle>
            <Activity className="h-5 w-5 text-cyan-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-cyan-900">{stats.courseCompletionRate}%</div>
            <p className="text-xs text-muted-foreground">Students completing courses</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500 hover-scale transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-yellow-50 to-white animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-yellow-800">Recovery Rate</CardTitle>
            <Activity className="h-5 w-5 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-900">{stats.recoveryRate}%</div>
            <p className="text-xs text-muted-foreground">Student recovery rate</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
