import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus, Users, Shield, DollarSign, Activity, AlertTriangle } from 'lucide-react';
import { RoleGuard } from '@/components/RoleGuard';
import { AdminManagement } from '@/components/superadmin/AdminManagement';
import { GlobalFinancials } from '@/components/superadmin/GlobalFinancials';
import { GlobalActivityLogs } from '@/components/superadmin/GlobalActivityLogs';
import { SystemHealth } from '@/components/superadmin/SystemHealth';
import { StudentManagement } from '@/components/admin/StudentManagement';
import { MentorManagement } from '@/components/admin/MentorManagement';

export default function SuperadminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <RoleGuard allowedRoles={['superadmin']}>
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Superadmin Dashboard</h1>
            <p className="text-muted-foreground">Complete system oversight and management</p>
          </div>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            System Actions
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-7 w-full">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="admins">Admins</TabsTrigger>
            <TabsTrigger value="students">Students</TabsTrigger>
            <TabsTrigger value="mentors">Mentors</TabsTrigger>
            <TabsTrigger value="financials">Financials</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">2,547</div>
                  <p className="text-xs text-muted-foreground">+15% from last month</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Admins</CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">12</div>
                  <p className="text-xs text-muted-foreground">3 online now</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">$125,847</div>
                  <p className="text-xs text-muted-foreground">+22% from last month</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">System Health</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">98.9%</div>
                  <p className="text-xs text-muted-foreground">Uptime this month</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>System Alerts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 p-3 bg-red-50 rounded-lg border border-red-200">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">High overdue payment rate</p>
                        <p className="text-xs text-muted-foreground">15% of students have overdue payments</p>
                      </div>
                      <span className="text-xs text-red-600">URGENT</span>
                    </div>
                    
                    <div className="flex items-center gap-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Server load increasing</p>
                        <p className="text-xs text-muted-foreground">CPU usage at 75% for the last hour</p>
                      </div>
                      <span className="text-xs text-yellow-600">WARNING</span>
                    </div>
                    
                    <div className="flex items-center gap-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <Activity className="h-4 w-4 text-blue-500" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Scheduled maintenance</p>
                        <p className="text-xs text-muted-foreground">Database optimization in 2 hours</p>
                      </div>
                      <span className="text-xs text-blue-600">INFO</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Role Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm">Students</span>
                      <span className="text-sm font-medium">2,480 (97.4%)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Mentors</span>
                      <span className="text-sm font-medium">45 (1.8%)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Admins</span>
                      <span className="text-sm font-medium">12 (0.5%)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Superadmins</span>
                      <span className="text-sm font-medium">2 (0.1%)</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="admins">
            <AdminManagement />
          </TabsContent>

          <TabsContent value="students">
            <StudentManagement />
          </TabsContent>

          <TabsContent value="mentors">
            <MentorManagement />
          </TabsContent>

          <TabsContent value="financials">
            <GlobalFinancials />
          </TabsContent>

          <TabsContent value="activity">
            <GlobalActivityLogs />
          </TabsContent>

          <TabsContent value="system">
            <SystemHealth />
          </TabsContent>
        </Tabs>
      </div>
    </RoleGuard>
  );
}