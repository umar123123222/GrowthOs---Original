
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { logUserActivity, ACTIVITY_TYPES } from "@/lib/activity-logger";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { 
  Monitor, 
  BookOpen, 
  FileText, 
  Star, 
  User, 
  Settings,
  MessageSquare,
  Bell,
  Brain,
  Video,
  Users,
  Award,
  Lock
} from "lucide-react";
import ShoaibGPT from "./ShoaibGPT";
import NotificationDropdown from "./NotificationDropdown";

interface Assignment {
  assignment_id: string;
  assignment_title: string;
  sequence_order: number;
  Status: string;
  due_date: string;
  isUnlocked?: boolean;
  isSubmitted?: boolean;
}

interface LayoutProps {
  user: any;
}

const Layout = ({ user }: LayoutProps) => {
  const location = useLocation();
  const [showShoaibGPT, setShowShoaibGPT] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  // Memoize main navigation to prevent unnecessary re-renders
  const mainNavigation = useMemo(() => [
    { name: "Dashboard", href: "/", icon: Monitor },
    { name: "Videos", href: "/videos", icon: BookOpen },
    { name: "Success Sessions", href: "/live-sessions", icon: Video },
    { name: "Study Pod", href: "/mentorship", icon: Users },
    { name: "Leaderboard", href: "/leaderboard", icon: Star },
    { name: "Messages", href: "/messages", icon: MessageSquare },
    { name: "Profile", href: "/profile", icon: User },
  ], []);

  // Fetch assignments for sidebar
  useEffect(() => {
    const fetchAssignments = async () => {
      if (!user?.id) return;

      try {
        const { data: assignmentsData, error: assignmentsError } = await supabase
          .from('assignment')
          .select('*')
          .order('sequence_order');

        if (assignmentsError) throw assignmentsError;

        const { data: submissions, error: submissionsError } = await supabase
          .from('assignment_submissions')
          .select('*')
          .eq('user_id', user.id);

        if (submissionsError) throw submissionsError;

        const processedAssignments = assignmentsData?.map(assignment => {
          const previousAssignments = assignmentsData.filter(a => a.sequence_order < assignment.sequence_order);
          const allPreviousCompleted = previousAssignments.every(prevAssignment => {
            const submission = submissions?.find(s => s.assignment_id === prevAssignment.assignment_id);
            return submission && submission.status === 'accepted';
          });

          const isUnlocked = assignment.sequence_order === 1 || allPreviousCompleted;
          const isSubmitted = submissions?.some(s => s.assignment_id === assignment.assignment_id);

          return {
            ...assignment,
            isUnlocked,
            isSubmitted
          };
        }) || [];

        setAssignments(processedAssignments);
      } catch (error) {
        console.error('Error fetching assignments:', error);
      }
    };

    fetchAssignments();
  }, [user?.id]);

  // Get current assignment and next 3 unlocked assignments
  const visibleAssignments = useMemo(() => {
    const unlockedAssignments = assignments.filter(a => a.isUnlocked);
    const currentAssignment = unlockedAssignments.find(a => !a.isSubmitted) || unlockedAssignments[0];
    
    if (!currentAssignment) return [];
    
    const currentIndex = assignments.findIndex(a => a.assignment_id === currentAssignment.assignment_id);
    const startIndex = Math.max(0, currentIndex);
    const endIndex = Math.min(assignments.length, startIndex + 4);
    
    return assignments.slice(startIndex, endIndex);
  }, [assignments]);

  // Optimized logging with error handling
  useEffect(() => {
    if (user?.id) {
      const timeoutId = setTimeout(() => {
        // Don't await the activity log to prevent blocking the UI
        logUserActivity({
          user_id: user.id,
          activity_type: ACTIVITY_TYPES.PAGE_VISIT,
          metadata: { 
            page: location.pathname,
            timestamp: new Date().toISOString()
          }
        }).catch(error => {
          // Silently handle activity logging errors
          console.warn('Page visit logging failed:', error);
        });
      }, 100); // Small delay to prevent excessive logging

      return () => clearTimeout(timeoutId);
    }
  }, [location.pathname, user?.id]);

  const handleShoaibGPTToggle = useCallback(() => {
    setShowShoaibGPT(prev => !prev);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <img 
                src="/lovable-uploads/27419a93-c883-4326-ad0d-da831b3cc534.png" 
                alt="Growth OS" 
                className="h-8 w-auto"
                loading="lazy"
              />
              <h1 className="text-xl font-bold text-gray-900">Growth OS</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <NotificationDropdown />
              
              <Button
                onClick={handleShoaibGPTToggle}
                className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white transition-all duration-200 hover-scale"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                ShoaibGPT
              </Button>
              
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 animate-pulse">
                🔥 Streak: 7 days
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white shadow-lg min-h-screen">
          <nav className="mt-8 px-4">
            {/* Main Navigation */}
            <div className="space-y-2 mb-6">
              {mainNavigation.map((item) => {
                const isActive = location.pathname === item.href;
                const Icon = item.icon;
                
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 story-link ${
                      isActive
                        ? "bg-gradient-to-r from-blue-50 to-green-50 text-blue-700 border-l-4 border-blue-600 scale-in"
                        : "text-gray-600 hover:bg-gray-50 hover-scale"
                    }`}
                  >
                    <Icon className={`mr-3 h-5 w-5 transition-colors ${isActive ? "text-blue-600" : "text-gray-400"}`} />
                    {item.name}
                  </Link>
                );
              })}
            </div>

            {/* Assignments Section */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Assignments</h3>
                <Link 
                  to="/assignments"
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  View All
                </Link>
              </div>
              
              <div className="space-y-2">
                {visibleAssignments.map((assignment) => {
                  const isLocked = !assignment.isUnlocked;
                  const isCompleted = assignment.isSubmitted;
                  
                  return (
                    <div
                      key={assignment.assignment_id}
                      className={`flex items-center px-3 py-2 text-sm rounded-lg transition-all duration-200 ${
                        isLocked 
                          ? "text-gray-400 bg-gray-50" 
                          : isCompleted
                          ? "text-green-700 bg-green-50"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {isLocked ? (
                        <Lock className="mr-3 h-4 w-4 text-gray-400" />
                      ) : (
                        <FileText className={`mr-3 h-4 w-4 ${isCompleted ? "text-green-600" : "text-gray-400"}`} />
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className={`truncate ${isLocked ? "text-gray-400" : ""}`}>
                            {assignment.assignment_title}
                          </span>
                          {isCompleted && (
                            <Badge variant="outline" className="ml-2 text-xs bg-green-100 text-green-700 border-green-200">
                              ✓
                            </Badge>
                          )}
                          {isLocked && (
                            <Badge variant="outline" className="ml-2 text-xs bg-gray-100 text-gray-500 border-gray-200">
                              Locked
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Assignment {assignment.sequence_order}
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {assignments.length > 4 && (
                  <div className="text-xs text-gray-500 text-center py-2">
                    +{assignments.length - 4} more assignments
                  </div>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="mt-8 p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg">
              <h3 className="font-semibold text-gray-800 mb-2">Quick Stats</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Progress</span>
                  <span className="font-medium text-blue-600">75%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Rank</span>
                  <span className="font-medium text-green-600">#3</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Next Due</span>
                  <span className="font-medium text-orange-600">2 days</span>
                </div>
              </div>
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8 animate-fade-in">
          <Outlet />
        </main>
      </div>

      {/* ShoaibGPT Modal */}
      {showShoaibGPT && (
        <div className="animate-scale-in">
          <ShoaibGPT onClose={() => setShowShoaibGPT(false)} />
        </div>
      )}
    </div>
  );
};

export default Layout;
