import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MilestoneCelebrationProvider } from '@/contexts/MilestoneCelebrationContext';
import { MilestoneCelebrationPopup } from '@/components/MilestoneCelebrationPopup';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import React, { useState, useEffect, Suspense, lazy } from "react";
import { useAuth } from "./hooks/useAuth";
import { initializeGlobalIntegrations } from "./lib/global-integrations";
import { initPerformanceMonitoring } from "./lib/performance";
import { PaywallModal } from "./components/PaywallModal";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { DynamicFavicon } from "./components/DynamicFavicon";
import { supabase } from "@/integrations/supabase/client";
import { PendingInvoice } from "@/types/common";
import { logger } from "@/lib/logger";
import { RoleGuard } from "@/components/RoleGuard";

const AdminTabRedirect = ({ user, tab }: { user: any; tab: string }) => {
  if (user?.role === 'superadmin') return <Navigate to={`/superadmin?tab=${tab}`} replace />;
  if (user?.role === 'admin') return <Navigate to={`/admin?tab=${tab}`} replace />;
  return <Navigate to="/" replace />;
};

// Wrapper component to handle onboarding completion properly
const OnboardingWrapper = ({ user }: { user: any }) => {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  
  // Prevent external redirects during onboarding
  useEffect(() => {
    const preventExternalRedirects = (event: BeforeUnloadEvent) => {
      const target = (event.target as Window)?.location?.href;
      if (target && (target.includes('growthos.core47.ai') || target.includes('core47.ai'))) {
        event.preventDefault();
        event.returnValue = 'Are you sure you want to leave the onboarding process?';
        logger.warn('OnboardingWrapper: Prevented external redirect during onboarding', { target });
      }
    };
    
    window.addEventListener('beforeunload', preventExternalRedirects);
    return () => window.removeEventListener('beforeunload', preventExternalRedirects);
  }, []);
  
  const handleOnboardingComplete = async () => {
    logger.info('Onboarding completed, navigating to dashboard');
    // Navigate to dashboard immediately without refreshing user data
    // The onboarding completion already updated the database records
    navigate('/dashboard');
  };
  
  return <Onboarding user={user} onComplete={handleOnboardingComplete} />;
};

// Lazy load components for better performance
const Login = lazy(() => import("./pages/Login"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const MentorDashboard = lazy(() => import("./pages/MentorDashboard"));
const SuperadminDashboard = lazy(() => import("./pages/SuperadminDashboard"));
const EnrollmentManagerDashboard = lazy(() => import("./pages/EnrollmentManagerDashboard"));
const Videos = lazy(() => import("./pages/Videos"));
const VideoPlayer = lazy(() => import("./pages/VideoPlayer"));
const Assignments = lazy(() => import("./pages/Assignments"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const Profile = lazy(() => import("./pages/Profile"));
const Notifications = lazy(() => import("./pages/Notifications"));
const LiveSessions = lazy(() => import("./pages/LiveSessions"));

const Messages = lazy(() => import("./pages/Messages"));
const Teams = lazy(() => import("./pages/Teams"));
const StudentsManagement = lazy(() => import("./pages/StudentsManagement"));
// Layout with retry logic to prevent cache issues
const Layout = lazy(() => 
  import("./components/Layout").catch(async (error) => {
    console.error("Failed to load Layout, retrying...", error);
    // Retry once after a short delay
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return import("./components/Layout");
  })
);
const Support = lazy(() => import("./pages/Support"));
const Connect = lazy(() => import("./pages/Connect"));
const ShopifyDashboard = lazy(() => import("./pages/ShopifyDashboard"));
const MetaAdsDashboard = lazy(() => import("./pages/MetaAdsDashboard"));
const MentorSessionsPage = lazy(() => import("./pages/MentorSessionsPage"));
const MentorRecordingsPage = lazy(() => import("./pages/MentorRecordingsPage"));
const MentorModulesPage = lazy(() => import("./pages/MentorModulesPage"));
const MentorAssignmentsPage = lazy(() => import("./pages/MentorAssignmentsPage"));
const MentorSubmissionsPage = lazy(() => import("./pages/MentorSubmissionsPage"));
const AdminNotifications = lazy(() => import("./pages/AdminNotifications"));
const DevSendNotification = lazy(() => import("./pages/DevSendNotification"));
const Catalog = lazy(() => import("./pages/Catalog"));


// Loading component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
    <div className="text-center">
      <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-gray-600">Loading...</p>
    </div>
  </div>
);

// Optimized React Query configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        return failureCount < 3;
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});

const App = () => {
  const { user, loading, refreshUser } = useAuth();
  const [showPaywall, setShowPaywall] = useState(false);
  const [pendingInvoice, setPendingInvoice] = useState<PendingInvoice | null>(null);

  // Note: Global redirect protection is now handled in main.tsx

  // Initialize global integrations and performance monitoring when user is loaded
  useEffect(() => {
    if (user?.id) {
      initializeGlobalIntegrations(user.id);
      checkPaymentStatus();
    }
    
    // Initialize performance monitoring once
    initPerformanceMonitoring();
  }, [user?.id]);

  // Close paywall and reset invoice when user signs out
  useEffect(() => {
    if (!user) {
      setShowPaywall(false);
      setPendingInvoice(null);
    }
  }, [user]);

  const checkPaymentStatus = async () => {
    if (!user?.id) return;

    // Set placeholder invoice data
    setPendingInvoice({
      amount: 50000,
      invoice_number: 'INV-PENDING'
    });

    // For students, check if they have overdue fees or no payment recorded
    if (user.role === 'student' && user.onboarding_done) {
      if (user.fees_overdue || !user.fees_due_date) {
        setShowPaywall(true);
      }
    }
  };

  logger.debug('App: Render state', { 
    hasUser: !!user, 
    loading, 
    userRole: user?.role, 
    userEmail: user?.email,
    onboarding_done: user?.onboarding_done,
    shouldShowOnboarding: user?.role === 'student' && !user?.onboarding_done
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <DynamicFavicon />
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Public routes - accessible without authentication */}
                <Route path="reset-password" element={<ResetPassword />} />
                
                {!user ? (
                  <Route path="*" element={<Login />} />
                ) : user?.role === 'student' && !user?.onboarding_done ? (
                  (() => {
                    logger.debug('App: Showing onboarding for student', { userId: user.id, onboarding_done: user.onboarding_done });
                    return <Route path="*" element={
                      <OnboardingWrapper user={user} />
                    } />;
                  })()
                ) : (
                  <Route path="/" element={<Layout user={user} />}>
                    {/* Role-based dashboard routing */}
                    <Route index element={
                      user.role === 'admin' ? <AdminDashboard /> :
                      user.role === 'mentor' ? <MentorDashboard /> :
                      user.role === 'superadmin' ? <SuperadminDashboard /> :
                      user.role === 'enrollment_manager' ? <EnrollmentManagerDashboard /> :
                      <Dashboard user={user} />
                    } />
                    
                    {/* Dashboard route */}
                    <Route path="dashboard" element={
                      user.role === 'admin' ? <AdminDashboard /> :
                      user.role === 'mentor' ? <MentorDashboard /> :
                      user.role === 'superadmin' ? <SuperadminDashboard /> :
                      user.role === 'enrollment_manager' ? <EnrollmentManagerDashboard /> :
                      <Dashboard user={user} />
                    } />
                    
                    {/* Shared routes */}
                    <Route path="catalog" element={<Catalog />} />
                    <Route path="videos" element={<Videos />} />
                    <Route path="videos/:moduleId/:lessonId" element={<VideoPlayer />} />
                    <Route path="video-player" element={<VideoPlayer />} />
                    <Route path="assignments" element={<Assignments user={user} />} />
                    <Route path="leaderboard" element={<Leaderboard />} />
                    <Route path="live-sessions" element={<LiveSessions user={user} />} />
                    
                    <Route path="messages" element={<Messages />} />
                    <Route path="support" element={<Support />} />
                    <Route path="connect" element={<Connect />} />
                    <Route path="profile" element={<Profile />} />
                    <Route path="notifications" element={<Notifications />} />
                    <Route path="teams" element={<Teams />} />
                    <Route path="students" element={<StudentsManagement />} />
                    <Route path="shopify-dashboard" element={<ShopifyDashboard />} />
                    <Route path="meta-ads-dashboard" element={<MetaAdsDashboard />} />
                    
                    {/* Role-specific routes */}
                    <Route path="admin" element={<AdminDashboard />} />
                    {/* Admin-friendly aliases (avoid falling back to dashboard) */}
                    <Route path="courses" element={<AdminTabRedirect user={user} tab="courses" />} />
                    <Route path="modules" element={<AdminTabRedirect user={user} tab="modules" />} />
                    <Route path="pathways" element={<AdminTabRedirect user={user} tab="pathways" />} />
                    <Route path="mentor" element={<MentorDashboard />} />
                    <Route path="mentor/sessions" element={<MentorSessionsPage />} />
                    <Route path="mentor/recordings" element={<MentorRecordingsPage />} />
                    <Route path="mentor/modules" element={<MentorModulesPage />} />
                    <Route path="mentor/assignments" element={<MentorAssignmentsPage />} />
                    <Route path="mentor/submissions" element={<MentorSubmissionsPage />} />
                    <Route path="superadmin" element={<SuperadminDashboard />} />
                    <Route path="enrollment-manager" element={<EnrollmentManagerDashboard />} />

                    {/* Notifications admin + dev */}
                    <Route
                      path="admin/notifications"
                      element={
                        <RoleGuard allowedRoles={["admin","superadmin"]}>
                          <AdminNotifications />
                        </RoleGuard>
                      }
                    />
                    <Route
                      path="dev/notify-test"
                      element={
                        <RoleGuard allowedRoles={["superadmin"]}>
                          <DevSendNotification />
                        </RoleGuard>
                      }
                    />
                    
                    <Route path="*" element={<Navigate to="/" />} />
                  </Route>
                )}
              </Routes>
            </Suspense>
          </BrowserRouter>
          
          {/* Paywall Modal - only render when user is authenticated */}
          {user && (
            <PaywallModal
              isOpen={showPaywall}
              onOpenChange={setShowPaywall}
              invoiceAmount={pendingInvoice?.amount}
              invoiceNumber={pendingInvoice?.invoice_number}
            />
          )}
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;