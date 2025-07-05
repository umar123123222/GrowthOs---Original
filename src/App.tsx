
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState } from "react";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Videos from "./pages/Videos";
import Assignments from "./pages/Assignments";
import Leaderboard from "./pages/Leaderboard";
import Profile from "./pages/Profile";
import Layout from "./components/Layout";

const queryClient = new QueryClient();

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {!isAuthenticated ? (
              <Route path="*" element={<Login onLogin={() => setIsAuthenticated(true)} />} />
            ) : !hasCompletedOnboarding ? (
              <Route path="*" element={<Onboarding onComplete={() => setHasCompletedOnboarding(true)} />} />
            ) : (
              <Route path="/" element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="videos" element={<Videos />} />
                <Route path="assignments" element={<Assignments />} />
                <Route path="leaderboard" element={<Leaderboard />} />
                <Route path="profile" element={<Profile />} />
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
