import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Users, Shield, DollarSign, Activity, AlertTriangle, BookOpen, Video, FileText } from 'lucide-react';
import { RoleGuard } from '@/components/RoleGuard';
import { ModulesManagement } from '@/components/superadmin/ModulesManagement';
import { RecordingsManagement } from '@/components/superadmin/RecordingsManagement';
import { AssignmentsManagement } from '@/components/superadmin/AssignmentsManagement';

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
      default:
        return <DashboardContent />;
    }
  };

  return (
    <RoleGuard allowedRoles={['superadmin']}>
      <div className="container mx-auto p-6">
        {renderContent()}
      </div>
    </RoleGuard>
  );
}

function DashboardContent() {

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-red-900">🔧 System Command Center</h1>
          <p className="text-muted-foreground">Ultimate platform control and global oversight</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm">
            <Shield className="w-4 h-4 mr-2" />
            Security
          </Button>
          <Button variant="destructive" size="sm">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Critical Actions
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Admins</CardTitle>
            <Shield className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-900">12</div>
            <p className="text-xs text-muted-foreground">Platform administrators</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Superadmins</CardTitle>
            <Users className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900">2</div>
            <p className="text-xs text-muted-foreground">System superadmins</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mentors</CardTitle>
            <Users className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-900">45</div>
            <p className="text-xs text-muted-foreground">Active mentors</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900">2,480</div>
            <p className="text-xs text-muted-foreground">All registered students</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Students</CardTitle>
            <Activity className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900">2,156</div>
            <p className="text-xs text-muted-foreground">Currently active students</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-cyan-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Course Completion Rate</CardTitle>
            <Activity className="h-4 w-4 text-cyan-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyan-900">73.2%</div>
            <p className="text-xs text-muted-foreground">Students completing courses</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recovery Rate</CardTitle>
            <Activity className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-900">68.5%</div>
            <p className="text-xs text-muted-foreground">Student recovery rate</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}