import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RoleGuard } from "@/components/RoleGuard";

import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  UserCheck, 
  TrendingUp,
  Calendar,
  Filter
} from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

interface EnrollmentRecord {
  id: string;
  student_name: string;
  student_email: string;
  enrollment_date: string;
  lms_status: 'Active' | 'Inactive' | 'Pending';
  created_by: string;
}

interface DashboardStats {
  totalEnrollments: number;
  activeEnrollments: number;
  pendingEnrollments: number;
  monthlyGrowth: number;
}

const EnrollmentManagerDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats>({
    totalEnrollments: 0,
    activeEnrollments: 0,
    pendingEnrollments: 0,
    monthlyGrowth: 0
  });
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('30'); // days

  // Mock data for now - replace with real Supabase calls later
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock stats based on selected period
      const periodDays = parseInt(selectedPeriod);
      const mockStats = {
        totalEnrollments: 156,
        activeEnrollments: 142,
        pendingEnrollments: 14,
        monthlyGrowth: 12.5
      };
      
      // Filter mock enrollments by period
      const endDate = new Date();
      const startDate = subDays(endDate, periodDays);
      
      const mockEnrollments: EnrollmentRecord[] = [
        {
          id: '1',
          student_name: 'John Doe',
          student_email: 'john@example.com',
          enrollment_date: '2024-01-15',
          lms_status: 'Active' as const,
          created_by: user?.id || ''
        },
        {
          id: '2',
          student_name: 'Jane Smith',
          student_email: 'jane@example.com',
          enrollment_date: '2024-01-14',
          lms_status: 'Active' as const,
          created_by: user?.id || ''
        },
        {
          id: '3',
          student_name: 'Mike Johnson',
          student_email: 'mike@example.com',
          enrollment_date: '2024-01-13',
          lms_status: 'Pending' as const,
          created_by: user?.id || ''
        }
      ].filter(enrollment => {
        const enrollmentDate = new Date(enrollment.enrollment_date);
        return enrollmentDate >= startDate && enrollmentDate <= endDate;
      });
      
      setStats(mockStats);
      setEnrollments(mockEnrollments);
      setLoading(false);
    };

    fetchData();
  }, [selectedPeriod, user?.id]);


  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'Active': return 'default';
      case 'Pending': return 'secondary';
      case 'Inactive': return 'destructive';
      default: return 'outline';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <RoleGuard allowedRoles="enrollment_manager">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Enrollment Dashboard</h1>
            <p className="text-gray-600 mt-1">Manage student enrollments and track performance</p>
          </div>
          
          
        </div>

        {/* Period Filter */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium">Period:</span>
          </div>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[180px]" id="period-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Enrollments</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalEnrollments}</div>
              <p className="text-xs text-muted-foreground">
                All time enrollments
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Students</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.activeEnrollments}</div>
              <p className="text-xs text-muted-foreground">
                Currently active in LMS
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Students</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.pendingEnrollments}</div>
              <p className="text-xs text-muted-foreground">
                Awaiting activation
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Growth</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">+{stats.monthlyGrowth}%</div>
              <p className="text-xs text-muted-foreground">
                Compared to last month
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Enrollments Table */}
        <Card>
          <CardHeader>
            <CardTitle>My Enrollments</CardTitle>
            <CardDescription>
              Students enrolled by you (filtered by selected period)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Enrollment Date</TableHead>
                  <TableHead>LMS Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrollments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                      No enrollments found for the selected period
                    </TableCell>
                  </TableRow>
                ) : (
                  enrollments.map((enrollment) => (
                    <TableRow key={enrollment.id}>
                      <TableCell className="font-medium">{enrollment.student_name}</TableCell>
                      <TableCell>{enrollment.student_email}</TableCell>
                      <TableCell>{format(new Date(enrollment.enrollment_date), 'MMM dd, yyyy')}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(enrollment.lms_status)}>
                          {enrollment.lms_status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </RoleGuard>
  );
};

export default EnrollmentManagerDashboard;