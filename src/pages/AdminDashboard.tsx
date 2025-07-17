import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Users, Shield, DollarSign, Activity, AlertTriangle, BookOpen, Video, FileText } from 'lucide-react';
import { RoleGuard } from '@/components/RoleGuard';
import { ContentManagement } from '@/components/admin/ContentManagement';
import { FinancialManagement } from '@/components/admin/FinancialManagement';
import { StudentManagement } from '@/components/admin/StudentManagement';
import { MentorManagement } from '@/components/admin/MentorManagement';
import { ActivityLogs } from '@/components/admin/ActivityLogs';
import { StudentPerformance } from '@/components/admin/StudentPerformance';

export default function AdminDashboard() {
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'dashboard';

  const renderContent = () => {
    switch (activeTab) {
      case 'content':
        return <ContentManagement />;
      case 'financial':
        return <FinancialManagement />;
      case 'students':
        return <StudentManagement />;
      case 'mentors':
        return <MentorManagement />;
      case 'activity':
        return <ActivityLogs />;
      case 'performance':
        return <StudentPerformance />;
      default:
        return <DashboardContent />;
    }
  };

  return (
    <RoleGuard allowedRoles={['admin', 'superadmin']}>
      <div className="container mx-auto p-6 animate-fade-in">
        {renderContent()}
      </div>
    </RoleGuard>
  );
}

function DashboardContent() {
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div className="animate-fade-in">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            ⚙️ Administrative Control
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">Manage platform operations and user oversight</p>
        </div>
        <div className="flex items-center gap-3 animate-scale-in">
          <Button variant="outline" size="sm" className="hover-scale story-link">
            <Shield className="w-4 h-4 mr-2" />
            Security
          </Button>
          <Button variant="default" size="sm" className="hover-scale bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Admin Actions
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-l-4 border-l-blue-500 hover-scale transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-blue-50 to-white animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-800">Total Users</CardTitle>
            <Users className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-900">1,234</div>
            <p className="text-xs text-muted-foreground">Platform users</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 hover-scale transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-green-50 to-white animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-800">Content Modules</CardTitle>
            <BookOpen className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-900">45</div>
            <p className="text-xs text-muted-foreground">Available modules</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500 hover-scale transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-yellow-50 to-white animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-yellow-800">Monthly Revenue</CardTitle>
            <DollarSign className="h-5 w-5 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-900">$45,231</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500 hover-scale transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-purple-50 to-white animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-800">System Health</CardTitle>
            <Activity className="h-5 w-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-900">99.2%</div>
            <p className="text-xs text-muted-foreground">Platform uptime</p>
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
            <div className="text-3xl font-bold text-cyan-900">892</div>
            <p className="text-xs text-muted-foreground">Currently active students</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-indigo-500 hover-scale transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-indigo-50 to-white animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-indigo-800">Course Completion</CardTitle>
            <Activity className="h-5 w-5 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-indigo-900">85%</div>
            <p className="text-xs text-muted-foreground">Completion rate</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-pink-500 hover-scale transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-pink-50 to-white animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-pink-800">Support Tickets</CardTitle>
            <Activity className="h-5 w-5 text-pink-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-pink-900">12</div>
            <p className="text-xs text-muted-foreground">Open tickets</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}