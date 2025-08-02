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
import { useToast } from '@/hooks/use-toast';
import { formatDreamGoalForDisplay } from '@/utils/dreamGoalUtils';
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
  Star
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
      const { data: userData } = await supabase
        .from('users')
        .select('dream_goal_summary, shopify_credentials, meta_ads_credentials')
        .eq('id', user.id)
        .single();

      if (userData) {
        setDreamGoal(userData.dream_goal_summary || '');
        setShopifyConnected(!!userData.shopify_credentials);
        setMetaConnected(!!userData.meta_ads_credentials);
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
        { id: '3', title: 'Shopify Connected', completed: !!userData?.shopify_credentials, icon: '🛒' },
        { id: '4', title: '50% Course Complete', completed: courseProgress >= 50, icon: '🎯' },
        { id: '5', title: 'Meta Ads Connected', completed: !!userData?.meta_ads_credentials, icon: '📊' }
      ]);

      // Fetch leaderboard position
      const { data: leaderboard } = await supabase
        .from('leaderboard')
        .select('rank, user_id')
        .order('rank', { ascending: true });

      const userRank = leaderboard?.find(l => l.user_id === user.id);
      if (userRank && leaderboard) {
        setLeaderboardPosition({ rank: userRank.rank, total: leaderboard.length });
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
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
      {/* Top Full-Width Goal Banner */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-primary mb-2">Your Personal Goal</h2>
              <p className="text-foreground text-base leading-relaxed">
                {formatDreamGoalForDisplay(dreamGoal)}
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Progress toward your goal</span>
                <span className="text-sm font-bold text-primary">{courseProgress}% toward your goal</span>
              </div>
              <Progress value={courseProgress} className="h-3" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Three-Card Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Card - Course Progress */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-lg">
              <BarChart3 className="w-5 h-5 mr-2 text-blue-600" />
              Course Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600 mb-1">{courseProgress}%</div>
            <p className="text-sm text-muted-foreground">Complete</p>
            <div className="mt-3">
              <Progress value={courseProgress} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Center Card - Next Assignment */}
        <Card className={`border-2 ${assignmentDueStatus === 'overdue' ? 'border-destructive' : 'border-green-500'}`}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-lg">
              <Upload className="w-5 h-5 mr-2" />
              Next Assignment
            </CardTitle>
          </CardHeader>
          <CardContent>
            {nextAssignment ? (
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold">{nextAssignment.name}</h3>
                  <div className="flex items-center mt-1">
                    {assignmentDueStatus === 'overdue' ? (
                      <AlertCircle className="w-4 h-4 mr-1 text-destructive" />
                    ) : (
                      <Clock className="w-4 h-4 mr-1 text-green-600" />
                    )}
                    <span className={`text-sm ${assignmentDueStatus === 'overdue' ? 'text-destructive' : 'text-green-600'}`}>
                      {assignmentDueStatus === 'overdue' ? 'Past Due' : 'Due Soon'}
                    </span>
                  </div>
                </div>
                <Button 
                  onClick={handleSubmitAssignment}
                  className="w-full"
                  variant={assignmentDueStatus === 'overdue' ? 'destructive' : 'default'}
                >
                  Submit Now
                </Button>
              </div>
            ) : (
              <div className="text-center py-4">
                <CheckCircle className="w-8 h-8 mx-auto text-green-600 mb-2" />
                <p className="text-sm text-muted-foreground">All assignments complete!</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Card - Connect Accounts */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-lg">
              <Target className="w-5 h-5 mr-2 text-purple-600" />
              Integrations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  <span className="text-sm">Shopify</span>
                </div>
                <Badge variant={shopifyConnected ? "default" : "secondary"} className={shopifyConnected ? "bg-green-100 text-green-800" : ""}>
                  {shopifyConnected ? "Connected" : "Connect"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  <span className="text-sm">Meta Ads</span>
                </div>
                <Badge variant={metaConnected ? "default" : "secondary"} className={metaConnected ? "bg-green-100 text-green-800" : ""}>
                  {metaConnected ? "Connected" : "Connect"}
                </Badge>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full mt-2"
                onClick={() => setConnectDialogOpen(true)}
              >
                Manage Connections
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Milestones & Leaderboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Milestones */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Award className="w-5 h-5 mr-2 text-orange-600" />
              Milestones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Progress</span>
                <span className="text-sm text-muted-foreground">{completedMilestones} of {milestones.length} completed</span>
              </div>
              <Progress value={(completedMilestones / milestones.length) * 100} className="h-2" />
              
              <div className="space-y-2">
                {milestones.slice(0, 4).map(milestone => (
                  <div key={milestone.id} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="text-lg mr-2">{milestone.icon}</span>
                      <span className={`text-sm ${milestone.completed ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {milestone.title}
                      </span>
                    </div>
                    {milestone.completed ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-muted" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Column - Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Trophy className="w-5 h-5 mr-2 text-yellow-600" />
              Your Rank
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4">
              {leaderboardPosition ? (
                <>
                  <div>
                    <div className="text-3xl font-bold text-yellow-600 mb-1">#{leaderboardPosition.rank}</div>
                    <p className="text-sm text-muted-foreground">
                      You're {leaderboardPosition.rank === 1 ? 'in 1st place' : `${leaderboardPosition.rank} of ${leaderboardPosition.total}`}
                    </p>
                  </div>
                  <div className="flex items-center justify-center space-x-1">
                    {[1, 2, 3].map(pos => (
                      <Star 
                        key={pos} 
                        className={`w-6 h-6 ${pos <= 3 && leaderboardPosition.rank <= 3 ? 'text-yellow-500 fill-current' : 'text-muted'}`} 
                      />
                    ))}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => navigate('/leaderboard')}
                    className="w-full"
                  >
                    View Full Leaderboard
                  </Button>
                </>
              ) : (
                <div className="py-8">
                  <Trophy className="w-12 h-12 mx-auto text-muted mb-4" />
                  <p className="text-sm text-muted-foreground">Complete more activities to join the leaderboard!</p>
                </div>
              )}
            </div>
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