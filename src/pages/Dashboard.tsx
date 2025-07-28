
import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConnectAccountsDialog } from "@/components/ConnectAccountsDialog";
import { NextAssignment } from "@/components/NextAssignment";
import { supabase } from "@/integrations/supabase/client";
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

const Dashboard = ({ user }: { user?: any }) => {
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [shopifyConnected, setShopifyConnected] = useState(false);
  const [metaConnected, setMetaConnected] = useState(false);
  const navigate = useNavigate();

  // Fetch connection status when component mounts or user changes
  useEffect(() => {
    const fetchConnectionStatus = async () => {
      if (user?.id) {
        try {
          const { data, error } = await supabase
            .from('users')
            .select('shopify_credentials, meta_ads_credentials')
            .eq('id', user.id)
            .single();

          if (error) throw error;

          setShopifyConnected(!!data?.shopify_credentials);
          setMetaConnected(!!data?.meta_ads_credentials);
        } catch (error) {
          console.error('Error fetching connection status:', error);
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
            .select('shopify_credentials, meta_ads_credentials')
            .eq('id', user.id)
            .single();

          if (error) throw error;

          setShopifyConnected(!!data?.shopify_credentials);
          setMetaConnected(!!data?.meta_ads_credentials);
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
  const [isBlurred, setIsBlurred] = useState(false);

  // Fetch real data when user is available
  useEffect(() => {
    if (user?.id) {
      fetchProgressData();
      fetchLeaderboardData();
      fetchMilestones();
      fetchNextAssignment();
      checkAccessStatus();
    }
  }, [user?.id]);

  const checkAccessStatus = async () => {
    if (!user?.id) return;

    const { data: userProfile } = await supabase
      .from('users')
      .select('fees_overdue, fees_due_date, onboarding_done')
      .eq('id', user.id)
      .single();

    // Blur dashboard if user has overdue fees or no payment recorded
    if (userProfile?.fees_overdue || !userProfile?.fees_due_date) {
      setIsBlurred(true);
    }
  };

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
        .from('assignment')
        .select('assignment_id');

      // Fetch completed assignments
      const { data: completedAssignments } = await supabase
        .from('assignment_submissions')
        .select('assignment_id')
        .eq('user_id', user.id)
        .eq('status', 'accepted');

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
      const { data: leaderboard } = await supabase
        .from('leaderboard')
        .select(`
          rank,
          points,
          user_id,
          users (full_name)
        `)
        .order('rank', { ascending: true })
        .limit(5);

      if (leaderboard) {
        const formattedData = leaderboard.map(entry => ({
          name: entry.users?.full_name || 'Unknown',
          score: entry.points,
          rank: entry.rank
        }));
        setLeaderboardData(formattedData);
      }
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
        .select('onboarding_done, shopify_credentials, meta_ads_credentials')
        .eq('id', user.id)
        .single();

      // Check if watched any video (unique videos only)
      const { data: watchedVideos } = await supabase
        .from('recording_views')
        .select('recording_id')
        .eq('user_id', user.id)
        .eq('watched', true);

      const hasWatchedAnyVideo = watchedVideos && [...new Set(watchedVideos.map(v => v.recording_id))].length > 0;

      // Check if submitted any assignment
      const { data: submissions } = await supabase
        .from('assignment_submissions')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      setMilestones([
        { title: "First Login", completed: true, icon: "🎯" }, // User is logged in
        { title: "Profile Complete", completed: profile?.onboarding_done || false, icon: "✅" },
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
      // Get assignments not yet submitted
      const { data: pendingAssignments } = await supabase
        .from('assignment')
        .select('*')
        .not('assignment_id', 'in', 
          `(SELECT assignment_id FROM assignment_submissions WHERE user_id = '${user.id}')`
        )
        .order('sequence_order', { ascending: true })
        .limit(1);

      if (pendingAssignments && pendingAssignments.length > 0) {
        setNextAssignment(pendingAssignments[0]);
      }
    } catch (error) {
      console.error('Error fetching next assignment:', error);
    }
  };

  const handleConnectAccounts = useCallback(() => {
    setConnectDialogOpen(true);
  }, []);

  return (
    <div className={`space-y-8 animate-fade-in ${isBlurred ? 'filter blur-sm pointer-events-none' : ''}`}>
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Welcome back! 👋</h1>
        <p className="text-muted-foreground mt-2 text-sm sm:text-base">Ready to continue your journey to success?</p>
      </div>

      {/* Visualization Card */}
      <Card className="gradient-hero text-white border-0 shadow-elevated overflow-hidden relative">
        <div className="absolute inset-0 bg-white/10 backdrop-blur-sm"></div>
        <CardContent className="p-6 relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold mb-2">Your Dream Goal 🌟</h3>
              <p className="text-white/90 mb-4 text-base">
                "Go for Umrah with family and buy a BMW within 2 years"
              </p>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 bg-white/20 rounded-full px-3 py-1">
                  <span className="text-xl" role="img" aria-label="Umrah goal">🕌</span>
                  <span className="text-sm font-medium">Umrah Goal</span>
                </div>
                <div className="flex items-center space-x-2 bg-white/20 rounded-full px-3 py-1">
                  <span className="text-xl" role="img" aria-label="BMW goal">🚗</span>
                  <span className="text-sm font-medium">BMW Goal</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold mb-1">{progressData.overallProgress}%</div>
              <div className="text-white/80 text-sm">Progress</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Progress Tracker */}
        <Card>
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
        <NextAssignment userId={user?.id} />

        {/* Meta/Shopify Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Zap className="w-5 h-5 mr-2 text-green-600" />
              Store Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
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
