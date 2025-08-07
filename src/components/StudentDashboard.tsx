import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ConnectAccountsDialog } from '@/components/ConnectAccountsDialog';
import { useAuth } from '@/hooks/useAuth';
import { useStudentRecordings } from '@/hooks/useStudentRecordings';
import { supabase } from '@/integrations/supabase/client';
import { InactiveLMSBanner } from '@/components/InactiveLMSBanner';
import { useToast } from '@/hooks/use-toast';
import { extractFinancialGoalForDisplay } from '@/utils/dreamGoalUtils';
import { safeQuery } from '@/lib/database-safety';
import { logger } from '@/lib/logger';
import { 
  Trophy, 
  Target, 
  Clock, 
  ShoppingCart, 
  BarChart3,
  Upload,
  CheckCircle,
  AlertCircle,
  Award,
  Star,
  Zap,
  ShoppingBag,
  TrendingUp
} from 'lucide-react';

interface Assignment {
  id: string;
  name: string;
  description?: string;
  due_days?: number;
  created_at?: string;
}

interface Milestone {
  id: string;
  title: string;
  completed: boolean;
  icon: string;
}

export function StudentDashboard() {
  const { user } = useAuth();
  const { recordings, loading } = useStudentRecordings();
  const navigate = useNavigate();
  const { toast } = useToast();

  // State
  const [dreamGoal, setDreamGoal] = useState<string>('');
  const [courseProgress, setCourseProgress] = useState(0);
  const [nextAssignment, setNextAssignment] = useState<Assignment | null>(null);
  const [assignmentDueStatus, setAssignmentDueStatus] = useState<'future' | 'overdue'>('future');
  const [shopifyConnected, setShopifyConnected] = useState(false);
  const [metaConnected, setMetaConnected] = useState(false);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [leaderboardPosition, setLeaderboardPosition] = useState<{ rank: number; total: number } | null>(null);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [userLMSStatus, setUserLMSStatus] = useState<string>('active');

  // Fetch all dashboard data
  useEffect(() => {
    if (user?.id) {
      fetchDashboardData();
    }
  }, [user?.id, recordings]);

  const fetchDashboardData = async () => {
    if (!user?.id) return;

    try {
      // Fetch user data including dream goal and connections
      const userResult = await safeQuery(
        supabase
          .from('users')
          .select('dream_goal_summary, shopify_credentials, meta_ads_credentials, lms_status')
          .eq('id', user.id)
          .single() as any,
        `fetch user data for dashboard ${user.id}`
      );

      if (userResult.data) {
        const userData = userResult.data as any;
        setDreamGoal(userData.dream_goal_summary || '');
        setShopifyConnected(!!userData.shopify_credentials);
        setMetaConnected(!!userData.meta_ads_credentials);
        setUserLMSStatus(userData.lms_status || 'active');
      }

      // Calculate course progress
      if (recordings.length > 0) {
        const watchedRecordings = recordings.filter(r => r.isWatched).length;
        const submittedAssignments = recordings.filter(r => r.hasAssignment && r.assignmentSubmitted).length;
        const totalItems = recordings.length + recordings.filter(r => r.hasAssignment).length;
        const completedItems = watchedRecordings + submittedAssignments;
        setCourseProgress(totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0);
      }

      // Fetch next assignment
      const { data: assignments } = await supabase
        .from('assignments')
        .select('*')
        .order('created_at', { ascending: true });

      const { data: submissions } = await supabase
        .from('submissions')
        .select('assignment_id')
        .eq('student_id', user.id);

      const submittedIds = submissions?.map(s => s.assignment_id) || [];
      const pendingAssignments = assignments?.filter(a => !submittedIds.includes(a.id)) || [];
      
      if (pendingAssignments.length > 0) {
        setNextAssignment(pendingAssignments[0]);
        // Check if assignment is overdue (simplified - using created_at + 7 days)
        const dueDate = new Date(pendingAssignments[0].created_at || '');
        dueDate.setDate(dueDate.getDate() + (pendingAssignments[0].due_days || 7));
        setAssignmentDueStatus(new Date() > dueDate ? 'overdue' : 'future');
      }

      // Fetch milestones
      const { data: watchedVideos } = await supabase
        .from('recording_views')
        .select('recording_id')
        .eq('user_id', user.id)
        .eq('watched', true);

      const uniqueWatchedVideos = [...new Set(watchedVideos?.map(v => v.recording_id) || [])];

      setMilestones([
        { id: '1', title: 'First Video Watched', completed: uniqueWatchedVideos.length > 0, icon: '📹' },
        { id: '2', title: 'First Assignment Submitted', completed: submittedIds.length > 0, icon: '📝' },
        { id: '3', title: 'Shopify Connected', completed: !!((userResult.data as any)?.shopify_credentials), icon: '🛒' },
        { id: '4', title: '50% Course Complete', completed: courseProgress >= 50, icon: '🎯' },
        { id: '5', title: 'Meta Ads Connected', completed: !!((userResult.data as any)?.meta_ads_credentials), icon: '📊' }
      ]);

      // Skip leaderboard for now since table doesn't exist
      // We'll implement this later when the leaderboard table is properly created

    } catch (error) {
      logger.error('Error fetching dashboard data:', error);
    }
  };

  const handleSubmitAssignment = () => {
    if (nextAssignment) {
      navigate('/assignments');
    }
  };

  const completedMilestones = milestones.filter(m => m.completed).length;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Loading your dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <InactiveLMSBanner show={user?.role === 'student' && userLMSStatus === 'inactive'} />
      
      {/* Refined Financial Goal Banner */}
      <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border-primary/20 shadow-sm hover:shadow-md transition-all duration-300 animate-fade-in">
        <CardContent className="p-6">
          <div className="space-y-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xl">🎯</span>
              </div>
              <div>
                <h2 className="text-xl font-medium text-primary mb-1">Your Financial Goal</h2>
                <p className="text-xs text-muted-foreground">Track your progress towards financial freedom</p>
              </div>
            </div>
            
            <div className="bg-background/80 rounded-lg p-4 border border-primary/10">
              <p className="text-base font-normal text-foreground leading-relaxed">
                {extractFinancialGoalForDisplay(dreamGoal)}
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-normal text-muted-foreground">Progress toward your goal</span>
                <span className="text-sm font-medium text-primary">{courseProgress}% complete</span>
              </div>
              <div className="relative">
                <Progress 
                  value={courseProgress} 
                  className="h-1.5 transition-all duration-1000 ease-out"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Refined Three-Card Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Course Progress Card */}
        <Card className="hover:shadow-md transition-all duration-300 border-l-2 border-l-blue-400 animate-fade-in">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-blue-600 text-base font-medium">
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                <BarChart3 className="w-4 h-4" />
              </div>
              Course Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="text-center">
                <div className="text-3xl font-medium text-blue-600 mb-1">
                  {courseProgress}%
                </div>
                <p className="text-xs text-muted-foreground">Complete</p>
              </div>
              <Progress value={courseProgress} className="h-1.5" />
            </div>
          </CardContent>
        </Card>

        {/* Next Assignment Card */}
        <Card className={`hover:shadow-md transition-all duration-300 border-l-2 animate-fade-in ${
          assignmentDueStatus === 'overdue' ? 'border-l-red-400' : 'border-l-orange-400'
        }`}>
          <CardHeader className="pb-3">
            <CardTitle className={`flex items-center gap-2 text-base font-medium ${
              assignmentDueStatus === 'overdue' ? 'text-red-600' : 'text-orange-600'
            }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                assignmentDueStatus === 'overdue' ? 'bg-red-50' : 'bg-orange-50'
              }`}>
                <Upload className="w-4 h-4" />
              </div>
              Next Assignment
            </CardTitle>
          </CardHeader>
          <CardContent>
            {nextAssignment ? (
              <div className="space-y-3">
                <div>
                  <h3 className="font-normal text-foreground mb-2 line-clamp-2">
                    {nextAssignment.name}
                  </h3>
                  <div className="flex items-center gap-2 text-xs">
                    {assignmentDueStatus === 'overdue' ? (
                      <AlertCircle className="w-3 h-3 text-red-500" />
                    ) : (
                      <Clock className="w-3 h-3 text-orange-500" />
                    )}
                    <span className={`font-normal ${
                      assignmentDueStatus === 'overdue' ? 'text-red-500' : 'text-orange-500'
                    }`}>
                      {assignmentDueStatus === 'overdue' ? 'Past Due' : 'Due Soon'}
                    </span>
                  </div>
                </div>
                <Button 
                  onClick={handleSubmitAssignment}
                  className="w-full text-sm font-normal"
                  variant={assignmentDueStatus === 'overdue' ? 'destructive' : 'default'}
                  size="sm"
                >
                  Submit Now
                </Button>
              </div>
            ) : (
              <div className="text-center py-6">
                <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">All assignments completed!</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Integrations Card */}
        <Card className="hover:shadow-md transition-all duration-300 border-l-2 border-l-purple-400 animate-fade-in">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-purple-600 text-base font-medium">
              <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center">
                <Zap className="w-4 h-4" />
              </div>
              Integrations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-green-600" />
                  <span className="font-normal text-sm">Shopify</span>
                </div>
                {shopifyConnected ? (
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                    <span className="text-xs text-green-600">Connected</span>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="text-xs h-6 px-2">
                    Connect
                  </Button>
                )}
              </div>
              
              <div className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  <span className="font-normal text-sm">Meta Ads</span>
                </div>
                {metaConnected ? (
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                    <span className="text-xs text-green-600">Connected</span>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="text-xs h-6 px-2">
                    Connect
                  </Button>
                )}
              </div>
              
              <Button 
                variant="outline" 
                size="sm"
                className="w-full text-xs font-normal"
                onClick={() => setConnectDialogOpen(true)}
              >
                Manage Connections
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Refined Milestones & Leaderboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Milestones Card */}
        <Card className="hover:shadow-md transition-all duration-300 animate-fade-in">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-yellow-100 to-orange-100 flex items-center justify-center">
                <Award className="w-4 h-4 text-orange-600" />
              </div>
              <span className="text-base font-medium text-orange-600">
                Milestones
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-normal text-muted-foreground">Progress</span>
                <span className="text-xs font-medium text-orange-600">
                  {completedMilestones} of {milestones.length} completed
                </span>
              </div>
              <Progress value={(completedMilestones / milestones.length) * 100} className="h-1.5" />
              
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {milestones.map((milestone) => (
                  <div 
                    key={milestone.id} 
                    className={`flex items-center gap-2 p-2 rounded-md transition-all duration-300 ${
                      milestone.completed 
                        ? 'bg-green-50/50 border border-green-100' 
                        : 'bg-muted/20'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 ${
                      milestone.completed 
                        ? 'bg-green-500' 
                        : 'bg-muted border border-muted-foreground/20'
                    }`}>
                      {milestone.completed ? (
                        <CheckCircle className="w-3 h-3 text-white" />
                      ) : (
                        <span className="text-sm">{milestone.icon}</span>
                      )}
                    </div>
                    <span className={`font-normal text-sm transition-colors ${
                      milestone.completed ? 'text-green-700' : 'text-foreground'
                    }`}>
                      {milestone.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Your Rank Card */}
        <Card className="hover:shadow-md transition-all duration-300 animate-fade-in">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-100 to-pink-100 flex items-center justify-center">
                <Trophy className="w-4 h-4 text-purple-600" />
              </div>
              <span className="text-base font-medium text-purple-600">
                Your Rank
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {leaderboardPosition ? (
              <div className="text-center space-y-3">
                <div className="relative">
                  <div className="text-4xl font-medium text-purple-600">
                    #{leaderboardPosition.rank}
                  </div>
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-200 rounded-full flex items-center justify-center">
                    <span className="text-xs">⭐</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-base font-medium text-foreground">Great progress!</p>
                  <p className="text-xs text-muted-foreground">
                    You're {leaderboardPosition.rank === 1 ? 'leading the pack' : `${leaderboardPosition.rank} of ${leaderboardPosition.total}`}
                  </p>
                </div>
                <div className="flex items-center justify-center space-x-1 mb-3">
                  {[1, 2, 3].map(pos => (
                    <Star 
                      key={pos} 
                      className={`w-4 h-4 transition-all duration-300 ${
                        pos <= 3 && leaderboardPosition.rank <= 3 
                          ? 'text-yellow-500 fill-current' 
                          : 'text-muted'
                      }`} 
                    />
                  ))}
                </div>
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-3 rounded-md border border-purple-100">
                  <div className="flex items-center justify-center gap-1 text-xs font-normal text-purple-700">
                    <Star className="w-3 h-3 fill-current" />
                    Keep up the great work!
                    <Star className="w-3 h-3 fill-current" />
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => navigate('/leaderboard')}
                  className="w-full text-xs font-normal"
                >
                  View Full Leaderboard
                </Button>
              </div>
            ) : (
              <div className="text-center py-6 space-y-3">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-50 to-pink-50 rounded-full mx-auto flex items-center justify-center">
                  <Target className="w-6 h-6 text-purple-500" />
                </div>
                <div>
                  <p className="font-medium text-foreground mb-1">Start Your Journey</p>
                  <p className="text-xs text-muted-foreground">
                    Complete activities to see your ranking
                  </p>
                </div>
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-2 rounded-md border border-purple-100">
                  <p className="text-xs text-purple-700 font-normal">Ready to climb the leaderboard? 🚀</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Connect Accounts Dialog */}
      <ConnectAccountsDialog 
        open={connectDialogOpen}
        onOpenChange={setConnectDialogOpen}
        userId={user?.id}
      />
    </div>
  );
}