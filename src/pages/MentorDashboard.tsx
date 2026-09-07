import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RoleGuard } from '@/components/RoleGuard';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { MentorStudents } from '@/components/mentor/MentorStudents';
import { MessageSquare, Clock, CheckCircle } from 'lucide-react';

export default function MentorDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    pendingReviews: 0,
    checkedAssignments: 0,
    sessionsMentored: 0
  });

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user]);

  const fetchStats = async () => {
    if (!user) return;
    try {
      // First get mentor's assigned courses
      const { data: courseAssignments } = await supabase
        .from('mentor_course_assignments')
        .select('course_id, is_global')
        .eq('mentor_id', user.id);

      const isGlobalMentor = courseAssignments?.some(a => a.is_global) || false;
      const assignedCourseIds = courseAssignments
        ?.filter(a => a.course_id)
        .map(a => a.course_id) || [];

      // If no courses assigned and not global, return zeros
      if (!isGlobalMentor && assignedCourseIds.length === 0) {
        setStats({ pendingReviews: 0, checkedAssignments: 0, sessionsMentored: 0 });
        return;
      }

      // Get assignments for mentor's courses
      let assignmentIds: string[] = [];
      if (isGlobalMentor) {
        const { data: allAssignments } = await supabase
          .from('assignments')
          .select('id');
        assignmentIds = allAssignments?.map(a => a.id) || [];
      } else if (assignedCourseIds.length > 0) {
        const { data: courseAssignmentsData } = await supabase
          .from('assignments')
          .select('id')
          .in('course_id', assignedCourseIds);
        assignmentIds = courseAssignmentsData?.map(a => a.id) || [];
      }

      // Fetch pending submissions for mentor's assignments
      let pendingCount = 0;
      let checkedCount = 0;

      if (assignmentIds.length > 0) {
        const { data: pendingSubmissions } = await supabase
          .from('submissions')
          .select('id')
          .eq('status', 'pending')
          .in('assignment_id', assignmentIds);

        const { data: checkedSubmissions } = await supabase
          .from('submissions')
          .select('id')
          .eq('status', 'approved')
          .in('assignment_id', assignmentIds);

        pendingCount = pendingSubmissions?.length || 0;
        checkedCount = checkedSubmissions?.length || 0;
      }

      // Count completed sessions from success_sessions
      let sessionsCount = 0;
      if (isGlobalMentor) {
        const { data: sessions } = await supabase
          .from('success_sessions')
          .select('id')
          .eq('status', 'completed');
        sessionsCount = sessions?.length || 0;
      } else if (assignedCourseIds.length > 0) {
        const { data: sessions } = await supabase
          .from('success_sessions')
          .select('id')
          .eq('status', 'completed')
          .in('course_id', assignedCourseIds);
        sessionsCount = sessions?.length || 0;
      }

      setStats({
        pendingReviews: pendingCount,
        checkedAssignments: checkedCount,
        sessionsMentored: sessionsCount
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      setStats({
        pendingReviews: 0,
        checkedAssignments: 0,
        sessionsMentored: 0
      });
    }
  };

  return (
    <RoleGuard allowedRoles={['mentor']}>
      <div className="dashboard-page">
        <div className="page-heading">
          <div>
            <h1>Mentor Dashboard</h1>
            <p className="text-muted-foreground">Guide, support, and nurture your students' growth</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Metric Cards */}
          <div className="metric-grid">
            <Card className="dashboard-metric">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Assignments Pending Reviews</CardTitle>
                <Clock className="h-4 w-4 text-warning" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.pendingReviews}</div>
                <p className="text-xs text-muted-foreground">Awaiting your feedback</p>
              </CardContent>
            </Card>

            <Card className="dashboard-metric">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Assignments Checked</CardTitle>
                <CheckCircle className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.checkedAssignments}</div>
                <p className="text-xs text-muted-foreground">Feedback provided</p>
              </CardContent>
            </Card>

            <Card className="dashboard-metric">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Sessions Mentored</CardTitle>
                <MessageSquare className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.sessionsMentored}</div>
                <p className="text-xs text-muted-foreground">This month</p>
              </CardContent>
            </Card>
          </div>

          {/* My Students Section */}
          <div className="mt-6">
            <MentorStudents />
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}