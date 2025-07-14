
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  const handleLogin = (user: any) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    setHasCompletedOnboarding(user.onboarding_done || false);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {!isAuthenticated ? (
              <Route path="*" element={<Login onLogin={handleLogin} />} />
            ) : !hasCompletedOnboarding ? (
              <Route path="*" element={<Onboarding user={currentUser} onComplete={() => setHasCompletedOnboarding(true)} />} />
            ) : (
              <Route path="/" element={<Layout user={currentUser} />}>
                <Route index element={<Dashboard />} />
                <Route path="videos" element={<Videos user={currentUser} />} />
                <Route path="videos/:moduleId/:lessonId" element={<VideoPlayer />} />
                <Route path="video-player" element={<VideoPlayer />} />
                <Route path="assignments" element={<Assignments user={currentUser} />} />
                <Route path="leaderboard" element={<Leaderboard />} />
                <Route path="live-sessions" element={<LiveSessions user={currentUser} />} />
                <Route path="mentorship" element={<Mentorship />} />
                <Route path="messages" element={<Messages />} />
                <Route path="profile" element={<Profile user={currentUser} />} />
                <Route path="notifications" element={<Notifications />} />
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
