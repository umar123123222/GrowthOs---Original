
import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  Calendar
} from "lucide-react";
import NotificationDropdown from "./NotificationDropdown";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface LayoutProps {
  user: any;
}

const Layout = ({ user }: LayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [courseMenuOpen, setCourseMenuOpen] = useState(false);

  // Check if user is on superadmin route to show appropriate menu
  const isUserSuperadmin = user?.role === 'superadmin';

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
        { name: "Teams", href: "/teams", icon: UserCheck },
        { name: "Profile", href: "/profile", icon: User }
      ];
    }
    
    // Default navigation for other users
    return [
      { name: "Dashboard", href: "/", icon: Monitor },
      { name: "Videos", href: "/videos", icon: BookOpen },
      { name: "Assignments", href: "/assignments", icon: FileText },
    ];
  }, [isUserSuperadmin]);

  // Auto-expand course menu if any course tab is active
  useEffect(() => {
    if (isCourseMenuActive) {
      setCourseMenuOpen(true);
    }
  }, [isCourseMenuActive]);

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="w-full px-4 sm:px-6 lg:px-8">
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
        <aside className="w-64 bg-white shadow-lg min-h-screen">
          <nav className="mt-8 px-4">
            <div className="space-y-2">
              {navigation.map((item) => {
                if (item.isExpandable) {
                  const isExpanded = courseMenuOpen;
                  const Icon = item.icon;
                  
                  return (
                    <div key={item.name}>
                      <button
                        onClick={() => setCourseMenuOpen(!courseMenuOpen)}
                        className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 text-gray-600 hover:bg-gray-50 hover-scale"
                      >
                        <div className="flex items-center">
                          <Icon className="mr-3 h-5 w-5 text-gray-400" />
                          {item.name}
                        </div>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                      
                      {isExpanded && (
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
                                    ? "bg-gradient-to-r from-blue-50 to-green-50 text-blue-700 border-l-4 border-blue-600 scale-in"
                                    : "text-gray-600 hover:bg-gray-50 hover-scale"
                                }`}
                              >
                                <SubIcon className={`mr-3 h-4 w-4 transition-colors ${isActive ? "text-blue-600" : "text-gray-400"}`} />
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
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8 animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
