import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { logUserActivity, ACTIVITY_TYPES } from "@/lib/activity-logger";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Monitor, BookOpen, FileText, MessageSquare, Bell, Video, ChevronDown, ChevronRight, LogOut, Users, UserCheck, User, Calendar, Menu, X, Activity, Building2, ShoppingBag, Target } from "lucide-react";
import NotificationDropdown from "./NotificationDropdown";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FloatingActivityButton } from "./FloatingActivityButton";
import { ActivityLogsDialog } from "./ActivityLogsDialog";
import { MotivationalNotifications } from "./MotivationalNotifications";
import { MobileNav } from "@/components/ui/mobile-nav";
import { useIsMobile } from "@/hooks/use-mobile";

import { PageSkeleton } from "./LoadingStates/PageSkeleton";
import { throttle } from "@/utils/performance";
interface LayoutProps {
  user: any;
}

// Memoized navigation items to prevent unnecessary re-computations
const NavigationItems = memo(({ 
  isUserSuperadmin, 
  isUserAdmin, 
  isUserMentor, 
  isUserEnrollmentManager,
  connectionStatus,
  courseMenuOpen,
  setCourseMenuOpen,
  location,
  sidebarCollapsed 
}: any) => {
  const navigationItems = useMemo(() => {
    const items = [
      {
        to: "/",
        icon: Monitor,
        label: "Dashboard",
        roles: ['student', 'admin', 'superadmin', 'mentor', 'enrollment_manager']
      },
      {
        to: "/videos",
        icon: Video,
        label: "Modules & Videos",
        roles: ['student', 'admin', 'superadmin', 'mentor']
      },
      {
        to: "/assignments",
        icon: FileText,
        label: "Assignments",
        roles: ['student', 'admin', 'superadmin', 'mentor']
      },
      {
        to: "/live-sessions",
        icon: Calendar,
        label: "Live Sessions",
        roles: ['student', 'admin', 'superadmin', 'mentor']
      },
      {
        to: "/mentorship",
        icon: Users,
        label: "Mentorship",
        roles: ['student', 'mentor']
      },
      {
        to: "/teams",
        icon: Users,
        label: "Teams",
        roles: ['admin', 'superadmin']
      },
      {
        to: "/support",
        icon: MessageSquare,
        label: "Support",
        roles: ['student', 'admin', 'superadmin', 'mentor']
      }
    ];

    // Add conditional items based on user role
    if (isUserSuperadmin) {
      items.push(
        {
          to: "/superadmin",
          icon: Building2,
          label: "Super Admin",
          roles: ['superadmin']
        }
      );
    }

    if (isUserAdmin || isUserSuperadmin) {
      items.push(
        {
          to: "/admin",
          icon: UserCheck,
          label: "Admin Panel",
          roles: ['admin', 'superadmin']
        }
      );
    }

    if (isUserMentor) {
      items.push(
        {
          to: "/mentor",
          icon: User,
          label: "Mentor Dashboard",
          roles: ['mentor']
        }
      );
    }

    if (isUserEnrollmentManager) {
      items.push(
        {
          to: "/enrollment-manager",
          icon: UserCheck,
          label: "Enrollment Manager",
          roles: ['enrollment_manager']
        }
      );
    }

    return items;
  }, [isUserSuperadmin, isUserAdmin, isUserMentor, isUserEnrollmentManager]);

  return (
    <nav className="space-y-2 px-4">
      {navigationItems.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className={`
            flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200
            ${location.pathname === item.to
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
            }
            ${sidebarCollapsed ? 'justify-center' : ''}
          `}
        >
          <item.icon className="h-4 w-4 flex-shrink-0" />
          {!sidebarCollapsed && (
            <span className="truncate">{item.label}</span>
          )}
        </Link>
      ))}
      
      {/* Course navigation */}
      {!sidebarCollapsed && (
        <div className="pt-4">
          <button
            onClick={() => setCourseMenuOpen(!courseMenuOpen)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors w-full"
          >
            <BookOpen className="h-4 w-4" />
            <span>Course</span>
            {courseMenuOpen ? <ChevronDown className="h-4 w-4 ml-auto" /> : <ChevronRight className="h-4 w-4 ml-auto" />}
          </button>
          
          {courseMenuOpen && (
            <div className="ml-6 mt-2 space-y-2">
              <Link
                to="/quizzes"
                className={`
                  flex items-center gap-2 px-3 py-1 text-sm rounded-md transition-colors
                  ${location.pathname === '/quizzes'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
              >
                Quizzes
              </Link>
              <Link
                to="/certificates"
                className={`
                  flex items-center gap-2 px-3 py-1 text-sm rounded-md transition-colors
                  ${location.pathname === '/certificates'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
              >
                Certificates
              </Link>
              <Link
                to="/leaderboard"
                className={`
                  flex items-center gap-2 px-3 py-1 text-sm rounded-md transition-colors
                  ${location.pathname === '/leaderboard'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
              >
                Leaderboard
              </Link>
            </div>
          )}
        </div>
      )}
      
      {/* Connection status indicators */}
      {!sidebarCollapsed && (connectionStatus.shopify || connectionStatus.meta) && (
        <div className="pt-4 border-t border-gray-200">
          <div className="px-3 py-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Integrations
            </h3>
            <div className="space-y-2">
              {connectionStatus.shopify && (
                <Link
                  to="/shopify"
                  className={`
                    flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors
                    ${location.pathname === '/shopify'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }
                  `}
                >
                  <ShoppingBag className="h-4 w-4" />
                  <span>Shopify</span>
                  <Badge variant="outline" className="ml-auto text-xs">
                    Connected
                  </Badge>
                </Link>
              )}
              {connectionStatus.meta && (
                <Link
                  to="/meta-ads"
                  className={`
                    flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors
                    ${location.pathname === '/meta-ads'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }
                  `}
                >
                  <Target className="h-4 w-4" />
                  <span>Meta Ads</span>
                  <Badge variant="outline" className="ml-auto text-xs">
                    Connected
                  </Badge>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
});

NavigationItems.displayName = "NavigationItems";

const Layout = memo(({
  user
}: LayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [courseMenuOpen, setCourseMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  const [connectionStatus, setConnectionStatus] = useState({
    shopify: false,
    meta: false
  });

  // Check if user is superadmin, admin, mentor, enrollment_manager, or regular user
  const isUserSuperadmin = user?.role === 'superadmin';
  const isUserAdmin = user?.role === 'admin';
  const isUserMentor = user?.role === 'mentor';
  const isUserEnrollmentManager = user?.role === 'enrollment_manager';
  const isUserAdminOrSuperadmin = isUserSuperadmin || isUserAdmin;

  // Check connection status on mount and when user changes
  useEffect(() => {
    const checkConnections = () => {
      // Check Shopify connection from user credentials
      const shopifyCredentials = user?.shopify_credentials;
      // Check Meta connection from user credentials
      const metaCredentials = user?.meta_ads_credentials;
      setConnectionStatus({
        shopify: !!shopifyCredentials,
        meta: !!metaCredentials
      });
    };
    if (user) {
      checkConnections();
    }
  }, [user]);

  // Check if any course submenu is active to keep it expanded
  const isCourseMenuActive = location.search.includes('tab=modules') || location.search.includes('tab=recordings') || location.search.includes('tab=assignments') || location.search.includes('tab=submissions') || location.search.includes('tab=success-sessions');

  // Memoize navigation to prevent unnecessary re-renders
  const navigation = useMemo(() => {
    if (isUserSuperadmin) {
      return [{
        name: "Dashboard",
        href: "/superadmin",
        icon: Monitor
      }, {
        name: "Course",
        icon: BookOpen,
        isExpandable: true,
        subItems: [{
          name: "Modules",
          href: "/superadmin?tab=modules",
          icon: BookOpen
        }, {
          name: "Recordings",
          href: "/superadmin?tab=recordings",
          icon: Video
        }, {
          name: "Assignments",
          href: "/superadmin?tab=assignments",
          icon: FileText
        }, {
          name: "Submissions",
          href: "/superadmin?tab=submissions",
          icon: FileText
        }, {
          name: "Success Sessions",
          href: "/superadmin?tab=success-sessions",
          icon: Calendar
        }]
      }, {
        name: "Students",
        href: "/superadmin?tab=students",
        icon: Users
      }, {
        name: "Support",
        href: "/superadmin?tab=support",
        icon: MessageSquare
      }, {
        name: "Teams",
        href: "/teams",
        icon: UserCheck
      }, {
        name: "Company",
        href: "/superadmin?tab=company-settings",
        icon: Building2
      }, {
        name: "Profile",
        href: "/profile",
        icon: User
      }];
    } else if (isUserAdmin) {
      return [{
        name: "Dashboard",
        href: "/admin",
        icon: Monitor
      }, {
        name: "Course",
        icon: BookOpen,
        isExpandable: true,
        subItems: [{
          name: "Modules",
          href: "/admin?tab=modules",
          icon: BookOpen
        }, {
          name: "Recordings",
          href: "/admin?tab=recordings",
          icon: Video
        }, {
          name: "Assignments",
          href: "/admin?tab=assignments",
          icon: FileText
        }, {
          name: "Submissions",
          href: "/admin?tab=submissions",
          icon: FileText
        }, {
          name: "Success Sessions",
          href: "/admin?tab=success-sessions",
          icon: Calendar
        }]
      }, {
        name: "Students",
        href: "/admin?tab=students",
        icon: Users
      }, {
        name: "Support",
        href: "/admin?tab=support",
        icon: MessageSquare
      }, {
        name: "Teams",
        href: "/teams",
        icon: UserCheck
      }, {
        name: "Profile",
        href: "/profile",
        icon: User
      }];
    } else if (isUserMentor) {
      return [{
        name: "Dashboard",
        href: "/mentor",
        icon: Monitor
      }, {
        name: "Success Sessions",
        href: "/mentor/sessions",
        icon: Calendar
      }, {
        name: "Profile",
        href: "/profile",
        icon: User
      }];
    } else if (isUserEnrollmentManager) {
      return [{
        name: "Dashboard",
        href: "/enrollment-manager",
        icon: Monitor
      }, {
        name: "Profile",
        href: "/profile",
        icon: User
      }];
    }

    // Default navigation for other users (students)
    const baseNavigation = [{
      name: "Dashboard",
      href: "/",
      icon: Monitor
    }, {
      name: "Videos",
      href: "/videos",
      icon: BookOpen
    }, {
      name: "Assignments",
      href: "/assignments",
      icon: FileText
    }, {
      name: "Success Sessions",
      href: "/live-sessions",
      icon: Calendar
    }, {
      name: "Connect Accounts",
      href: "/connect",
      icon: Activity
    }, {
      name: "Support",
      href: "/support",
      icon: MessageSquare
    }];

    // Add dynamic integrations after Support
    const dynamicItems = [];
    if (connectionStatus.shopify) {
      dynamicItems.push({
        name: "Shopify Dashboard",
        href: "/shopify-dashboard",
        icon: ShoppingBag
      });
    }
    if (connectionStatus.meta) {
      dynamicItems.push({
        name: "Meta Ads Dashboard",
        href: "/meta-ads-dashboard",
        icon: Target
      });
    }

    // Add Profile at the end
    const profileItem = {
      name: "Profile",
      href: "/profile",
      icon: User
    };
    return [...baseNavigation, ...dynamicItems, profileItem];
  }, [isUserSuperadmin, isUserAdmin, isUserMentor, isUserEnrollmentManager, connectionStatus]);

  // Auto-expand course menu if any course tab is active
  useEffect(() => {
    if (isCourseMenuActive) {
      setCourseMenuOpen(true);
    }
  }, [isCourseMenuActive]);

  // Optimized logging with error handling and debouncing
  const logActivityRef = useRef<NodeJS.Timeout>();
  useEffect(() => {
    if (user?.id) {
      // Clear any existing timeout
      if (logActivityRef.current) {
        clearTimeout(logActivityRef.current);
      }

      // Debounce activity logging to prevent spam
      logActivityRef.current = setTimeout(() => {
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
      }, 500); // Increased delay for better debouncing

      return () => {
        if (logActivityRef.current) {
          clearTimeout(logActivityRef.current);
        }
      };
    }
  }, [location.pathname, user?.id]);
  const handleLogout = async () => {
    try {
      const {
        error
      } = await supabase.auth.signOut();
      if (error) throw error;
      toast({
        title: "Logged out successfully",
        description: "You have been signed out of your account"
      });
      navigate('/login');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to log out. Please try again.",
        variant: "destructive"
      });
    }
  };
  return (
    <div className="min-h-screen bg-background">
      {/* Mobile/Desktop Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 sm:h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Mobile Navigation */}
            {isMobile ? (
              <MobileNav user={user} connectionStatus={connectionStatus} />
            ) : (
              <Button 
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)} 
                variant="ghost" 
                size="sm" 
                className="text-muted-foreground hover:text-foreground h-9 w-9 p-0"
                aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {sidebarCollapsed ? <Menu className="h-5 w-5" /> : <X className="h-5 w-5" />}
              </Button>
            )}
            <h1 className="text-lg sm:text-xl font-bold text-foreground truncate">
              GrowthOS
            </h1>
          </div>
          
          <div className="flex items-center space-x-2 sm:space-x-4">
            <NotificationDropdown />
            
            {/* Activity Logs Button - Hidden on mobile, shown on tablet+ */}
            {(isUserSuperadmin || isUserAdmin) && !isMobile && (
              <ActivityLogsDialog>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="hidden sm:flex text-muted-foreground hover:text-primary hover:border-primary/50 h-9"
                  title="View Activity Logs"
                >
                  <Activity className="w-4 h-4 sm:mr-2" />
                  <span className="hidden lg:inline">Activity Logs</span>
                </Button>
              </ActivityLogsDialog>
            )}
            
            <Button 
              onClick={handleLogout} 
              variant="outline" 
              size="sm"
              className="text-muted-foreground hover:text-destructive hover:border-destructive/50 h-9 min-w-[44px]"
            >
              <LogOut className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Desktop Sidebar - Hidden on mobile */}
        {!isMobile && (
          <aside className={`${sidebarCollapsed ? 'w-16' : 'w-64 lg:w-80'} bg-card border-r min-h-[calc(100vh-3.5rem)] sm:min-h-[calc(100vh-4rem)] transition-all duration-300 fixed top-14 sm:top-16 left-0 z-40 overflow-y-auto`}>
            <NavigationItems
              isUserSuperadmin={isUserSuperadmin}
              isUserAdmin={isUserAdmin}
              isUserMentor={isUserMentor}
              isUserEnrollmentManager={isUserEnrollmentManager}
              connectionStatus={connectionStatus}
              courseMenuOpen={courseMenuOpen}
              setCourseMenuOpen={setCourseMenuOpen}
              location={location}
              sidebarCollapsed={sidebarCollapsed}
            />
          </aside>
        )}

        {/* Main Content */}
        <main className={`flex-1 animate-fade-in ${
          !isMobile 
            ? `${sidebarCollapsed ? 'ml-16' : 'ml-64 lg:ml-80'} transition-all duration-300` 
            : ''
        }`}>
          <div className="min-h-[calc(100vh-3.5rem)] sm:min-h-[calc(100vh-4rem)]">
            <Outlet />
          </div>
        </main>
      </div>
      
      {/* Floating Activity Button - Hidden on mobile */}
      {!isMobile && <FloatingActivityButton />}
      
      {/* Motivational Notifications for Students */}
      {user?.role === 'student' && <MotivationalNotifications />}
    </div>
  );
});
Layout.displayName = 'Layout';
export default Layout;