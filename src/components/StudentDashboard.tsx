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
      
      {/* Enhanced Financial Goal Banner */}
      <Card className="bg-gradient-to-r from-primary/20 via-primary/10 to-background border-primary/30 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.01] animate-fade-in">
        <CardContent className="p-8">
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                <span className="text-2xl">🎯</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-primary mb-1">Your Financial Goal</h2>
                <p className="text-sm text-muted-foreground">Track your progress towards financial freedom</p>
              </div>
            </div>
            
            <div className="bg-background/50 rounded-lg p-4 border border-primary/20 hover:border-primary/40 transition-colors">
              <p className="text-lg font-medium text-foreground leading-relaxed">
                {extractFinancialGoalForDisplay(dreamGoal)}
              </p>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">Progress toward your goal</span>
                <span className="text-lg font-bold text-primary animate-pulse">{courseProgress}% complete</span>
              </div>
              <div className="relative">
                <Progress 
                  value={courseProgress} 
                  className="h-3 transition-all duration-1000 ease-out"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent rounded-full pointer-events-none"></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Three-Card Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Course Progress Card */}
        <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-l-4 border-l-blue-500 animate-fade-in">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-3 text-blue-600">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <BarChart3 className="w-5 h-5" />
              </div>
              Course Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-600 mb-2 group-hover:scale-110 transition-transform">
                  {courseProgress}%
                </div>
                <p className="text-sm text-muted-foreground">Complete</p>
              </div>
              <div className="relative">
                <Progress value={courseProgress} className="h-2" />
                <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-transparent rounded-full pointer-events-none"></div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Next Assignment Card */}
        <Card className={`group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-l-4 animate-fade-in ${
          assignmentDueStatus === 'overdue' ? 'border-l-red-500' : 'border-l-orange-500'
        }`}>
          <CardHeader className="pb-3">
            <CardTitle className={`flex items-center gap-3 ${
              assignmentDueStatus === 'overdue' ? 'text-red-600' : 'text-orange-600'
            }`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform ${
                assignmentDueStatus === 'overdue' ? 'bg-red-100 group-hover:bg-red-200' : 'bg-orange-100 group-hover:bg-orange-200'
              }`}>
                <Upload className="w-5 h-5" />
              </div>
              Next Assignment
            </CardTitle>
          </CardHeader>
          <CardContent>
            {nextAssignment ? (
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-foreground mb-2 line-clamp-2 group-hover:text-orange-600 transition-colors">
                    {nextAssignment.name}
                  </h3>
                  <div className="flex items-center gap-2 text-sm">
                    {assignmentDueStatus === 'overdue' ? (
                      <AlertCircle className="w-4 h-4 text-red-500 animate-pulse" />
                    ) : (
                      <Clock className="w-4 h-4 text-orange-500" />
                    )}
                    <span className={`font-medium ${
                      assignmentDueStatus === 'overdue' ? 'text-red-500 animate-pulse' : 'text-orange-500'
                    }`}>
                      {assignmentDueStatus === 'overdue' ? 'Past Due' : 'Due Soon'}
                    </span>
                  </div>
                </div>
                <Button 
                  onClick={handleSubmitAssignment}
                  className={`w-full shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 ${
                    assignmentDueStatus === 'overdue' 
                      ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700' 
                      : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700'
                  } text-white`}
                  variant={assignmentDueStatus === 'overdue' ? 'destructive' : 'default'}
                >
                  Submit Now
                </Button>
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3 animate-pulse" />
                <p className="text-muted-foreground">All assignments completed!</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Integrations Card */}
        <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-l-4 border-l-purple-500 animate-fade-in">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-3 text-purple-600">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                <Zap className="w-5 h-5" />
              </div>
              Integrations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                <div className="flex items-center gap-3">
                  <ShoppingBag className="w-5 h-5 text-green-600" />
                  <span className="font-medium">Shopify</span>
                </div>
                {shopifyConnected ? (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm text-green-600 font-medium">Connected</span>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="hover:bg-green-50 hover:text-green-600 hover:border-green-300 transition-colors">
                    Connect
                  </Button>
                )}
              </div>
              
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  <span className="font-medium">Meta Ads</span>
                </div>
                {metaConnected ? (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm text-green-600 font-medium">Connected</span>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 transition-colors">
                    Connect
                  </Button>
                )}
              </div>
              
              <Button 
                variant="outline" 
                className="w-full hover:bg-purple-50 hover:text-purple-600 hover:border-purple-300 transition-all duration-300"
                onClick={() => setConnectDialogOpen(true)}
              >
                Manage Connections
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Milestones & Leaderboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Milestones Card */}
        <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.01] animate-fade-in">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 flex items-center justify-center shadow-md">
                <Award className="w-5 h-5 text-white" />
              </div>
              <span className="bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent">
                Milestones
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-muted-foreground">Progress</span>
                <span className="text-sm font-bold text-orange-600">
                  {completedMilestones} of {milestones.length} completed
                </span>
              </div>
              <div className="relative">
                <Progress value={(completedMilestones / milestones.length) * 100} className="h-2" />
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/20 to-orange-500/20 rounded-full pointer-events-none"></div>
              </div>
              
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {milestones.map((milestone) => (
                  <div 
                    key={milestone.id} 
                    className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-300 ${
                      milestone.completed 
                        ? 'bg-green-50 border border-green-200 shadow-sm hover:shadow-md' 
                        : 'bg-muted/50 hover:bg-muted'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                      milestone.completed 
                        ? 'bg-green-500 shadow-md' 
                        : 'bg-muted border-2 border-dashed border-muted-foreground/30'
                    }`}>
                      {milestone.completed ? (
                        <CheckCircle className="w-5 h-5 text-white" />
                      ) : (
                        <span className="text-lg">{milestone.icon}</span>
                      )}
                    </div>
                    <span className={`font-medium transition-colors ${
                      milestone.completed ? 'text-green-700' : 'text-foreground'
                    }`}>
                      {milestone.title}
                    </span>
                    {milestone.completed && (
                      <div className="ml-auto">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Your Rank Card */}
        <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.01] animate-fade-in">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center shadow-md">
                <Trophy className="w-5 h-5 text-white" />
              </div>
              <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Your Rank
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {leaderboardPosition ? (
              <div className="text-center space-y-4">
                <div className="relative">
                  <div className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent group-hover:scale-110 transition-transform">
                    #{leaderboardPosition.rank}
                  </div>
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center animate-bounce">
                    <span className="text-xs">🌟</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-lg font-semibold text-foreground">Outstanding performance!</p>
                  <p className="text-sm text-muted-foreground">
                    You're {leaderboardPosition.rank === 1 ? 'leading the pack' : `${leaderboardPosition.rank} of ${leaderboardPosition.total}`}
                  </p>
                </div>
                <div className="flex items-center justify-center space-x-1 mb-4">
                  {[1, 2, 3].map(pos => (
                    <Star 
                      key={pos} 
                      className={`w-6 h-6 transition-all duration-300 ${
                        pos <= 3 && leaderboardPosition.rank <= 3 
                          ? 'text-yellow-500 fill-current animate-pulse' 
                          : 'text-muted'
                      }`} 
                    />
                  ))}
                </div>
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg border border-purple-200">
                  <div className="flex items-center justify-center gap-2 text-sm font-medium text-purple-700">
                    <Star className="w-4 h-4 fill-current" />
                    Keep climbing higher!
                    <Star className="w-4 h-4 fill-current" />
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => navigate('/leaderboard')}
                  className="w-full hover:bg-purple-50 hover:text-purple-600 hover:border-purple-300 transition-all duration-300"
                >
                  View Full Leaderboard
                </Button>
              </div>
            ) : (
              <div className="text-center py-8 space-y-4">
                <div className="w-16 h-16 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full mx-auto flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Target className="w-8 h-8 text-purple-500" />
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-2">Start Your Journey</p>
                  <p className="text-sm text-muted-foreground">
                    Complete activities and engage with content to climb the leaderboard
                  </p>
                </div>
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-3 rounded-lg border border-purple-200">
                  <p className="text-sm text-purple-700 font-medium">Ready to make your mark? 🚀</p>
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