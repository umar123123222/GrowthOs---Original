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

  // Add debug logging with better checks
  if (process.env.NODE_ENV === 'development') {
    console.log('StudentDashboard: Rendering with user:', user?.id, 'role:', user?.role);
  }
  
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
  // Fetch all dashboard data - Fix dependencies to prevent infinite loops
  useEffect(() => {
    if (user?.id && !loading) {
      fetchDashboardData();
    }
  }, [user?.id]); // Remove recordings dependency to prevent loops

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
        let thirdAnswerText = '';
        const answers: any = studentData?.answers_json;
        
        // Extract answers from question 1 and question 3
        if (answers) {
          if (Array.isArray(answers)) {
            // Get question 1 answer (index 0)
            const val1: any = answers[0]?.value;
            if (Array.isArray(val1)) firstAnswerText = val1.join(', ');
            else if (val1 && typeof val1 === 'object') firstAnswerText = (val1.name || val1.url || '');
            else if (val1 !== null && val1 !== undefined) firstAnswerText = String(val1);
            
            // Get question 3 answer (index 2)
            const val3: any = answers[2]?.value;
            if (Array.isArray(val3)) thirdAnswerText = val3.join(', ');
            else if (val3 && typeof val3 === 'object') thirdAnswerText = (val3.name || val3.url || '');
            else if (val3 !== null && val3 !== undefined) thirdAnswerText = String(val3);
          } else if (typeof answers === 'object') {
            const entries = Object.values(answers as Record<string, any>) as any[];
            const sorted = entries.sort((a, b) => (a?.order || 0) - (b?.order || 0));
            
            // Get question 1 (first sorted item)
            if (sorted[0]) {
              const val1: any = sorted[0]?.value;
              if (Array.isArray(val1)) firstAnswerText = val1.join(', ');
              else if (val1 && typeof val1 === 'object') firstAnswerText = (val1.name || val1.url || '');
              else if (val1 !== null && val1 !== undefined) firstAnswerText = String(val1);
            }
            
            // Get question 3 (third sorted item)
            if (sorted[2]) {
              const val3: any = sorted[2]?.value;
              if (Array.isArray(val3)) thirdAnswerText = val3.join(', ');
              else if (val3 && typeof val3 === 'object') thirdAnswerText = (val3.name || val3.url || '');
              else if (val3 !== null && val3 !== undefined) thirdAnswerText = String(val3);
            }
          }
        }
        
        // Format as "answer1 for answer3" if both exist
        if (firstAnswerText && thirdAnswerText) {
          firstAnswerText = `${firstAnswerText} so that ${thirdAnswerText}`;
        } else if (studentData?.goal_brief) {
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

      // Calculate course progress - only when recordings data changes
      if (recordings && recordings.length > 0) {
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
    if (process.env.NODE_ENV === 'development') {
      console.log('StudentDashboard: Loading recordings');
    }
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

  if (process.env.NODE_ENV === 'development') {
    console.log('StudentDashboard: Rendering main dashboard content');
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

      {/* Interactive Three-Card Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Course Progress Card */}
        <Card className="hover:shadow-xl hover:scale-[1.03] transition-all duration-500 border-l-2 border-l-blue-400 animate-fade-in group cursor-pointer relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-50/0 via-blue-50/50 to-blue-50/0 transform -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
          <CardHeader className="pb-3 relative z-10">
            <CardTitle className="flex items-center gap-2 text-blue-600 text-base font-medium">
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 group-hover:scale-110 group-hover:rotate-12 transition-all duration-300">
                <BarChart3 className="w-4 h-4 group-hover:scale-110 transition-transform duration-300" />
              </div>
              <span className="group-hover:translate-x-1 transition-transform duration-300">Course Progress</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="space-y-3">
              <div className="text-center">
                <div className="text-3xl font-medium text-blue-600 mb-1 group-hover:scale-110 group-hover:text-blue-700 transition-all duration-300 relative">
                  {courseProgress}%
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-200 rounded-full opacity-0 group-hover:opacity-100 group-hover:animate-ping transition-all duration-300"></div>
                </div>
                <p className="text-xs text-muted-foreground group-hover:text-blue-600 transition-colors duration-300">Complete</p>
              </div>
              <div className="relative group/bar">
                <Progress value={courseProgress} className="h-1.5 group-hover/bar:h-2 transition-all duration-300" />
                <div className="absolute inset-0 bg-gradient-to-r from-blue-300/30 to-blue-500/30 rounded-full opacity-0 group-hover/bar:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Next Assignment Card */}
        <Card className={`hover:shadow-xl hover:scale-[1.03] transition-all duration-500 border-l-2 animate-fade-in group cursor-pointer relative overflow-hidden ${
          assignmentDueStatus === 'overdue' ? 'border-l-red-400' : 'border-l-orange-400'
        }`} style={{ animationDelay: '150ms' }}>
          <div className={`absolute inset-0 bg-gradient-to-r transform -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ${
            assignmentDueStatus === 'overdue' ? 'from-red-50/0 via-red-50/50 to-red-50/0' : 'from-orange-50/0 via-orange-50/50 to-orange-50/0'
          }`}></div>
          <CardHeader className="pb-3 relative z-10">
            <CardTitle className={`flex items-center gap-2 text-base font-medium ${
              assignmentDueStatus === 'overdue' ? 'text-red-600' : 'text-orange-600'
            }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center group-hover:scale-110 transition-all duration-300 ${
                assignmentDueStatus === 'overdue' 
                  ? 'bg-red-50 group-hover:bg-red-100 group-hover:animate-pulse' 
                  : 'bg-orange-50 group-hover:bg-orange-100 group-hover:rotate-12'
              }`}>
                <Upload className="w-4 h-4 group-hover:scale-110 group-hover:-translate-y-0.5 transition-all duration-300" />
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
        <Card className="hover:shadow-xl hover:scale-[1.03] transition-all duration-500 border-l-2 border-l-purple-400 animate-fade-in group cursor-pointer relative overflow-hidden" style={{ animationDelay: '300ms' }}>
          <div className="absolute inset-0 bg-gradient-to-r from-purple-50/0 via-purple-50/50 to-purple-50/0 transform -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
          <CardHeader className="pb-3 relative z-10">
            <CardTitle className="flex items-center gap-2 text-purple-600 text-base font-medium">
              <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center group-hover:bg-purple-100 group-hover:scale-110 group-hover:rotate-12 transition-all duration-300">
                <Zap className="w-4 h-4 group-hover:scale-110 group-hover:text-yellow-500 transition-all duration-300" />
              </div>
              <span className="group-hover:translate-x-1 transition-transform duration-300">Integrations</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2 bg-muted/30 rounded-md group-hover:bg-muted/50 transition-all duration-300 hover:scale-[1.02] cursor-pointer">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-green-600 group-hover:scale-110 group-hover:rotate-12 transition-all duration-300" />
                  <span className="font-normal text-sm group-hover:translate-x-0.5 transition-transform duration-300">Shopify</span>
                </div>
                {shopifyConnected ? (
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs text-green-600">Connected</span>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="text-xs h-6 px-2 hover:scale-105 transition-transform duration-200">
                    Connect
                  </Button>
                )}
              </div>
              
              <div className="flex items-center justify-between p-2 bg-muted/30 rounded-md group-hover:bg-muted/50 transition-all duration-300 hover:scale-[1.02] cursor-pointer">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-600 group-hover:scale-110 group-hover:rotate-12 transition-all duration-300" />
                  <span className="font-normal text-sm group-hover:translate-x-0.5 transition-transform duration-300">Meta Ads</span>
                </div>
                {metaConnected ? (
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs text-green-600">Connected</span>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="text-xs h-6 px-2 hover:scale-105 transition-transform duration-200">
                    Connect
                  </Button>
                )}
              </div>
              
              <Button 
                variant="outline" 
                size="sm"
                className="w-full text-xs font-normal group-hover:scale-105 hover:bg-purple-50 hover:border-purple-300 transition-all duration-300 relative overflow-hidden"
                onClick={() => setConnectDialogOpen(true)}
              >
                <span className="relative z-10">Manage Connections</span>
                <div className="absolute inset-0 bg-purple-100/50 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

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