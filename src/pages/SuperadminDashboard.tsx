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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-6 w-full bg-red-50">
            <TabsTrigger value="overview" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">Command Center</TabsTrigger>
            <TabsTrigger value="admins" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">Admin Control</TabsTrigger>
            <TabsTrigger value="financials" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">Global Finance</TabsTrigger>
            <TabsTrigger value="activity" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">Global Activity</TabsTrigger>
            <TabsTrigger value="system" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">System Health</TabsTrigger>
            <TabsTrigger value="security" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">Security Center</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="border-l-4 border-l-red-500">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Global Users</CardTitle>
                  <Users className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-900">2,547</div>
                  <p className="text-xs text-muted-foreground">All platform users</p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-orange-500">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Admin Network</CardTitle>
                  <Shield className="h-4 w-4 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-900">12</div>
                  <p className="text-xs text-muted-foreground">Platform administrators</p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-green-500">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Global Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-900">$125,847</div>
                  <p className="text-xs text-muted-foreground">All-time revenue</p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-blue-500">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">System Status</CardTitle>
                  <Activity className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-900">98.9%</div>
                  <p className="text-xs text-muted-foreground">Global uptime</p>
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

          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="w-5 h-5 mr-2 text-red-500" />
                  Security Command Center
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-red-700">Critical Security Actions</h3>
                    <div className="space-y-2">
                      <Button variant="destructive" className="w-full justify-start">
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        Emergency Platform Shutdown
                      </Button>
                      <Button variant="destructive" className="w-full justify-start">
                        <Shield className="w-4 h-4 mr-2" />
                        Revoke All Admin Access
                      </Button>
                      <Button variant="outline" className="w-full justify-start border-red-200">
                        <Users className="w-4 h-4 mr-2" />
                        Mass User Suspension
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="font-semibold text-blue-700">Security Monitoring</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between p-3 bg-green-50 rounded">
                        <span className="text-sm">Failed Login Attempts</span>
                        <span className="text-sm font-medium text-green-600">Normal</span>
                      </div>
                      <div className="flex justify-between p-3 bg-yellow-50 rounded">
                        <span className="text-sm">Suspicious Activity</span>
                        <span className="text-sm font-medium text-yellow-600">3 Alerts</span>
                      </div>
                      <div className="flex justify-between p-3 bg-red-50 rounded">
                        <span className="text-sm">Security Breaches</span>
                        <span className="text-sm font-medium text-red-600">0</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
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