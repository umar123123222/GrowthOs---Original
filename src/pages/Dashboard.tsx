
import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConnectAccountsDialog } from "@/components/ConnectAccountsDialog";
import { NextAssignment } from "@/components/NextAssignment";
import { DreamGoalCard } from "@/components/DreamGoalCard";
import { StudentDashboard } from "@/components/StudentDashboard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { generateDreamGoalSummary } from "@/utils/dreamGoalUtils";
import { 
  BookOpen, 
  FileText, 
  Star, 
  Clock,
  TrendingUp,
  Trophy,
  Target,
  Zap
} from "lucide-react";
import { safeQuery } from '@/lib/database-safety';
import { logger } from '@/lib/logger';

const Dashboard = ({ user }: { user?: any }) => {
  // For students, show the specialized student dashboard
  if (user?.role === 'student') {
    return <StudentDashboard />;
  }
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [shopifyConnected, setShopifyConnected] = useState(false);
  const [metaConnected, setMetaConnected] = useState(false);
  const [dreamGoalSummary, setDreamGoalSummary] = useState<string | null>(null);
  const [questionnaireOpen, setQuestionnaireOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Fetch connection status when component mounts or user changes
  useEffect(() => {
    const fetchConnectionStatus = async () => {
      if (user?.id) {
        try {
          const result = await safeQuery(
            supabase
              .from('users')
            .select('shopify_credentials, meta_ads_credentials, dream_goal_summary')
            .eq('id', user.id)
            .maybeSingle() as any,
            `fetch connection status for user ${user.id}`
          );

          if (!result.success) throw result.error;
          const data = result.data as any;

          setShopifyConnected(!!data?.shopify_credentials);
          setMetaConnected(!!data?.meta_ads_credentials);
          setDreamGoalSummary(data?.dream_goal_summary || null);
        } catch (error) {
          logger.error('Error fetching connection status:', error);
        }
      }
    };

    fetchConnectionStatus();
  }, [user?.id]);

  // Refetch connection status when dialog closes
  const handleDialogClose = (open: boolean) => {
    setConnectDialogOpen(open);
    if (!open && user?.id) {
      // Refetch status when dialog closes
      setTimeout(async () => {
        try {
          const { data, error } = await supabase
            .from('users')
            .select('shopify_credentials, meta_ads_credentials, dream_goal_summary')
            .eq('id', user.id)
            .maybeSingle();

          if (error) throw error;

          setShopifyConnected(!!data?.shopify_credentials);
          setMetaConnected(!!data?.meta_ads_credentials);
          setDreamGoalSummary(data?.dream_goal_summary || null);
        } catch (error) {
          console.error('Error refetching connection status:', error);
        }
      }, 500);
    }
  };
  
  const [progressData, setProgressData] = useState({
    videosWatched: 0,
    totalVideos: 0,
    assignmentsCompleted: 0,
    totalAssignments: 0,
    overallProgress: 0
  });

  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [milestones, setMilestones] = useState([
    { title: "First Login", completed: false, icon: "🎯" },
    { title: "Profile Complete", completed: false, icon: "✅" },
    { title: "First Video Watched", completed: false, icon: "📹" },
    { title: "First Assignment", completed: false, icon: "📝" },
    { title: "Quiz Master", completed: false, icon: "🧠" },
    { title: "Store Live", completed: false, icon: "🛒" },
    { title: "First Sale", completed: false, icon: "💰" }
  ]);
  const [nextAssignment, setNextAssignment] = useState<any>(null);
  

  // Fetch real data when user is available - optimize by batching requests
  useEffect(() => {
    if (user?.id) {
      // Use a single effect to fetch all data concurrently
      Promise.allSettled([
        fetchProgressData(),
        fetchLeaderboardData(),
        fetchMilestones(),
        fetchNextAssignment()
      ]).then(results => {
        // Log any errors but don't fail the entire operation
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            console.warn(`Dashboard data fetch ${index} failed:`, result.reason);
          }
        });
      });
    }
  }, [user?.id]);


  const fetchProgressData = async () => {
    if (!user?.id) return;

    try {
      // Fetch total recordings
      const { data: recordings } = await supabase
        .from('available_lessons')
        .select('id');

      // Fetch unique watched recordings (distinct by recording_id)
      const { data: watchedRecordings } = await supabase
        .from('recording_views')
        .select('recording_id')
        .eq('user_id', user.id)
        .eq('watched', true);

      // Fetch total assignments
      const { data: assignments } = await supabase
        .from('assignments')
        .select('id');

      // Fetch completed assignments
      const { data: completedAssignments } = await supabase
        .from('submissions')
        .select('assignment_id')
        .eq('student_id', user.id)
        .eq('status', 'approved');

      const totalVideos = recordings?.length || 0;
      // Count unique videos watched by creating a Set of recording_ids
      const uniqueWatchedVideos = watchedRecordings 
        ? [...new Set(watchedRecordings.map(r => r.recording_id))] 
        : [];
      const videosWatched = uniqueWatchedVideos.length;
      const totalAssignments = assignments?.length || 0;
      const assignmentsCompleted = completedAssignments?.length || 0;
      
      const overallProgress = totalVideos > 0 
        ? Math.round(((videosWatched + assignmentsCompleted) / (totalVideos + totalAssignments)) * 100)
        : 0;

      setProgressData({
        videosWatched,
        totalVideos,
        assignmentsCompleted,
        totalAssignments,
        overallProgress
      });
    } catch (error) {
      console.error('Error fetching progress data:', error);
    }
  };

  const fetchLeaderboardData = async () => {
    try {
      // Leaderboard table doesn't exist yet, use placeholder data
      const placeholderData = [
        { name: 'Alex M.', score: 95, rank: 1 },
        { name: 'Sarah K.', score: 87, rank: 2 },
        { name: 'John D.', score: 82, rank: 3 },
        { name: 'Emily R.', score: 78, rank: 4 },
        { name: 'Mike S.', score: 74, rank: 5 }
      ];
      setLeaderboardData(placeholderData);
    } catch (error) {
      console.error('Error fetching leaderboard data:', error);
    }
  };

  const fetchMilestones = async () => {
    if (!user?.id) return;

    try {
      // Check profile completion  
      const { data: profile } = await supabase
        .from('users')
        .select('dream_goal_summary, shopify_credentials, meta_ads_credentials')
        .eq('id', user.id)
        .maybeSingle();

      // Check if watched any video (unique videos only)
      const { data: watchedVideos } = await supabase
        .from('recording_views')
        .select('recording_id')
        .eq('user_id', user.id)
        .eq('watched', true);

      const hasWatchedAnyVideo = watchedVideos && [...new Set(watchedVideos.map(v => v.recording_id))].length > 0;

      // Check if submitted any assignment
      const { data: submissions } = await supabase
        .from('submissions')
        .select('id')
        .eq('student_id', user.id)
        .limit(1);

      setMilestones([
        { title: "First Login", completed: true, icon: "🎯" }, // User is logged in
        { title: "Profile Complete", completed: !!(profile?.dream_goal_summary), icon: "✅" },
        { title: "First Video Watched", completed: hasWatchedAnyVideo, icon: "📹" },
        { title: "First Assignment", completed: (submissions?.length || 0) > 0, icon: "📝" },
        { title: "Quiz Master", completed: false, icon: "🧠" }, // Would need quiz data
        { title: "Store Live", completed: !!(profile?.shopify_credentials), icon: "🛒" },
        { title: "First Sale", completed: false, icon: "💰" } // Would need sales data
      ]);
    } catch (error) {
      console.error('Error fetching milestones:', error);
    }
  };

  const fetchNextAssignment = async () => {
    if (!user?.id) return;

    try {
      // Get assignments not yet submitted - simplified for new schema
      const { data: allAssignments } = await supabase
        .from('assignments')
        .select('*')
        .order('name');

      const { data: userSubmissions } = await supabase
        .from('submissions')
        .select('assignment_id')
        .eq('student_id', user.id);

      const submittedAssignmentIds = userSubmissions?.map(s => s.assignment_id) || [];
      const pendingAssignments = allAssignments?.filter(a => !submittedAssignmentIds.includes(a.id)) || [];

      if (pendingAssignments.length > 0) {
        setNextAssignment(pendingAssignments[0]);
      }
    } catch (error) {
      console.error('Error fetching next assignment:', error);
    }
  };

  const handleConnectAccounts = useCallback(() => {
    setConnectDialogOpen(true);
  }, []);

  const handleEditGoal = useCallback(() => {
    // For now, just show a placeholder message
    // In a full implementation, this would open a questionnaire modal
    toast({
      title: "Coming Soon",
      description: "Dream goal editing questionnaire will be available soon!",
    });
  }, [toast]);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Welcome back! 👋</h1>
        <p className="text-muted-foreground mt-2 text-sm sm:text-base">Ready to continue your journey to success?</p>
      </div>

      {/* Dream Goal Card */}
      <DreamGoalCard 
        dreamGoalSummary={dreamGoalSummary}
        onEditGoal={handleEditGoal}
      />

      {/* Overall Progress Card */}
      <Card className="gradient-hero text-white border-0 shadow-elevated overflow-hidden relative">
        <div className="absolute inset-0 bg-white/10 backdrop-blur-sm"></div>
        <CardContent className="p-6 relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold mb-2">Your Progress 🚀</h3>
              <p className="text-white/90 mb-4 text-base">
                Keep pushing forward to reach your goals!
              </p>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 bg-white/20 rounded-full px-3 py-1">
                  <BookOpen className="w-4 h-4" />
                  <span className="text-sm font-medium">{progressData.videosWatched} Videos</span>
                </div>
                <div className="flex items-center space-x-2 bg-white/20 rounded-full px-3 py-1">
                  <FileText className="w-4 h-4" />
                  <span className="text-sm font-medium">{progressData.assignmentsCompleted} Assignments</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold mb-1">{progressData.overallProgress}%</div>
              <div className="text-white/80 text-sm">Complete</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Progress Tracker */}
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
              Progress Tracker
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Videos Watched</span>
                <span className="text-sm text-gray-600">
                  {progressData.videosWatched}/{progressData.totalVideos}
                </span>
              </div>
              <Progress value={(progressData.videosWatched / progressData.totalVideos) * 100} />
            </div>
            
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Assignments Done</span>
                <span className="text-sm text-gray-600">
                  {progressData.assignmentsCompleted}/{progressData.totalAssignments}
                </span>
              </div>
              <Progress value={(progressData.assignmentsCompleted / progressData.totalAssignments) * 100} />
            </div>
          </CardContent>
        </Card>

        {/* Next Assignment */}
        <div className="h-full">
          <NextAssignment userId={user?.id} />
        </div>

        {/* Store Status */}
        <Card className="h-full flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Zap className="w-5 h-5 mr-2 text-green-600" />
              Store Status
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col flex-grow">
            <div className="space-y-3 flex-grow">
              <div className="flex items-center justify-between">
                <span className="text-sm">Shopify Store</span>
                <Badge 
                  variant={shopifyConnected ? "default" : "secondary"}
                  className={shopifyConnected ? "bg-green-100 text-green-800" : ""}
                >
                  {shopifyConnected ? "Connected" : "Not Connected"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Meta Ads</span>
                <Badge 
                  variant={metaConnected ? "default" : "secondary"}
                  className={metaConnected ? "bg-green-100 text-green-800" : ""}
                >
                  {metaConnected ? "Connected" : "Not Connected"}
                </Badge>
              </div>
            </div>
            <div className="mt-auto pt-4">
              <Button 
                variant="outline" 
                className="w-full" 
                size="sm"
                onClick={() => setConnectDialogOpen(true)}
              >
                Connect Accounts
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Milestones Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Target className="w-5 h-5 mr-2 text-purple-600" />
              Milestones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {milestones.map((milestone, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <span className="text-lg">{milestone.icon}</span>
                  <span className={`flex-1 ${milestone.completed ? 'text-gray-900' : 'text-gray-500'}`}>
                    {milestone.title}
                  </span>
                  {milestone.completed ? (
                    <Badge className="bg-green-100 text-green-800">✓</Badge>
                  ) : (
                    <Badge variant="outline">Pending</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Trophy className="w-5 h-5 mr-2 text-yellow-600" />
              Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
                {leaderboardData.map((student, index) => (
                <div key={index} className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                  student.name === "You" ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/50"
                }`}>
                  <div className="flex items-center space-x-3">
                    <span className="font-bold text-lg" role="img" aria-label={`Rank ${student.rank}`}>
                      {student.rank === 1 ? "🥇" : student.rank === 2 ? "🥈" : student.rank === 3 ? "🥉" : `#${student.rank}`}
                    </span>
                    <span className={`font-medium ${student.name === "You" ? "text-primary" : "text-foreground"}`}>
                      {student.name}
                    </span>
                  </div>
                  <span className="font-semibold text-muted-foreground">{student.score}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <ConnectAccountsDialog 
        open={connectDialogOpen} 
        onOpenChange={handleDialogClose} 
        userId={user?.id}
      />
    </div>
  );
};

export default Dashboard;
