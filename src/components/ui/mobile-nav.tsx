import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { 
  Menu, 
  X,
  Monitor,
  Video,
  FileText,
  MessageSquare,
  Calendar,
  Users,
  UserCheck,
  User,
  Building2,
  ShoppingBag,
  Target,
  Activity,
  BookOpen,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface MobileNavProps {
  user: any;
  connectionStatus: {
    shopify: boolean;
    meta: boolean;
  };
}

export const MobileNav: React.FC<MobileNavProps> = ({ user, connectionStatus }) => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [courseMenuOpen, setCourseMenuOpen] = useState(false);

  const isUserSuperadmin = user?.role === 'superadmin';
  const isUserAdmin = user?.role === 'admin';
  const isUserMentor = user?.role === 'mentor';
  const isUserEnrollmentManager = user?.role === 'enrollment_manager';

  const navigationItems = React.useMemo(() => {
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

    // Add Connect Accounts for students
    if (user?.role === 'student') {
      items.push({
        to: "/connect",
        icon: Activity,
        label: "Connect Accounts",
        roles: ['student']
      });
    }

    return items;
  }, [isUserSuperadmin, isUserAdmin, isUserMentor, isUserEnrollmentManager, user?.role]);

  const handleLinkClick = () => {
    setIsOpen(false);
    setCourseMenuOpen(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="md:hidden p-2 h-9 w-9"
          aria-label="Open mobile menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 px-0">
        <SheetHeader className="px-6 pb-6">
          <SheetTitle className="text-left">Navigation</SheetTitle>
          <SheetDescription className="text-left text-sm">
            Access all LMS features and tools
          </SheetDescription>
        </SheetHeader>
        
        <nav className="flex flex-col h-full">
          <div className="flex-1 px-4 space-y-2">
            {navigationItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={handleLinkClick}
                className={`
                  flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors min-h-[44px]
                  ${location.pathname === item.to
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-muted'
                  }
                `}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                <span>{item.label}</span>
              </Link>
            ))}
            
            {/* Course navigation for students */}
            {user?.role === 'student' && (
              <div className="pt-4">
                <Collapsible open={courseMenuOpen} onOpenChange={setCourseMenuOpen}>
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center justify-between w-full px-3 py-3 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors min-h-[44px]">
                      <div className="flex items-center gap-3">
                        <BookOpen className="h-5 w-5" />
                        <span>Course</span>
                      </div>
                      {courseMenuOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent className="ml-8 mt-2 space-y-2">
                    <Link
                      to="/quizzes"
                      onClick={handleLinkClick}
                      className={`
                        flex items-center px-3 py-2 text-sm rounded-md transition-colors min-h-[40px]
                        ${location.pathname === '/quizzes'
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }
                      `}
                    >
                      Quizzes
                    </Link>
                    <Link
                      to="/certificates"
                      onClick={handleLinkClick}
                      className={`
                        flex items-center px-3 py-2 text-sm rounded-md transition-colors min-h-[40px]
                        ${location.pathname === '/certificates'
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }
                      `}
                    >
                      Certificates
                    </Link>
                    <Link
                      to="/leaderboard"
                      onClick={handleLinkClick}
                      className={`
                        flex items-center px-3 py-2 text-sm rounded-md transition-colors min-h-[40px]
                        ${location.pathname === '/leaderboard'
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }
                      `}
                    >
                      Leaderboard
                    </Link>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}
            
            {/* Integration links */}
            {(connectionStatus.shopify || connectionStatus.meta) && (
              <div className="pt-4 border-t border-border">
                <div className="px-3 py-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Integrations
                  </h3>
                  <div className="space-y-2">
                    {connectionStatus.shopify && (
                      <Link
                        to="/shopify-dashboard"
                        onClick={handleLinkClick}
                        className={`
                          flex items-center justify-between px-3 py-3 text-sm rounded-md transition-colors min-h-[44px]
                          ${location.pathname === '/shopify-dashboard'
                            ? 'bg-primary text-primary-foreground'
                            : 'text-foreground hover:bg-muted'
                          }
                        `}
                      >
                        <div className="flex items-center gap-3">
                          <ShoppingBag className="h-5 w-5" />
                          <span>Shopify</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          Connected
                        </Badge>
                      </Link>
                    )}
                    {connectionStatus.meta && (
                      <Link
                        to="/meta-ads-dashboard"
                        onClick={handleLinkClick}
                        className={`
                          flex items-center justify-between px-3 py-3 text-sm rounded-md transition-colors min-h-[44px]
                          ${location.pathname === '/meta-ads-dashboard'
                            ? 'bg-primary text-primary-foreground'
                            : 'text-foreground hover:bg-muted'
                          }
                        `}
                      >
                        <div className="flex items-center gap-3">
                          <Target className="h-5 w-5" />
                          <span>Meta Ads</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          Connected
                        </Badge>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Profile link at bottom */}
          <div className="px-4 pb-6 border-t border-border">
            <Link
              to="/profile"
              onClick={handleLinkClick}
              className={`
                flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors mt-4 min-h-[44px]
                ${location.pathname === '/profile'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-muted'
                }
              `}
            >
              <User className="h-5 w-5 flex-shrink-0" />
              <span>Profile</span>
            </Link>
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
};