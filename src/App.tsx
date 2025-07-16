
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./hooks/useAuth";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import AdminDashboard from "./pages/AdminDashboard";
import MentorDashboard from "./pages/MentorDashboard";
import SuperadminDashboard from "./pages/SuperadminDashboard";
import Videos from "./pages/Videos";
import VideoPlayer from "./pages/VideoPlayer";
import Assignments from "./pages/Assignments";
import Leaderboard from "./pages/Leaderboard";
import Profile from "./pages/Profile";
import Notifications from "./pages/Notifications";
import LiveSessions from "./pages/LiveSessions";
import Mentorship from "./pages/Mentorship";
import Messages from "./pages/Messages";
import Layout from "./components/Layout";

const queryClient = new QueryClient();

const App = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {!user ? (
              <Route path="*" element={<Login onLogin={() => {}} />} />
            ) : (
              <Route path="/" element={<Layout user={user} />}>
                {/* Role-based dashboard routing */}
                <Route index element={
                  user.role === 'admin' ? <AdminDashboard /> :
                  user.role === 'mentor' ? <MentorDashboard /> :
                  user.role === 'superadmin' ? <SuperadminDashboard /> :
                  <Dashboard user={user} />
                } />
                
                {/* Shared routes */}
                <Route path="videos" element={<Videos user={user} />} />
                <Route path="videos/:moduleId/:lessonId" element={<VideoPlayer />} />
                <Route path="video-player" element={<VideoPlayer />} />
                <Route path="assignments" element={<Assignments user={user} />} />
                <Route path="leaderboard" element={<Leaderboard />} />
                <Route path="live-sessions" element={<LiveSessions user={user} />} />
                <Route path="mentorship" element={<Mentorship />} />
                <Route path="messages" element={<Messages />} />
                <Route path="profile" element={<Profile user={user} />} />
                <Route path="notifications" element={<Notifications />} />
                
                {/* Role-specific routes */}
                <Route path="admin" element={<AdminDashboard />} />
                <Route path="mentor" element={<MentorDashboard />} />
                <Route path="superadmin" element={<SuperadminDashboard />} />
                
                <Route path="*" element={<Navigate to="/" />} />
              </Route>
            )}
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
