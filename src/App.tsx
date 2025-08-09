import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
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

// Wrapper component to handle onboarding completion properly
const OnboardingWrapper = ({ user }: { user: any }) => {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  
  const handleOnboardingComplete = async () => {
    logger.info('Onboarding completed, navigating to dashboard');
    // Refresh user data to get updated onboarding status
    if (refreshUser) {
      await refreshUser();
    }
    // Navigate to dashboard
    navigate('/dashboard');
  };
  
  return <Onboarding user={user} onComplete={handleOnboardingComplete} />;
};

// Lazy load components for better performance
const Login = lazy(() => import("./pages/Login"));
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
const Mentorship = lazy(() => import("./pages/Mentorship"));
const Messages = lazy(() => import("./pages/Messages"));
const Teams = lazy(() => import("./pages/Teams"));
const StudentsManagement = lazy(() => import("./pages/StudentsManagement"));
const Layout = lazy(() => import("./components/Layout"));
const Support = lazy(() => import("./pages/Support"));
const Connect = lazy(() => import("./pages/Connect"));
const ShopifyDashboard = lazy(() => import("./pages/ShopifyDashboard"));
const MetaAdsDashboard = lazy(() => import("./pages/MetaAdsDashboard"));
const MentorSessionsPage = lazy(() => import("./pages/MentorSessionsPage"));
const AdminNotifications = lazy(() => import("./pages/AdminNotifications"));
const DevSendNotification = lazy(() => import("./pages/DevSendNotification"));

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

  // Initialize global integrations and performance monitoring when user is loaded
  useEffect(() => {
    if (user?.id) {
      initializeGlobalIntegrations(user.id);
      checkPaymentStatus();
    }
    
    // Initialize performance monitoring once
    initPerformanceMonitoring();
  }, [user?.id]);

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
    userEmail: user?.email 
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
                {!user ? (
                  <Route path="*" element={<Login />} />
                ) : user?.role === 'student' && !user?.onboarding_done ? (
                  <Route path="*" element={
                    <OnboardingWrapper user={user} />
                  } />
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
                    <Route path="videos" element={<Videos />} />
                    <Route path="videos/:moduleId/:lessonId" element={<VideoPlayer />} />
                    <Route path="video-player" element={<VideoPlayer />} />
                    <Route path="assignments" element={<Assignments user={user} />} />
                    <Route path="leaderboard" element={<Leaderboard />} />
                    <Route path="live-sessions" element={<LiveSessions user={user} />} />
                    <Route path="mentorship" element={<Mentorship />} />
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
                    <Route path="mentor" element={<MentorDashboard />} />
                    <Route path="mentor/sessions" element={<MentorSessionsPage />} />
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
          
          {/* Paywall Modal */}
          <PaywallModal
            isOpen={showPaywall}
            onOpenChange={setShowPaywall}
            invoiceAmount={pendingInvoice?.amount}
            invoiceNumber={pendingInvoice?.invoice_number}
          />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;