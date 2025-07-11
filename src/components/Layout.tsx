
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { logUserActivity, ACTIVITY_TYPES } from "@/lib/activity-logger";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Award
} from "lucide-react";
import ShoaibGPT from "./ShoaibGPT";
import NotificationDropdown from "./NotificationDropdown";

interface LayoutProps {
  user: any;
}

const Layout = ({ user }: LayoutProps) => {
  const location = useLocation();
  const [showShoaibGPT, setShowShoaibGPT] = useState(false);

  // Memoize navigation to prevent unnecessary re-renders
  const navigation = useMemo(() => [
    { name: "Dashboard", href: "/", icon: Monitor },
    { name: "Videos", href: "/videos", icon: BookOpen },
    { name: "Assignments", href: "/assignments", icon: FileText },
    { name: "Quizzes", href: "/quizzes", icon: Brain },
    { name: "Live Sessions", href: "/live-sessions", icon: Video },
    { name: "Mentorship", href: "/mentorship", icon: Users },
    { name: "Leaderboard", href: "/leaderboard", icon: Star },
    { name: "Certificates", href: "/certificates", icon: Award },
    { name: "Messages", href: "/messages", icon: MessageSquare },
    { name: "Profile", href: "/profile", icon: User },
  ], []);

  // Optimized logging with throttling
  useEffect(() => {
    if (user?.id) {
      const timeoutId = setTimeout(() => {
        logUserActivity({
          user_id: user.id,
          activity_type: ACTIVITY_TYPES.PAGE_VISIT,
          metadata: { 
            page: location.pathname,
            timestamp: new Date().toISOString()
          }
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
            <div className="space-y-2">
              {navigation.map((item) => {
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
