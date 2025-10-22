import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Users, Shield, DollarSign, Activity, AlertTriangle, BookOpen, Video, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { RoleGuard } from '@/components/RoleGuard';
import { ContentManagement } from '@/components/admin/ContentManagement';
import { FinancialManagement } from '@/components/admin/FinancialManagement';
import { StudentManagement } from '@/components/admin/StudentManagement';
import { MentorManagement } from '@/components/admin/MentorManagement';
import { ActivityLogs } from '@/components/admin/ActivityLogs';
import { StudentPerformance } from '@/components/admin/StudentPerformance';
import { ModulesManagement } from '@/components/superadmin/ModulesManagement';
import { RecordingsManagement } from '@/components/superadmin/RecordingsManagement';
import { SuccessSessionsManagement } from '@/components/superadmin/SuccessSessionsManagement';
import { AssignmentManagement } from '@/components/assignments/AssignmentManagement';
import { SubmissionsManagement } from '@/components/assignments/SubmissionsManagement';
import { SupportManagement } from '@/components/superadmin/SupportManagement';
import { CourseCompletionAnalytics } from '@/components/admin/CourseCompletionAnalytics';
import { MilestoneManagement } from '@/components/admin/MilestoneManagement';
import { StudentAnalytics } from '@/components/admin/StudentAnalytics';
import { useRecoveryRate } from '@/hooks/useRecoveryRate';
import { formatCurrency } from '@/utils/currencyFormatter';
export default function AdminDashboard() {
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'dashboard';
  const renderContent = () => {
    switch (activeTab) {
      case 'modules':
        return <ModulesManagement />;
      case 'recordings':
        return <RecordingsManagement />;
      case 'success-sessions':
        return <SuccessSessionsManagement />;
      case 'students':
        return <StudentManagement />;
      case 'assignments':
        return <AssignmentManagement />;
      case 'submissions':
        return <SubmissionsManagement userRole="admin" />;
      case 'support':
        return <SupportManagement />;
      case 'content':
        return <ContentManagement />;
      case 'financial':
        return <FinancialManagement />;
      case 'mentors':
        return <MentorManagement />;
      case 'activity':
        return <ActivityLogs />;
      case 'performance':
        return <StudentPerformance />;
      case 'completion':
        return <CourseCompletionAnalytics />;
      case 'milestones':
        return <MilestoneManagement />;
      case 'analytics':
        return <StudentAnalytics />;
      default:
        return <DashboardContent />;
    }
  };
  return <RoleGuard allowedRoles={['admin', 'superadmin']}>
      <div className="container mx-auto p-6 animate-fade-in px-0">
        {renderContent()}
      </div>
    </RoleGuard>;
}
function DashboardContent() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalModules: 0,
    monthlyRevenue: 0,
    activeStudents: 0,
    courseCompletion: 0,
    openTickets: 0
  });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetchDashboardStats();
  }, []);
  const fetchDashboardStats = async () => {
    try {
      setLoading(true);

      // Fetch total users
      const {
        data: users
      } = await supabase.from('users').select('id, role, status');

      // Fetch total modules
      const {
        data: modules
      } = await supabase.from('modules').select('id');

      // Fetch active students (status is lowercase in database)
      const activeStudents = users?.filter(user => user.role === 'student' && user.status === 'active').length || 0;

      // Calculate actual course completion percentage
      const totalStudents = users?.filter(user => user.role === 'student').length || 0;
      const { data: completedModules } = await supabase
        .from('user_activity_logs')
        .select('user_id')
        .eq('activity_type', 'module_completed');
      
      const studentsWithCompletions = new Set(completedModules?.map(log => log.user_id)).size;
      const courseCompletion = totalStudents > 0 ? Math.round((studentsWithCompletions / totalStudents) * 100) : 0;

      // Fetch open support tickets
      const {
        data: tickets
      } = await supabase.from('support_tickets').select('id').eq('status', 'open');

      // Fetch monthly revenue from invoices (sum of payments this month)
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
      const {
        data: payments
      } = await supabase.from('invoices').select('amount').gte('created_at', `${currentMonth}-01`).lt('created_at', `${currentMonth}-32`).eq('status', 'paid');
      const monthlyRevenue = payments?.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0) || 0;
      setStats({
        totalUsers: users?.length || 0,
        totalModules: modules?.length || 0,
        monthlyRevenue,
        activeStudents,
        courseCompletion,
        openTickets: tickets?.length || 0
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };
  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading dashboard...</div>
      </div>;
  }
  return <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div className="animate-fade-in">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            ⚙️ Administrative Control
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">Manage platform operations and user oversight</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="border-l-4 border-l-blue-500 hover-scale transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-blue-50 to-white animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-800">Total Users</CardTitle>
            <Users className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-900">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">Platform users</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 hover-scale transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-green-50 to-white animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-800">Content Modules</CardTitle>
            <BookOpen className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-900">{stats.totalModules}</div>
            <p className="text-xs text-muted-foreground">Available modules</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500 hover-scale transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-yellow-50 to-white animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-yellow-800">Monthly Revenue</CardTitle>
            <DollarSign className="h-5 w-5 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-900">{formatCurrency(stats.monthlyRevenue)}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="border-l-4 border-l-cyan-500 hover-scale transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-cyan-50 to-white animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-cyan-800">Active Students</CardTitle>
            <Activity className="h-5 w-5 text-cyan-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-cyan-900">{stats.activeStudents}</div>
            <p className="text-xs text-muted-foreground">Currently active students</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-indigo-500 hover-scale transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-indigo-50 to-white animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-indigo-800">Course Completion</CardTitle>
            <Activity className="h-5 w-5 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-indigo-900">{stats.courseCompletion}%</div>
            <p className="text-xs text-muted-foreground">Completion rate</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-pink-500 hover-scale transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-pink-50 to-white animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-pink-800">Support Tickets</CardTitle>
            <Activity className="h-5 w-5 text-pink-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-pink-900">{stats.openTickets}</div>
            <p className="text-xs text-muted-foreground">Open tickets</p>
          </CardContent>
        </Card>
      </div>
    </div>;
}