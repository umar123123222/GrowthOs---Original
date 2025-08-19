import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRecoveryRate, useInactiveStudents, useRecoveryMessages } from '@/hooks/useRecoveryRate';
import { format } from 'date-fns';
import { AlertTriangle, MessageCircle, TrendingUp, Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export const RecoveryManagement = () => {
  const { data: recoveryStats, isLoading: statsLoading } = useRecoveryRate();
  const { data: inactiveStudents, isLoading: inactiveLoading } = useInactiveStudents();
  const { data: recoveryMessages, isLoading: messagesLoading } = useRecoveryMessages();

  const getStatusBadge = (recovery_successful: boolean | null) => {
    if (recovery_successful === true) {
      return <Badge variant="default" className="bg-success text-success-foreground">Recovered</Badge>;
    } else if (recovery_successful === false) {
      return <Badge variant="destructive">Failed</Badge>;
    } else {
      return <Badge variant="secondary">Pending</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">Student Recovery Management</h2>
      </div>

      {/* Recovery Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recovery Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{recoveryStats?.recovery_rate || 0}%</div>
                <p className="text-xs text-muted-foreground">
                  {recoveryStats?.successful_recoveries || 0} of {recoveryStats?.total_messages_sent || 0} messages
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{recoveryStats?.total_messages_sent || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Successful Recoveries</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-success">{recoveryStats?.successful_recoveries || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">At Risk Students</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {inactiveLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-destructive">{inactiveStudents?.length || 0}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="inactive" className="w-full">
        <TabsList>
          <TabsTrigger value="inactive">Inactive Students</TabsTrigger>
          <TabsTrigger value="messages">Recovery Messages</TabsTrigger>
        </TabsList>
        
        <TabsContent value="inactive" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Students at Risk (3+ Days Inactive)</CardTitle>
              <CardDescription>
                Students who haven't been active for 3 or more days and are eligible for recovery messages
              </CardDescription>
            </CardHeader>
            <CardContent>
              {inactiveLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {inactiveStudents?.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No inactive students found. Great job on student engagement!
                    </p>
                  ) : (
                    inactiveStudents?.map((student) => (
                      <div key={student.user_id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <h4 className="font-medium">{student.full_name}</h4>
                          <p className="text-sm text-muted-foreground">{student.email}</p>
                          {student.phone && (
                            <p className="text-sm text-muted-foreground">📱 {student.phone}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className="mb-1">
                            {student.days_inactive} days inactive
                          </Badge>
                          <p className="text-xs text-muted-foreground">
                            Last active: {format(new Date(student.last_active_at), 'MMM dd, yyyy')}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Recovery Messages</CardTitle>
              <CardDescription>
                Track recovery message attempts and their success rates
              </CardDescription>
            </CardHeader>
            <CardContent>
              {messagesLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {recoveryMessages?.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No recovery messages sent yet.
                    </p>
                  ) : (
                    recoveryMessages?.map((message: any) => (
                      <div key={message.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <h4 className="font-medium">{message.user?.full_name || 'Unknown User'}</h4>
                          <p className="text-sm text-muted-foreground">{message.user?.email || 'No email'}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {message.days_inactive} days inactive when messaged
                          </p>
                        </div>
                        <div className="text-right space-y-1">
                          {getStatusBadge(message.recovery_successful)}
                          <p className="text-xs text-muted-foreground">
                            Sent: {format(new Date(message.message_sent_at), 'MMM dd, yyyy HH:mm')}
                          </p>
                          {message.recovered_at && (
                            <p className="text-xs text-success">
                              Recovered: {format(new Date(message.recovered_at), 'MMM dd, yyyy HH:mm')}
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};