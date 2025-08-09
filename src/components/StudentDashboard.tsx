import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import { Progress } from '@/components/ui/progress';
import { ConnectAccountsDialog } from '@/components/ConnectAccountsDialog';
import { useAuth } from '@/hooks/useAuth';
import { useStudentRecordings } from '@/hooks/useStudentRecordings';
import { supabase } from '@/integrations/supabase/client';
import { InactiveLMSBanner } from '@/components/InactiveLMSBanner';

import { extractFinancialGoalForDisplay } from '@/utils/dreamGoalUtils';
import { safeQuery } from '@/lib/database-safety';
import { logger } from '@/lib/logger';
import { 
  Trophy, 
  Target, 
  Clock, 
  BarChart3,
  Upload,
  CheckCircle,
  AlertCircle,
  Award,
  Star,
  Zap,
  PlayCircle,
  ListChecks,
  MessageCircle
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

  const { totalVideos, videosWatched, totalAssignments, assignmentsCompleted, pendingAssignments, integrationsConnected } = useMemo(() => {
    const totalV = recordings.length;
    const watched = recordings.filter(r => r.isWatched).length;
    const totalA = recordings.filter(r => r.hasAssignment).length;
    const completedA = recordings.filter(r => r.hasAssignment && r.assignmentSubmitted).length;
    const pendingA = Math.max(totalA - completedA, 0);
    const integrations = (shopifyConnected ? 1 : 0) + (metaConnected ? 1 : 0);
    return {
      totalVideos: totalV,
      videosWatched: watched,
      totalAssignments: totalA,
      assignmentsCompleted: completedA,
      pendingAssignments: pendingA,
      integrationsConnected: integrations,
    };
  }, [recordings, shopifyConnected, metaConnected]);

  type StatVariant = 'primary' | 'secondary' | 'accent' | 'destructive' | 'muted';

  const StatTile: React.FC<{
    title: string;
    value: React.ReactNode;
    sublabel?: string;
    icon?: React.ReactNode;
    variant?: StatVariant;
    onClick?: () => void;
  }> = ({ title, value, sublabel, icon, variant = 'muted', onClick }) => {
    const base =
      'relative overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm transition-transform hover:scale-[1.02] focus-within:scale-[1.02]';
    const variantCls: Record<StatVariant, string> = {
      primary: 'border-l-2 border-primary bg-primary/5',
      secondary: 'border-l-2 border-secondary bg-secondary/5',
      accent: 'border-l-2 border-accent bg-accent/5',
      destructive: 'border-l-2 border-destructive bg-destructive/5',
      muted: 'border-l-2 border-muted bg-muted/20',
    };
    return (
      <div
        className={`${base} ${variantCls[variant]} p-4`}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : -1}
        onClick={onClick}
        onKeyDown={(e) => {
          if (onClick && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onClick();
          }
        }}
        aria-label={`${title}${typeof value === 'string' ? ` ${value}` : ''}`}
      >
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{title}</p>
            <div className="text-2xl font-semibold">{value}</div>
            {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
          </div>
          {icon && (
            <div className="w-9 h-9 rounded-full bg-muted/50 flex items-center justify-center">
              {icon}
            </div>
          )}
        </div>
      </div>
    );
  };

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

      {/* Hero Header */}
      <header className="rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-background border border-primary/20 p-6 animate-fade-in">
        <h1 className="text-2xl font-semibold tracking-tight">Learning Command Center</h1>
        <p className="text-sm text-muted-foreground mt-1">Your personal progress and next steps</p>
      </header>

      {/* Metrics Tiles Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <StatTile
          title="Overall Progress"
          value={`${courseProgress}%`}
          sublabel="Complete"
          icon={<BarChart3 className="w-4 h-4" />}
          variant="primary"
          onClick={() => navigate('/videos')}
        />
        <StatTile
          title="Videos Watched"
          value={`${videosWatched}/${totalVideos}`}
          sublabel="Lessons completed"
          icon={<PlayCircle className="w-4 h-4" />}
          variant="accent"
          onClick={() => navigate('/videos')}
        />
        <StatTile
          title="Assignments Done"
          value={`${assignmentsCompleted}/${totalAssignments}`}
          sublabel="Submitted"
          icon={<ListChecks className="w-4 h-4" />}
          variant="secondary"
          onClick={() => navigate('/assignments')}
        />
        <StatTile
          title="Pending Assignments"
          value={pendingAssignments}
          sublabel="To be submitted"
          icon={<Clock className="w-4 h-4" />}
          variant={pendingAssignments > 0 ? 'destructive' : 'muted'}
          onClick={() => navigate('/assignments')}
        />
        <StatTile
          title="LMS Status"
          value={userLMSStatus === 'inactive' ? 'Inactive' : 'Active'}
          sublabel="Learning system"
          icon={<Zap className="w-4 h-4" />}
          variant={userLMSStatus === 'inactive' ? 'destructive' : 'primary'}
        />
        <StatTile
          title="Next Assignment"
          value={nextAssignment ? nextAssignment.name : 'All caught up'}
          sublabel={nextAssignment ? (assignmentDueStatus === 'overdue' ? 'Past Due' : 'Due Soon') : 'No pending tasks'}
          icon={<Upload className="w-4 h-4" />}
          variant={nextAssignment ? (assignmentDueStatus === 'overdue' ? 'destructive' : 'accent') : 'muted'}
          onClick={() => nextAssignment && navigate('/assignments')}
        />
        <StatTile
          title="Integrations"
          value={`${integrationsConnected}/2 Connected`}
          sublabel="Shopify, Meta Ads"
          icon={<Zap className="w-4 h-4" />}
          variant="secondary"
          onClick={() => setConnectDialogOpen(true)}
        />
        <StatTile
          title="Milestones"
          value={`${completedMilestones}/${milestones.length}`}
          sublabel="Achieved"
          icon={<Award className="w-4 h-4" />}
          variant="accent"
        />
      </section>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => navigate('/videos')} className="hover-scale">
          <PlayCircle className="w-4 h-4 mr-2" /> Continue Watching
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate('/assignments')} className="hover-scale">
          <ListChecks className="w-4 h-4 mr-2" /> View Assignments
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate('/support')} className="hover-scale">
          <MessageCircle className="w-4 h-4 mr-2" /> Ask Support
        </Button>
      </div>

      {/* Financial Goal Banner */}
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
    
      {/* Interactive Milestones & Leaderboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Milestones Card */}
        <Card className="hover:shadow-xl hover:scale-[1.02] transition-all duration-500 animate-fade-in group cursor-pointer relative overflow-hidden" style={{ animationDelay: '450ms' }}>
          <div className="absolute inset-0 bg-gradient-to-r from-orange-50/0 via-orange-50/30 to-orange-50/0 transform -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
          <CardHeader className="pb-3 relative z-10">
            <CardTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-yellow-100 to-orange-100 flex items-center justify-center group-hover:scale-110 group-hover:rotate-12 transition-all duration-300">
                <Award className="w-4 h-4 text-orange-600 group-hover:scale-110 transition-transform duration-300" />
              </div>
              <span className="text-base font-medium text-orange-600 group-hover:translate-x-1 transition-transform duration-300">
                Milestones
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="space-y-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-normal text-muted-foreground">Progress</span>
                <span className="text-xs font-medium text-orange-600 group-hover:scale-105 transition-transform duration-300">
                  {completedMilestones} of {milestones.length} completed
                </span>
              </div>
              <div className="relative group/progress">
                <Progress value={(completedMilestones / milestones.length) * 100} className="h-1.5 group-hover/progress:h-2 transition-all duration-300" />
                <div className="absolute inset-0 bg-gradient-to-r from-orange-300/30 to-yellow-300/30 rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
              </div>
              
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {milestones.map((milestone, index) => (
                  <div 
                    key={milestone.id} 
                    className={`flex items-center gap-2 p-2 rounded-md transition-all duration-300 hover:scale-[1.02] cursor-pointer ${
                      milestone.completed 
                        ? 'bg-green-50/50 border border-green-100 hover:bg-green-50 hover:shadow-sm' 
                        : 'bg-muted/20 hover:bg-muted/40'
                    }`}
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 ${
                      milestone.completed 
                        ? 'bg-green-500 hover:scale-110 hover:rotate-12' 
                        : 'bg-muted border border-muted-foreground/20 hover:scale-105'
                    }`}>
                      {milestone.completed ? (
                        <CheckCircle className="w-3 h-3 text-white" />
                      ) : (
                        <span className="text-sm hover:scale-110 transition-transform duration-300">{milestone.icon}</span>
                      )}
                    </div>
                    <span className={`font-normal text-sm transition-colors duration-300 hover:translate-x-1 ${
                      milestone.completed ? 'text-green-700' : 'text-foreground'
                    }`}>
                      {milestone.title}
                    </span>
                    {milestone.completed && (
                      <div className="ml-auto">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse hover:scale-110 transition-transform duration-200"></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Your Rank Card */}
        <Card className="hover:shadow-xl hover:scale-[1.02] transition-all duration-500 animate-fade-in group cursor-pointer relative overflow-hidden" style={{ animationDelay: '600ms' }}>
          <div className="absolute inset-0 bg-gradient-to-r from-purple-50/0 via-purple-50/30 to-purple-50/0 transform -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
          <CardHeader className="pb-3 relative z-10">
            <CardTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-100 to-pink-100 flex items-center justify-center group-hover:scale-110 group-hover:rotate-12 transition-all duration-300">
                <Trophy className="w-4 h-4 text-purple-600 group-hover:scale-110 group-hover:text-yellow-500 transition-all duration-300" />
              </div>
              <span className="text-base font-medium text-purple-600 group-hover:translate-x-1 transition-transform duration-300">
                Your Rank
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            {leaderboardPosition ? (
              <div className="text-center space-y-3">
                <div className="relative">
                  <div className="text-4xl font-medium text-purple-600 group-hover:scale-110 group-hover:text-purple-700 transition-all duration-300">
                    #{leaderboardPosition.rank}
                  </div>
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-200 rounded-full flex items-center justify-center group-hover:animate-bounce">
                    <span className="text-xs group-hover:scale-110 transition-transform duration-300">⭐</span>
                  </div>
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-300/30 rounded-full opacity-0 group-hover:opacity-100 animate-ping"></div>
                </div>
                <div className="space-y-1">
                  <p className="text-base font-medium text-foreground group-hover:text-purple-600 transition-colors duration-300">Great progress!</p>
                  <p className="text-xs text-muted-foreground group-hover:text-purple-500 transition-colors duration-300">
                    You're {leaderboardPosition.rank === 1 ? 'leading the pack' : `${leaderboardPosition.rank} of ${leaderboardPosition.total}`}
                  </p>
                </div>
                <div className="flex items-center justify-center space-x-1 mb-3">
                  {[1, 2, 3].map(pos => (
                    <Star 
                      key={pos} 
                      className={`w-4 h-4 transition-all duration-300 hover:scale-125 cursor-pointer ${
                        pos <= 3 && leaderboardPosition.rank <= 3 
                          ? 'text-yellow-500 fill-current hover:rotate-12' 
                          : 'text-muted hover:text-yellow-400'
                      }`} 
                    />
                  ))}
                </div>
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-3 rounded-md border border-purple-100 group-hover:border-purple-200 group-hover:shadow-sm transition-all duration-300">
                  <div className="flex items-center justify-center gap-1 text-xs font-normal text-purple-700">
                    <Star className="w-3 h-3 fill-current group-hover:animate-spin" />
                    <span className="group-hover:scale-105 transition-transform duration-300">Keep up the great work!</span>
                    <Star className="w-3 h-3 fill-current group-hover:animate-spin" />
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => navigate('/leaderboard')}
                  className="w-full text-xs font-normal group-hover:scale-105 hover:bg-purple-50 hover:border-purple-300 transition-all duration-300 relative overflow-hidden"
                >
                  <span className="relative z-10">View Full Leaderboard</span>
                  <div className="absolute inset-0 bg-purple-100/50 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
                </Button>
              </div>
            ) : (
              <div className="text-center py-6 space-y-3">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-50 to-pink-50 rounded-full mx-auto flex items-center justify-center group-hover:scale-110 group-hover:rotate-12 transition-all duration-300">
                  <Target className="w-6 h-6 text-purple-500 group-hover:scale-110 transition-transform duration-300" />
                </div>
                <div>
                  <p className="font-medium text-foreground mb-1 group-hover:text-purple-600 transition-colors duration-300">Start Your Journey</p>
                  <p className="text-xs text-muted-foreground group-hover:text-purple-500 transition-colors duration-300">
                    Complete activities to see your ranking
                  </p>
                </div>
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-2 rounded-md border border-purple-100 group-hover:border-purple-200 group-hover:shadow-sm transition-all duration-300">
                  <p className="text-xs text-purple-700 font-normal group-hover:scale-105 transition-transform duration-300">Ready to climb the leaderboard? 🚀</p>
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