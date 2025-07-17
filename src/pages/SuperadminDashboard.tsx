import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Users, Shield, DollarSign, Activity, AlertTriangle, BookOpen, Video, FileText } from 'lucide-react';
import { RoleGuard } from '@/components/RoleGuard';
import { ModulesManagement } from '@/components/superadmin/ModulesManagement';
import { RecordingsManagement } from '@/components/superadmin/RecordingsManagement';
import { AssignmentsManagement } from '@/components/superadmin/AssignmentsManagement';
import { StudentsManagement } from '@/components/superadmin/StudentsManagement';
import { SuccessSessionsManagement } from '@/components/superadmin/SuccessSessionsManagement';
import { SubmissionsManagement } from '@/components/superadmin/SubmissionsManagement';
import { SupportManagement } from '@/components/superadmin/SupportManagement';

export default function SuperadminDashboard() {
  const [searchParams] = useSearchParams();
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
        return <SubmissionsManagement />;
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

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div className="animate-fade-in">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            🔧 System Command Center
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">Ultimate platform control and global oversight</p>
        </div>
        <div className="flex items-center gap-3 animate-scale-in">
          <Button variant="outline" size="sm" className="hover-scale story-link">
            <Shield className="w-4 h-4 mr-2" />
            Security
          </Button>
          <Button variant="default" size="sm" className="hover-scale bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Critical Actions
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-l-4 border-l-red-500 hover-scale transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-red-50 to-white animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-800">Total Admins</CardTitle>
            <Shield className="h-5 w-5 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-900">12</div>
            <p className="text-xs text-muted-foreground">Platform administrators</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500 hover-scale transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-purple-50 to-white animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-800">Superadmins</CardTitle>
            <Users className="h-5 w-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-900">2</div>
            <p className="text-xs text-muted-foreground">System superadmins</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500 hover-scale transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-orange-50 to-white animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-800">Mentors</CardTitle>
            <Users className="h-5 w-5 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-900">45</div>
            <p className="text-xs text-muted-foreground">Active mentors</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 hover-scale transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-blue-50 to-white animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-800">Total Students</CardTitle>
            <Users className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-900">2,480</div>
            <p className="text-xs text-muted-foreground">All registered students</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="border-l-4 border-l-green-500 hover-scale transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-green-50 to-white animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-800">Active Students</CardTitle>
            <Activity className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-900">2,156</div>
            <p className="text-xs text-muted-foreground">Currently active students</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-cyan-500 hover-scale transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-cyan-50 to-white animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-cyan-800">Course Completion Rate</CardTitle>
            <Activity className="h-5 w-5 text-cyan-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-cyan-900">73.2%</div>
            <p className="text-xs text-muted-foreground">Students completing courses</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500 hover-scale transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-yellow-50 to-white animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-yellow-800">Recovery Rate</CardTitle>
            <Activity className="h-5 w-5 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-900">68.5%</div>
            <p className="text-xs text-muted-foreground">Student recovery rate</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}