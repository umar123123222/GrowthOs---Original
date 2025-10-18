import React, { Suspense, useState, useEffect, useCallback, useMemo, useRef, memo } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import SuccessPartner from "@/components/SuccessPartner";
import { logUserActivity, ACTIVITY_TYPES } from "@/lib/activity-logger";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Monitor, BookOpen, FileText, MessageSquare, Bell, Video, ChevronDown, ChevronRight, LogOut, Users, UserCheck, User, Calendar, Menu, X, Activity, Building2, ShoppingBag, Target, MessageCircle, Trophy, BarChart3, AlertTriangle } from "lucide-react";
import NotificationDropdown from "./NotificationDropdown";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FloatingActivityButton } from "./FloatingActivityButton";
import { ActivityLogsDialog } from "./ActivityLogsDialog";
import { MotivationalNotifications } from "./MotivationalNotifications";
import { AppLogo } from "./AppLogo";
import { PageSkeleton } from "./LoadingStates/PageSkeleton";
import RouteContentLoader from "./LoadingStates/RouteContentLoader";
import { throttle } from "@/utils/performance";
import { safeLogger } from '@/lib/safe-logger';
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
    const items = [{
      to: "/",
      icon: Monitor,
      label: "Dashboard",
      roles: ['student', 'admin', 'superadmin', 'mentor', 'enrollment_manager']
    }, {
      to: "/videos",
      icon: Video,
      label: "Modules & Videos",
      roles: ['student', 'admin', 'superadmin', 'mentor']
    }, {
      to: "/assignments",
      icon: FileText,
      label: "Assignments",
      roles: ['student', 'admin', 'superadmin', 'mentor']
    }, {
      to: "/live-sessions",
      icon: Calendar,
      label: "Live Sessions",
      roles: ['student', 'admin', 'superadmin', 'mentor']
    }, {
      to: "/mentorship",
      icon: Users,
      label: "Mentorship",
      roles: ['student', 'mentor']
    }, {
      to: "/teams",
      icon: Users,
      label: "Teams",
      roles: ['admin', 'superadmin']
    }, {
      to: "/support",
      icon: MessageSquare,
      label: "Support",
      roles: ['student', 'admin', 'superadmin', 'mentor']
    }];

    // Add conditional items based on user role
    if (isUserSuperadmin) {
      items.push({
        to: "/superadmin",
        icon: Building2,
        label: "Super Admin",
        roles: ['superadmin']
      });
    }
    if (isUserAdmin || isUserSuperadmin) {
      items.push({
        to: "/admin",
        icon: UserCheck,
        label: "Admin Panel",
        roles: ['admin', 'superadmin']
      });
    }
    if (isUserMentor) {
      items.push({
        to: "/mentor",
        icon: User,
        label: "Mentor Dashboard",
        roles: ['mentor']
      });
    }
    if (isUserEnrollmentManager) {
      items.push({
        to: "/enrollment-manager",
        icon: UserCheck,
        label: "Enrollment Manager",
        roles: ['enrollment_manager']
      });
    }
    return items;
  }, [isUserSuperadmin, isUserAdmin, isUserMentor, isUserEnrollmentManager]);
  return <nav className="space-y-2 px-4">
      {navigationItems.map(item => <Link key={item.to} to={item.to} className={`
            flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200
            ${location.pathname === item.to ? 'bg-primary text-primary-foreground shadow-sm' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'}
            ${sidebarCollapsed ? 'justify-center' : ''}
          `}>
          <item.icon className="h-4 w-4 flex-shrink-0" />
          {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
        </Link>)}
      
      {/* Course navigation */}
      {!sidebarCollapsed && <div className="pt-4">
          <button onClick={() => setCourseMenuOpen(!courseMenuOpen)} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors w-full">
            <BookOpen className="h-4 w-4" />
            <span>Course</span>
            {courseMenuOpen ? <ChevronDown className="h-4 w-4 ml-auto" /> : <ChevronRight className="h-4 w-4 ml-auto" />}
          </button>
          
          {courseMenuOpen && <div className="ml-6 mt-2 space-y-2">
              <Link to="/certificates" className={`
                  flex items-center gap-2 px-3 py-1 text-sm rounded-md transition-colors
                  ${location.pathname === '/certificates' ? 'bg-primary text-primary-foreground' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                `}>
                Certificates
              </Link>
              <Link to="/leaderboard" className={`
                  flex items-center gap-2 px-3 py-1 text-sm rounded-md transition-colors
                  ${location.pathname === '/leaderboard' ? 'bg-primary text-primary-foreground' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                `}>
                Leaderboard
              </Link>
            </div>}
        </div>}
      
      {/* Connection status indicators */}
      {!sidebarCollapsed && (connectionStatus.shopify || connectionStatus.meta) && <div className="pt-4 border-t border-gray-200">
          <div className="px-3 py-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Integrations
            </h3>
            <div className="space-y-2">
              {connectionStatus.shopify && <Link to="/shopify" className={`
                    flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors
                    ${location.pathname === '/shopify' ? 'bg-primary text-primary-foreground' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                  `}>
                  <ShoppingBag className="h-4 w-4" />
                  <span>Shopify</span>
                  <Badge variant="outline" className="ml-auto text-xs">
                    Connected
                  </Badge>
                </Link>}
              {connectionStatus.meta && <Link to="/meta-ads" className={`
                    flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors
                    ${location.pathname === '/meta-ads' ? 'bg-primary text-primary-foreground' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                  `}>
                  <Target className="h-4 w-4" />
                  <span>Meta Ads</span>
                  <Badge variant="outline" className="ml-auto text-xs">
                    Connected
                  </Badge>
                </Link>}
            </div>
          </div>
        </div>}
    </nav>;
});
NavigationItems.displayName = "NavigationItems";
const Layout = memo(({
  user
}: LayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const [courseMenuOpen, setCourseMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [showSuccessPartner, setShowSuccessPartner] = useState(false);
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
    let isMounted = true;
    const checkConnections = async () => {
      if (!user?.id) return;
      try {
        // First try to get connections from integrations table
        const {
          data,
          error
        } = await supabase.from('integrations').select('source, access_token').eq('user_id', user.id);
        
        if (!error && data && data.length > 0) {
          if (!isMounted) return;
          const hasShopify = !!data.some((r: any) => r.source === 'shopify' && r.access_token);
          const hasMeta = !!data.some((r: any) => r.source === 'meta_ads' && r.access_token);
          safeLogger.debug('Connection check - integrations data', { data, hasShopify, hasMeta });
          setConnectionStatus({
            shopify: hasShopify,
            meta: hasMeta
          });
          return;
        }
        
        // Fallback: Check users table for credential fields
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('shopify_credentials, meta_ads_credentials')
          .eq('id', user.id)
          .single();
          
        if (!userError && userData) {
          if (!isMounted) return;
          const hasShopify = !!(userData.shopify_credentials);
          const hasMeta = !!(userData.meta_ads_credentials);
          safeLogger.debug('Connection check - user credentials', { userData, hasShopify, hasMeta });
          setConnectionStatus({
            shopify: hasShopify,
            meta: hasMeta
          });
        } else {
          safeLogger.debug('No connections found in either table');
          setConnectionStatus({
            shopify: false,
            meta: false
          });
        }
      } catch (e) {
        console.error('Error checking connections:', e);
        setConnectionStatus({
          shopify: false,
          meta: false
        });
      }
    };
    if (user?.id) {
      checkConnections();
      (window as any).checkIntegrations = checkConnections;
    }
    return () => {
      isMounted = false;
      if ((window as any).checkIntegrations) delete (window as any).checkIntegrations;
    };
  }, [user?.id]);

  // Prefetch route chunks on idle to reduce perceived load during navigation
  useEffect(() => {
    const idle = (cb: () => void) => "requestIdleCallback" in window ? (window as any).requestIdleCallback(cb) : setTimeout(cb, 1200);
    const idleId: any = idle(() => {
      Promise.allSettled([import("@/pages/Profile"), import("@/pages/Teams"), import("@/pages/Support"), import("@/pages/Connect"), import("@/pages/MentorSessionsPage"), import("@/pages/ShopifyDashboard"), import("@/pages/MetaAdsDashboard")]);
    });
    return () => {
      if (typeof idleId === "number") {
        clearTimeout(idleId);
      } else if ("cancelIdleCallback" in window) {
        (window as any).cancelIdleCallback(idleId);
      }
    };
  }, []);

  // Hover prefetch for sidebar links
  const prefetchByHref = useCallback((href: string) => {
    try {
      if (href.startsWith("/profile")) import("@/pages/Profile");else if (href.startsWith("/teams")) import("@/pages/Teams");else if (href.startsWith("/support")) import("@/pages/Support");else if (href.startsWith("/connect")) import("@/pages/Connect");else if (href.startsWith("/mentor/sessions")) import("@/pages/MentorSessionsPage");else if (href.startsWith("/shopify-dashboard")) import("@/pages/ShopifyDashboard");else if (href.startsWith("/meta-ads-dashboard")) import("@/pages/MetaAdsDashboard");else if (href.startsWith("/admin")) import("@/pages/AdminDashboard");else if (href.startsWith("/superadmin")) import("@/pages/SuperadminDashboard");else if (href.startsWith("/enrollment-manager")) import("@/pages/EnrollmentManagerDashboard");
    } catch (e) {
      // noop
    }
  }, []);

  // Check if any course submenu is active to keep it expanded
  const isCourseMenuActive = location.search.includes('tab=modules') || location.search.includes('tab=recordings') || location.search.includes('tab=assignments') || location.search.includes('tab=submissions') || location.search.includes('tab=success-sessions') || location.search.includes('tab=milestones');

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
        }, {
          name: "Milestones",
          href: "/superadmin?tab=milestones",
          icon: Trophy
        }]
      }, {
        name: "Students",
        href: "/superadmin?tab=students",
        icon: Users
      }, {
        name: "Analytics",
        href: "/superadmin?tab=analytics",
        icon: BarChart3
      }, {
        name: "Support",
        href: "/superadmin?tab=support",
        icon: MessageSquare
      }, {
        name: "Teams",
        href: "/teams",
        icon: UserCheck
      }, {
        name: "Error Logs",
        href: "/superadmin?tab=error-logs",
        icon: AlertTriangle
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
        }, {
          name: "Milestones",
          href: "/admin?tab=milestones",
          icon: Trophy
        }]
      }, {
        name: "Students",
        href: "/admin?tab=students",
        icon: Users
      }, {
        name: "Analytics",
        href: "/admin?tab=analytics",
        icon: BarChart3
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
        name: "Modules",
        href: "/mentor/modules",
        icon: BookOpen
      }, {
        name: "Recordings",
        href: "/mentor/recordings",
        icon: Video
      }, {
        name: "Assignments",
        href: "/mentor/assignments",
        icon: FileText
      }, {
        name: "Submissions",
        href: "/mentor/submissions",
        icon: MessageSquare
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

    // Insert dynamic integrations right after Connect Accounts
    const dynamicItems: any[] = [];
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

    // Find the index of "Connect Accounts" and insert right after it
    const connectIdx = baseNavigation.findIndex(i => i.href === "/connect");
    const withIntegrations = [...baseNavigation];
    if (connectIdx !== -1 && dynamicItems.length) {
      withIntegrations.splice(connectIdx + 1, 0, ...dynamicItems);
    }

    // Add Profile at the end
    const profileItem = {
      name: "Profile",
      href: "/profile",
      icon: User
    };
    return [...withIntegrations, profileItem];
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
  return <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900">
                {sidebarCollapsed ? <Menu className="h-5 w-5" /> : <X className="h-5 w-5" />}
              </Button>
              <Link to="/" className="flex items-center gap-2" aria-label="Home">
                <AppLogo className="h-16 w-auto max-w-[240px]" alt="Company logo" />
                <span className="text-xl font-bold text-gray-900">GrowthOS</span>
              </Link>
            </div>
            
            <div className="flex items-center space-x-4">
              <NotificationDropdown />
              
              {/* Success Partner Button - Only for students */}
              {user?.role === 'student' && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-gray-700 hover:text-blue-600 hover:border-blue-200"
                  onClick={() => setShowSuccessPartner(true)}
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Success Partner
                </Button>
              )}
              
              {/* Activity Logs Button for authorized users - Only admins and superadmins */}
              {(isUserSuperadmin || isUserAdmin) && <ActivityLogsDialog>
                  <Button variant="outline" size="sm" className="text-gray-700 hover:text-blue-600 hover:border-blue-200" title="View Activity Logs">
                    <Activity className="w-4 h-4 mr-2" />
                    Activity Logs
                  </Button>
                </ActivityLogsDialog>}
              
              <Button onClick={handleLogout} variant="outline" className="text-gray-700 hover:text-red-600 hover:border-red-200">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`${sidebarCollapsed ? 'w-16' : 'w-80'} bg-white shadow-lg min-h-screen transition-all duration-300 fixed top-16 left-0 z-30 overflow-y-auto`}>
          <nav className={`mt-8 ${sidebarCollapsed ? 'px-2' : 'px-4'}`}>
            <div className="space-y-2">
              {navigation.map(item => {
              if (item.isExpandable) {
                const isExpanded = courseMenuOpen && !sidebarCollapsed;
                const Icon = item.icon;
                return <div key={item.name}>
                      <button onClick={() => !sidebarCollapsed && setCourseMenuOpen(!courseMenuOpen)} className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 text-gray-600 hover:bg-gray-50 hover-scale" title={sidebarCollapsed ? item.name : undefined}>
                        <div className="flex items-center">
                          <Icon className={`${sidebarCollapsed ? 'mr-0' : 'mr-3'} h-5 w-5 text-gray-400`} />
                          {!sidebarCollapsed && item.name}
                        </div>
                        {!sidebarCollapsed && (isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
                      </button>
                      
                      {isExpanded && !sidebarCollapsed && <div className="ml-4 mt-2 space-y-1 animate-accordion-down">
                          {item.subItems?.map(subItem => {
                      const isActive = location.search.includes(`tab=${subItem.href.split('=')[1]}`);
                      const SubIcon = subItem.icon;
                      return <Link key={subItem.name} to={subItem.href} onMouseEnter={() => prefetchByHref(subItem.href)} className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 story-link ${isActive ? "bg-gray-200 text-gray-900 border-l-4 border-blue-600 shadow-lg scale-105" : "text-gray-600 hover:bg-gray-100 hover-scale"}`}>
                                <SubIcon className={`mr-3 h-4 w-4 transition-colors ${isActive ? "text-gray-900" : "text-gray-400"}`} />
                                {subItem.name}
                              </Link>;
                    })}
                        </div>}
                    </div>;
              }
              const searchParams = new URLSearchParams(location.search);
              const currentTab = searchParams.get('tab');
              const isTabLink = item.href.includes('?tab=');
              const itemTab = isTabLink ? item.href.split('=')[1] : null;
              // Active when:
              // - tab link matches current tab
              // - OR base path matches and no tab is selected (or tab=dashboard)
              const isActive = isTabLink && currentTab === itemTab || !isTabLink && location.pathname === item.href && (!currentTab || currentTab === 'dashboard');
              const Icon = item.icon;
              return <Link key={item.name} to={item.href} onMouseEnter={() => prefetchByHref(item.href)} className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 story-link ${isActive ? "bg-gray-200 text-gray-900 border-l-4 border-blue-600 shadow-lg scale-105" : "text-gray-600 hover:bg-gray-100 hover-scale"}`} title={sidebarCollapsed ? item.name : undefined}>
                    <Icon className={`${sidebarCollapsed ? 'mr-0' : 'mr-3'} h-5 w-5 transition-colors ${isActive ? "text-gray-900" : "text-gray-400"}`} />
                    {!sidebarCollapsed && item.name}
                  </Link>;
            })}
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main className={`flex-1 w-full max-w-full overflow-x-hidden pt-24 animate-fade-in ${sidebarCollapsed ? 'pl-16' : 'pl-80'} transition-all duration-300`}>
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-[10px] py-0">
            <Suspense fallback={<RouteContentLoader path={location.pathname} />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
      
      {/* Floating Activity Button */}
      <FloatingActivityButton />
      
      {/* Motivational Notifications for Students */}
      {user?.role === 'student' && <MotivationalNotifications />}
      
      {/* Success Partner Dialog */}
      {showSuccessPartner && user?.id && user?.email && (
        <SuccessPartner 
          onClose={() => setShowSuccessPartner(false)}
          user={{
            id: user.id,
            full_name: user.full_name || user.email.split('@')[0] || 'Student',
            email: user.email
          }}
        />
      )}
    </div>;
});
Layout.displayName = 'Layout';
export default Layout;