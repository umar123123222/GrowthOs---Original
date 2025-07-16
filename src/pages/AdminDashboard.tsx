import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Users, BookOpen, DollarSign, Activity } from 'lucide-react';
import { RoleGuard } from '@/components/RoleGuard';
import { StudentManagement } from '@/components/admin/StudentManagement';
import { MentorManagement } from '@/components/admin/MentorManagement';
import { ContentManagement } from '@/components/admin/ContentManagement';
import { FinancialManagement } from '@/components/admin/FinancialManagement';
import { ActivityLogs } from '@/components/admin/ActivityLogs';
import { StudentPerformance } from '@/components/admin/StudentPerformance';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <RoleGuard allowedRoles={['admin', 'superadmin']}>
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-blue-900">⚙️ Administrative Control</h1>
            <p className="text-muted-foreground">Manage platform operations and user oversight</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm">
              <Activity className="w-4 h-4 mr-2" />
              Reports
            </Button>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Admin Actions
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-6 w-full bg-blue-50">
            <TabsTrigger value="overview" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Management Hub</TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">User Management</TabsTrigger>
            <TabsTrigger value="content" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Content Control</TabsTrigger>
            <TabsTrigger value="financial" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Financial Admin</TabsTrigger>
            <TabsTrigger value="operations" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Operations</TabsTrigger>
            <TabsTrigger value="activity" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Activity Monitor</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="border-l-4 border-l-blue-500">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Platform Users</CardTitle>
                  <Users className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-900">1,234</div>
                  <p className="text-xs text-muted-foreground">+20.1% from last month</p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-green-500">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Content Modules</CardTitle>
                  <BookOpen className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-900">45</div>
                  <p className="text-xs text-muted-foreground">+3 new this month</p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-yellow-500">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-yellow-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-900">$45,231</div>
                  <p className="text-xs text-muted-foreground">+12% from last month</p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-purple-500">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">System Health</CardTitle>
                  <Activity className="h-4 w-4 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-900">99.2%</div>
                  <p className="text-xs text-muted-foreground">Platform uptime</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Administrative Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 p-3 bg-blue-50 rounded-lg">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <Users className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">User account suspended</p>
                        <p className="text-xs text-muted-foreground">Policy violation detected</p>
                      </div>
                      <span className="text-xs text-blue-600">2 hours ago</span>
                    </div>
                    <div className="flex items-center gap-4 p-3 bg-green-50 rounded-lg">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <BookOpen className="w-4 h-4 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Content module published</p>
                        <p className="text-xs text-muted-foreground">Module 7 - Advanced Strategies</p>
                      </div>
                      <span className="text-xs text-green-600">4 hours ago</span>
                    </div>
                    <div className="flex items-center gap-4 p-3 bg-yellow-50 rounded-lg">
                      <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                        <DollarSign className="w-4 h-4 text-yellow-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Payment dispute resolved</p>
                        <p className="text-xs text-muted-foreground">Refund processed</p>
                      </div>
                      <span className="text-xs text-yellow-600">6 hours ago</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Platform Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm">Active Users Today</span>
                      <span className="text-sm font-medium text-green-600">892</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Content Engagement</span>
                      <span className="text-sm font-medium text-blue-600">85%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Support Tickets</span>
                      <span className="text-sm font-medium text-yellow-600">12</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">System Alerts</span>
                      <span className="text-sm font-medium text-red-600">3</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="users">
            <div className="space-y-6">
              <StudentManagement />
              <MentorManagement />
            </div>
          </TabsContent>

          <TabsContent value="operations">
            <Card>
              <CardHeader>
                <CardTitle>Platform Operations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold">System Tasks</h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <span className="text-sm">Database Backup</span>
                        <Badge variant="outline">Scheduled</Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <span className="text-sm">Email Queue</span>
                        <Badge variant="secondary">Processing</Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <span className="text-sm">Cache Cleanup</span>
                        <Badge variant="default">Completed</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="font-semibold">User Actions</h3>
                    <div className="space-y-2">
                      <Button variant="outline" className="w-full justify-start">
                        <Users className="w-4 h-4 mr-2" />
                        Bulk User Import
                      </Button>
                      <Button variant="outline" className="w-full justify-start">
                        <BookOpen className="w-4 h-4 mr-2" />
                        Content Audit
                      </Button>
                      <Button variant="outline" className="w-full justify-start">
                        <DollarSign className="w-4 h-4 mr-2" />
                        Payment Reconciliation
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="content">
            <ContentManagement />
          </TabsContent>

          <TabsContent value="financial">
            <FinancialManagement />
          </TabsContent>

          <TabsContent value="activity">
            <ActivityLogs />
          </TabsContent>
        </Tabs>
      </div>
    </RoleGuard>
  );
}