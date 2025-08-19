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
import { safeQuery, safeMaybeSingle } from '@/lib/database-safety';
import { logger } from '@/lib/logger';
import type { UserDataResult, StudentDataResult } from '@/types/database';
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

  // Add debug logging and error state
  console.log('StudentDashboard: Rendering with user:', user?.id, 'role:', user?.role);
  
  // Add error boundary state
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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
  const [firstOnboardingAnswer, setFirstOnboardingAnswer] = useState<string>('');
  const [firstOnboardingRange, setFirstOnboardingRange] = useState<{ min: string; max: string } | null>(null);
  // Fetch all dashboard data
  useEffect(() => {
    if (user?.id) {
      fetchDashboardData();
    }
  }, [user?.id, recordings]);

  const fetchDashboardData = async () => {
    if (!user?.id) {
      console.warn('StudentDashboard: No user ID available');
      return;
    }

    console.log('StudentDashboard: Fetching dashboard data for user:', user.id);

    try {
      // Fetch user data including dream goal and connections
      const userResult = await safeQuery<UserDataResult>(
        supabase
          .from('users')
          .select('dream_goal_summary, shopify_credentials, meta_ads_credentials, lms_status')
          .eq('id', user.id)
          .single(),
        `fetch user data for dashboard ${user.id}`
      );

      if (userResult.data) {
        const userData = userResult.data;
        setDreamGoal(userData.dream_goal_summary || '');
        setShopifyConnected(!!userData.shopify_credentials);
        setMetaConnected(!!userData.meta_ads_credentials);
        setUserLMSStatus(userData.lms_status || 'active');
      }

      // Fetch first onboarding answer
      const studentRes = await safeMaybeSingle<StudentDataResult>(
        supabase
          .from('students')
          .select('answers_json, goal_brief')
          .eq('user_id', user.id)
          .maybeSingle(),
        `fetch student answers for ${user.id}`
      );

      const studentData = studentRes.data;
      try {
        let firstAnswerText = '';
        const answers: any = studentData?.answers_json;
        if (answers) {
          if (Array.isArray(answers)) {
            const val: any = answers[0]?.value;
            if (Array.isArray(val)) firstAnswerText = val.join(', ');
            else if (val && typeof val === 'object') firstAnswerText = (val.name || val.url || '[file uploaded]');
            else if (val !== null && val !== undefined) firstAnswerText = String(val);
          } else if (typeof answers === 'object') {
            const entries = Object.values(answers as Record<string, any>) as any[];
            const sorted = entries.sort((a, b) => (a?.order || 0) - (b?.order || 0));
            const first = sorted[0];
            const val: any = first?.value;
            if (Array.isArray(val)) firstAnswerText = val.join(', ');
            else if (val && typeof val === 'object') firstAnswerText = (val.name || val.url || '[file uploaded]');
            else if (val !== null && val !== undefined) firstAnswerText = String(val);
          }
        }
        if (!firstAnswerText && studentData?.goal_brief) {
          firstAnswerText = String(studentData.goal_brief);
        }
        // Derive range (ans1 to ans2) from first question value when available
        let rangeMin = '';
        let rangeMax = '';
        try {
          if (answers) {
            if (Array.isArray(answers)) {
              const v: any = answers[0]?.value;
              if (Array.isArray(v) && v.length >= 2) {
                rangeMin = String(v[0]);
                rangeMax = String(v[1]);
              } else if (typeof v === 'string') {
                const parts = v.split(/\s*(?:to|-)\s*/i).map(s => s.trim()).filter(Boolean);
                if (parts.length >= 2) {
                  rangeMin = parts[0];
                  rangeMax = parts[1];
                }
              } else if (v && typeof v === 'object' && (v.min || v.max)) {
                rangeMin = String(v.min ?? '');
                rangeMax = String(v.max ?? '');
              }
            } else if (typeof answers === 'object') {
              const entries = Object.values(answers as Record<string, any>) as any[];
              const first = entries.sort((a, b) => (a?.order || 0) - (b?.order || 0))[0];
              const v: any = first?.value;
              if (Array.isArray(v) && v.length >= 2) {
                rangeMin = String(v[0]);
                rangeMax = String(v[1]);
              } else if (typeof v === 'string') {
                const parts = v.split(/\s*(?:to|-)\s*/i).map(s => s.trim()).filter(Boolean);
                if (parts.length >= 2) {
                  rangeMin = parts[0];
                  rangeMax = parts[1];
                }
              } else if (v && typeof v === 'object' && (v.min || v.max)) {
                rangeMin = String(v.min ?? '');
                rangeMax = String(v.max ?? '');
              }
            }
          }
        } catch {}
        if (rangeMin && rangeMax) {
          setFirstOnboardingRange({ min: rangeMin, max: rangeMax });
        } else {
          setFirstOnboardingRange(null);
        }
        if (firstAnswerText) setFirstOnboardingAnswer(firstAnswerText);
      } catch (e) {
        logger.warn('Failed to parse onboarding answers', e);
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
        { id: '3', title: 'Shopify Connected', completed: !!(userResult.data?.shopify_credentials), icon: '🛒' },
        { id: '4', title: '50% Course Complete', completed: courseProgress >= 50, icon: '🎯' },
        { id: '5', title: 'Meta Ads Connected', completed: !!(userResult.data?.meta_ads_credentials), icon: '📊' }
      ]);

      // Skip leaderboard for now since table doesn't exist
      // We'll implement this later when the leaderboard table is properly created

    } catch (error) {
      logger.error('Error fetching dashboard data:', error);
      console.error('StudentDashboard: Dashboard data fetch failed:', error);
      setHasError(true);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load dashboard data');
      toast({
        title: "Dashboard Loading Error",
        description: "Some dashboard features may not work properly. Please refresh the page.",
        variant: "destructive",
      });
    }
  };

  const handleSubmitAssignment = () => {
    if (nextAssignment) {
      navigate('/assignments');
    }
  };

  const completedMilestones = milestones.filter(m => m.completed).length;

  // Early returns with defensive checks
  if (!user) {
    console.warn('StudentDashboard: No user available, showing loading state');
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Loading user data...</div>
      </div>
    );
  }

  if (loading) {
    console.log('StudentDashboard: Loading recordings');
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Loading your dashboard...</div>
      </div>
    );
  }

  // Error state
  if (hasError) {
    console.error('StudentDashboard: Rendering error state');
    return (
      <div className="flex flex-col justify-center items-center h-64 space-y-4">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <div className="text-lg text-destructive">Dashboard Error</div>
        <div className="text-sm text-muted-foreground max-w-md text-center">
          {errorMessage || 'Something went wrong loading your dashboard.'}
        </div>
        <Button 
          onClick={() => {
            setHasError(false);
            setErrorMessage('');
            fetchDashboardData();
          }}
          variant="outline"
        >
          Try Again
        </Button>
      </div>
    );
  }

  console.log('StudentDashboard: Rendering main dashboard content');

  return (
    <div className="space-y-6">
      <InactiveLMSBanner show={user?.role === 'student' && userLMSStatus === 'inactive'} />
      
      {/* Refined Financial Goal Banner */}
      <Card className="card-friendly border-t-3 border-t-primary-100">
        <CardContent className="p-6">
          <div className="space-y-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xl">🎯</span>
              </div>
              <div>
                <h2 className="text-xl font-medium text-primary-600 mb-1">Your Financial Goal</h2>
                <p className="text-xs text-muted">Track your progress towards financial freedom</p>
              </div>
            </div>
            
            <div className="bg-surface rounded-lg p-4 border border-border">
              <p className="text-base font-normal text-primary leading-relaxed">
                {firstOnboardingRange?.min && firstOnboardingRange?.max
                  ? <>You want to earn between {firstOnboardingRange.min} and {firstOnboardingRange.max}.</>
                  : firstOnboardingAnswer
                  ? <>You want to earn {firstOnboardingAnswer}.</>
                  : extractFinancialGoalForDisplay(dreamGoal)
                }
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-normal text-muted">Progress toward your goal</span>
                <span className="text-sm font-medium text-primary-600">{courseProgress}% complete</span>
              </div>
              <div className="relative">
                <Progress 
                  value={courseProgress} 
                  className="progress-friendly"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Interactive Three-Card Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Course Progress Card */}
        <Card className="card-friendly border-l-3 border-l-primary-100 group cursor-pointer">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-accent-indigo text-base font-medium">
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center group-hover:bg-primary-100 group-hover:scale-110 transition-all duration-300">
                <BarChart3 className="w-4 h-4 text-primary-600" />
              </div>
              <span>Course Progress</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="text-center">
                <div className="text-3xl font-medium text-primary-600 mb-1">
                  {courseProgress}%
                </div>
                <p className="text-xs text-muted">Complete</p>
              </div>
              <div className="relative">
                <Progress value={courseProgress} className="progress-friendly" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Next Assignment Card */}
        <Card className={`card-friendly border-l-3 group cursor-pointer ${
          assignmentDueStatus === 'overdue' ? 'border-l-error-600' : 'border-l-warning-600'
        }`}>
          <CardHeader className="pb-3">
            <CardTitle className={`flex items-center gap-2 text-base font-medium ${
              assignmentDueStatus === 'overdue' ? 'text-error-600' : 'text-warning-600'
            }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                assignmentDueStatus === 'overdue' 
                  ? 'bg-error-50' 
                  : 'bg-warning-50'
              }`}>
                <Upload className="w-4 h-4" />
              </div>
              <span className="group-hover:translate-x-1 transition-transform duration-300">Next Assignment</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            {nextAssignment ? (
              <div className="space-y-3">
                <div>
                  <h3 className="font-normal text-foreground mb-2 line-clamp-2 group-hover:text-orange-600 transition-colors duration-300">
                    {nextAssignment.name}
                  </h3>
                  <div className="flex items-center gap-2 text-xs">
                    {assignmentDueStatus === 'overdue' ? (
                      <AlertCircle className="w-3 h-3 text-red-500 group-hover:animate-bounce" />
                    ) : (
                      <Clock className="w-3 h-3 text-orange-500 group-hover:animate-spin" />
                    )}
                    <span className={`font-normal transition-all duration-300 ${
                      assignmentDueStatus === 'overdue' ? 'text-red-500 group-hover:animate-pulse' : 'text-orange-500'
                    }`}>
                      {assignmentDueStatus === 'overdue' ? 'Past Due' : 'Due Soon'}
                    </span>
                  </div>
                </div>
                <Button 
                  onClick={handleSubmitAssignment}
                  className="w-full text-sm font-normal group-hover:scale-105 transition-all duration-300 relative overflow-hidden"
                  variant={assignmentDueStatus === 'overdue' ? 'destructive' : 'default'}
                  size="sm"
                >
                  <span className="relative z-10">Submit Now</span>
                  <div className="absolute inset-0 bg-white/20 transform -translate-x-full group-hover:translate-x-full transition-transform duration-500"></div>
                </Button>
              </div>
            ) : (
              <div className="text-center py-6">
                <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2 group-hover:scale-110 group-hover:rotate-12 transition-all duration-300" />
                <p className="text-xs text-muted-foreground group-hover:text-green-600 transition-colors duration-300">All assignments completed!</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Integrations Card */}
        <Card className="card-friendly border-l-3 border-l-accent-cyan group cursor-pointer">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-accent-indigo text-base font-medium">
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                <Zap className="w-4 h-4 text-accent-cyan" />
              </div>
              <span>Integrations</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2 bg-surface rounded-md border border-border transition-all duration-300 hover:bg-info-50">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-success-600" />
                  <span className="font-normal text-sm text-primary">Shopify</span>
                </div>
                {shopifyConnected ? (
                  <Badge variant="secondary" className="text-xs bg-success-50 text-success-600 border-success-600/20">
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs bg-warning-50 text-warning-600 border-warning-600/20">
                    Not connected
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center justify-between p-2 bg-surface rounded-md border border-border transition-all duration-300 hover:bg-info-50">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary-600" />
                  <span className="font-normal text-sm text-primary">Meta Ads</span>
                </div>
                {metaConnected ? (
                  <Badge variant="secondary" className="text-xs bg-success-50 text-success-600 border-success-600/20">
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs bg-warning-50 text-warning-600 border-warning-600/20">
                    Not connected
                  </Badge>
                )}
              </div>
              
              <Button 
                variant="secondary" 
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

      {/* Interactive Milestones & Leaderboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Milestones Card */}
        <Card className="card-friendly border-l-3 border-l-primary-100 group cursor-pointer">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                <Award className="w-4 h-4 text-accent-indigo" />
              </div>
              <span className="text-base font-medium text-accent-indigo">
                Milestones
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-normal text-muted">Progress</span>
                <span className="text-xs font-medium text-accent-indigo">
                  {completedMilestones} of {milestones.length} completed
                </span>
              </div>
              <div className="relative">
                <Progress value={(completedMilestones / milestones.length) * 100} className="progress-friendly" />
              </div>
              
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {milestones.map((milestone, index) => (
                  <div 
                    key={milestone.id} 
                    className={`flex items-center gap-2 p-2 rounded-md transition-all duration-300 cursor-pointer ${
                      milestone.completed 
                        ? 'bg-success-50 border border-success-600/20 hover:bg-info-50' 
                        : 'bg-surface border border-border hover:bg-info-50'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 ${
                      milestone.completed 
                        ? 'bg-success-600' 
                        : 'bg-surface border border-border'
                    }`}>
                      {milestone.completed ? (
                        <CheckCircle className="w-3 h-3 text-white" />
                      ) : (
                        <span className="text-sm">{milestone.icon}</span>
                      )}
                    </div>
                    <span className={`font-normal text-sm transition-colors duration-300 ${
                      milestone.completed ? 'text-success-600' : 'text-primary'
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
        <Card className="card-friendly border-l-3 border-l-accent-violet group cursor-pointer">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-accent-violet/10 flex items-center justify-center">
                <Trophy className="w-4 h-4 text-accent-violet" />
              </div>
              <span className="text-base font-medium text-accent-violet">
                Your Rank
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {leaderboardPosition ? (
              <div className="text-center space-y-3">
                <div className="relative">
                  <div className="text-4xl font-medium text-accent-violet">
                    #{leaderboardPosition.rank}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-base font-medium text-primary">Great progress!</p>
                  <p className="text-xs text-muted">
                    You're {leaderboardPosition.rank === 1 ? 'leading the pack' : `${leaderboardPosition.rank} of ${leaderboardPosition.total}`}
                  </p>
                </div>
                <div className="bg-accent-violet/8 p-3 rounded-md border border-accent-violet/20">
                  <div className="flex items-center justify-center gap-1 text-xs font-normal text-accent-violet">
                    <Star className="w-3 h-3 fill-current" />
                    <span>Keep up the great work!</span>
                    <Star className="w-3 h-3 fill-current" />
                  </div>
                </div>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={() => navigate('/leaderboard')}
                  className="w-full text-xs font-normal"
                >
                  View Full Leaderboard
                </Button>
              </div>
            ) : (
              <div className="text-center py-6 space-y-3">
                <div className="w-12 h-12 bg-accent-violet/10 rounded-full mx-auto flex items-center justify-center">
                  <Target className="w-6 h-6 text-accent-violet" />
                </div>
                <div>
                  <p className="font-medium text-primary mb-1">Start Your Journey</p>
                  <p className="text-xs text-muted">
                    Complete activities to see your ranking
                  </p>
                </div>
                <div className="bg-accent-violet/8 p-2 rounded-md border border-accent-violet/20">
                  <p className="text-xs text-accent-violet font-normal">Ready to climb the leaderboard? 🚀</p>
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