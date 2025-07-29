
import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { logUserActivity, ACTIVITY_TYPES } from "@/lib/activity-logger";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Monitor, 
  BookOpen, 
  FileText, 
  MessageSquare,
  Bell,
  Video,
  ChevronDown,
  ChevronRight,
  LogOut,
  Users,
  UserCheck,
  User,
  Calendar,
  Menu,
  X,
  Activity,
  Building2,
  ShoppingBag,
  Target
} from "lucide-react";
import NotificationDropdown from "./NotificationDropdown";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FloatingActivityButton } from "./FloatingActivityButton";
import { ActivityLogsDialog } from "./ActivityLogsDialog";

interface LayoutProps {
  user: any;
}

const Layout = memo(({ user }: LayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [courseMenuOpen, setCourseMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isBlurred, setIsBlurred] = useState(false);
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

    const checkPaymentStatus = () => {
      // Check if student needs to pay first installment
      if (user?.role === 'student' && user?.onboarding_done) {
        if (user?.fees_overdue || !user?.fees_due_date) {
          setIsBlurred(true);
        } else {
          setIsBlurred(false);
        }
      } else {
        setIsBlurred(false);
      }
    };

    if (user) {
      checkConnections();
      checkPaymentStatus();
    }
  }, [user]);

  // Check if any course submenu is active to keep it expanded
  const isCourseMenuActive = location.search.includes('tab=modules') || 
                            location.search.includes('tab=recordings') || 
                            location.search.includes('tab=assignments') ||
                            location.search.includes('tab=success-sessions');

  // Memoize navigation to prevent unnecessary re-renders
  const navigation = useMemo(() => {
    if (isUserSuperadmin) {
      return [
        { name: "Dashboard", href: "/superadmin", icon: Monitor },
        { 
          name: "Course", 
          icon: BookOpen, 
          isExpandable: true,
          subItems: [
            { name: "Modules", href: "/superadmin?tab=modules", icon: BookOpen },
            { name: "Recordings", href: "/superadmin?tab=recordings", icon: Video },
            { name: "Assignments", href: "/superadmin?tab=assignments", icon: FileText },
            { name: "Success Sessions", href: "/superadmin?tab=success-sessions", icon: Calendar },
          ]
        },
        { name: "Students", href: "/superadmin?tab=students", icon: Users },
        
        { name: "Support", href: "/superadmin?tab=support", icon: MessageSquare },
        { name: "Teams", href: "/teams", icon: UserCheck },
        { name: "Company", href: "/superadmin?tab=company-settings", icon: Building2 },
        { name: "Profile", href: "/profile", icon: User }
      ];
    } else if (isUserAdmin) {
      return [
        { name: "Dashboard", href: "/admin", icon: Monitor },
        { 
          name: "Course", 
          icon: BookOpen, 
          isExpandable: true,
          subItems: [
            { name: "Modules", href: "/admin?tab=modules", icon: BookOpen },
            { name: "Recordings", href: "/admin?tab=recordings", icon: Video },
            { name: "Assignments", href: "/admin?tab=assignments", icon: FileText },
            { name: "Success Sessions", href: "/admin?tab=success-sessions", icon: Calendar },
          ]
        },
        { name: "Students", href: "/admin?tab=students", icon: Users },
        
        { name: "Support", href: "/admin?tab=support", icon: MessageSquare },
        { name: "Teams", href: "/teams", icon: UserCheck },
        { name: "Profile", href: "/profile", icon: User }
      ];
    } else if (isUserMentor) {
      return [
        { name: "Dashboard", href: "/mentor", icon: Monitor },
        { name: "Success Sessions", href: "/mentor/sessions", icon: Calendar },
        
        { name: "Profile", href: "/profile", icon: User }
      ];
    } else if (isUserEnrollmentManager) {
      return [
        { name: "Dashboard", href: "/enrollment-manager", icon: Monitor },
        { name: "Profile", href: "/profile", icon: User }
      ];
    }
    
    // Default navigation for other users (students)
    const baseNavigation = [
      { name: "Dashboard", href: "/", icon: Monitor },
      { name: "Videos", href: "/videos", icon: BookOpen },
      { name: "Assignments", href: "/assignments", icon: FileText },
      { name: "Success Sessions", href: "/live-sessions", icon: Calendar },
      { name: "Connect Accounts", href: "/connect", icon: Activity },
      { name: "Support", href: "/support", icon: MessageSquare },
    ];

    // Add dynamic integrations after Support
    const dynamicItems = [];
    if (connectionStatus.shopify) {
      dynamicItems.push({ name: "Shopify Dashboard", href: "/shopify-dashboard", icon: ShoppingBag });
    }
    if (connectionStatus.meta) {
      dynamicItems.push({ name: "Meta Ads Dashboard", href: "/meta-ads-dashboard", icon: Target });
    }

    // Add Profile at the end
    const profileItem = { name: "Profile", href: "/profile", icon: User };

    return [
      ...baseNavigation,
      ...dynamicItems,
      profileItem,
    ];
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
      const { error } = await supabase.auth.signOut();
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
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 ${isBlurred ? 'filter blur-sm pointer-events-none' : ''}`}>
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                variant="ghost"
                size="sm"
                className="text-gray-600 hover:text-gray-900"
              >
                {sidebarCollapsed ? <Menu className="h-5 w-5" /> : <X className="h-5 w-5" />}
              </Button>
              <img 
                src="/lovable-uploads/3a76ecf9-6551-4196-bc8c-6d43477753df.png" 
                alt="CORE47.AI" 
                className="h-8 w-auto"
                loading="lazy"
              />
              <h1 className="text-xl font-bold text-gray-900">CORE47.AI</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <NotificationDropdown />
              
              {/* Activity Logs Button for authorized users - Only admins and superadmins */}
              {(isUserSuperadmin || isUserAdmin) && (
                <ActivityLogsDialog>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-gray-700 hover:text-blue-600 hover:border-blue-200"
                    title="View Activity Logs"
                  >
                    <Activity className="w-4 h-4 mr-2" />
                    Activity Logs
                  </Button>
                </ActivityLogsDialog>
              )}
              
              <Button
                onClick={handleLogout}
                variant="outline"
                className="text-gray-700 hover:text-red-600 hover:border-red-200"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-white shadow-lg min-h-screen transition-all duration-300`}>
          <nav className={`mt-8 ${sidebarCollapsed ? 'px-2' : 'px-4'}`}>
            <div className="space-y-2">
              {navigation.map((item) => {
                if (item.isExpandable) {
                  const isExpanded = courseMenuOpen && !sidebarCollapsed;
                  const Icon = item.icon;
                  
                  return (
                    <div key={item.name}>
                      <button
                        onClick={() => !sidebarCollapsed && setCourseMenuOpen(!courseMenuOpen)}
                        className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 text-gray-600 hover:bg-gray-50 hover-scale"
                        title={sidebarCollapsed ? item.name : undefined}
                      >
                        <div className="flex items-center">
                          <Icon className={`${sidebarCollapsed ? 'mr-0' : 'mr-3'} h-5 w-5 text-gray-400`} />
                          {!sidebarCollapsed && item.name}
                        </div>
                        {!sidebarCollapsed && (isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        ))}
                      </button>
                      
                      {isExpanded && !sidebarCollapsed && (
                        <div className="ml-4 mt-2 space-y-1 animate-accordion-down">
                          {item.subItems?.map((subItem) => {
                            const isActive = location.search.includes(`tab=${subItem.href.split('=')[1]}`);
                            const SubIcon = subItem.icon;
                            
                            return (
                              <Link
                                key={subItem.name}
                                to={subItem.href}
                                className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 story-link ${
                                  isActive
                                    ? "bg-gray-200 text-gray-900 border-l-4 border-blue-600 shadow-lg scale-105"
                                    : "text-gray-600 hover:bg-gray-100 hover-scale"
                                }`}
                              >
                                <SubIcon className={`mr-3 h-4 w-4 transition-colors ${isActive ? "text-gray-900" : "text-gray-400"}`} />
                                {subItem.name}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }
                
                const isActive = location.pathname === item.href || 
                                (item.href.includes('?tab=') && location.search.includes(item.href.split('=')[1]));
                const Icon = item.icon;
                
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 story-link ${
                      isActive
                        ? "bg-gray-200 text-gray-900 border-l-4 border-blue-600 shadow-lg scale-105"
                        : "text-gray-600 hover:bg-gray-100 hover-scale"
                    }`}
                    title={sidebarCollapsed ? item.name : undefined}
                  >
                    <Icon className={`${sidebarCollapsed ? 'mr-0' : 'mr-3'} h-5 w-5 transition-colors ${isActive ? "text-gray-900" : "text-gray-400"}`} />
                    {!sidebarCollapsed && item.name}
                  </Link>
                );
              })}
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main className={`flex-1 p-8 animate-fade-in ${isBlurred ? 'filter blur-sm pointer-events-none' : ''}`}>
          <Outlet />
        </main>
      </div>
      
      {/* Floating Activity Button */}
      <FloatingActivityButton />
    </div>
  );
});

Layout.displayName = 'Layout';

export default Layout;
