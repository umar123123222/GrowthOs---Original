
import React, { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConnectAccountsDialog } from "@/components/ConnectAccountsDialog";
import { 
  BookOpen, 
  FileText, 
  Star, 
  Clock,
  TrendingUp,
  Trophy,
  Target,
  Zap
} from "lucide-react";

const Dashboard = ({ user }: { user?: any }) => {
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const navigate = useNavigate();
  
  // Memoize static data to prevent unnecessary re-renders
  const progressData = useMemo(() => ({
    videosWatched: 12,
    totalVideos: 16,
    assignmentsCompleted: 8,
    totalAssignments: 12,
    overallProgress: 75
  }), []);

  const leaderboardData = useMemo(() => [
    { name: "Ahmed Khan", score: 95, rank: 1 },
    { name: "Fatima Ali", score: 89, rank: 2 },
    { name: "You", score: 85, rank: 3 },
    { name: "Hassan Sheikh", score: 82, rank: 4 },
    { name: "Ayesha Malik", score: 78, rank: 5 }
  ], []);

  const milestones = useMemo(() => [
    { title: "First Login", completed: true, icon: "🎯" },
    { title: "Profile Complete", completed: true, icon: "✅" },
    { title: "First Video Watched", completed: true, icon: "📹" },
    { title: "First Assignment", completed: true, icon: "📝" },
    { title: "Quiz Master", completed: false, icon: "🧠" },
    { title: "Store Live", completed: false, icon: "🛒" },
    { title: "First Sale", completed: false, icon: "💰" }
  ], []);

  const handleConnectAccounts = useCallback(() => {
    setConnectDialogOpen(true);
  }, []);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Welcome back! 👋</h1>
        <p className="text-gray-600 mt-2">Ready to continue your journey to success?</p>
      </div>

      {/* Visualization Card */}
      <Card className="bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 text-white">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold mb-2">Your Dream Goal 🌟</h3>
              <p className="text-blue-100 mb-4">
                "Go for Umrah with family and buy a BMW within 2 years"
              </p>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">🕌</span>
                  <span className="text-sm">Umrah Goal</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">🚗</span>
                  <span className="text-sm">BMW Goal</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{progressData.overallProgress}%</div>
              <div className="text-blue-100">Progress</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Progress Tracker */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
              Progress Tracker
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Videos Watched</span>
                <span className="text-sm text-gray-600">
                  {progressData.videosWatched}/{progressData.totalVideos}
                </span>
              </div>
              <Progress value={(progressData.videosWatched / progressData.totalVideos) * 100} />
            </div>
            
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Assignments Done</span>
                <span className="text-sm text-gray-600">
                  {progressData.assignmentsCompleted}/{progressData.totalAssignments}
                </span>
              </div>
              <Progress value={(progressData.assignmentsCompleted / progressData.totalAssignments) * 100} />
            </div>
          </CardContent>
        </Card>

        {/* Next Assignment Due */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="w-5 h-5 mr-2 text-orange-600" />
              Next Assignment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <h4 className="font-medium">Product Research Assignment</h4>
              <div className="flex items-center space-x-2">
                <Badge variant="destructive">Due in 2 days</Badge>
                <Badge variant="outline">Module 4</Badge>
              </div>
              <Button 
                className="w-full" 
                size="sm"
                onClick={() => navigate('/assignments')}
              >
                <FileText className="w-4 h-4 mr-2" />
                Start Assignment
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Meta/Shopify Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Zap className="w-5 h-5 mr-2 text-green-600" />
              Store Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Shopify Store</span>
                <Badge variant="secondary">Not Connected</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Meta Ads</span>
                <Badge variant="secondary">Not Connected</Badge>
              </div>
              <Button 
                variant="outline" 
                className="w-full" 
                size="sm"
                onClick={() => setConnectDialogOpen(true)}
              >
                Connect Accounts
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Milestones Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Target className="w-5 h-5 mr-2 text-purple-600" />
              Milestones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {milestones.map((milestone, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <span className="text-lg">{milestone.icon}</span>
                  <span className={`flex-1 ${milestone.completed ? 'text-gray-900' : 'text-gray-500'}`}>
                    {milestone.title}
                  </span>
                  {milestone.completed ? (
                    <Badge className="bg-green-100 text-green-800">✓</Badge>
                  ) : (
                    <Badge variant="outline">Pending</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Trophy className="w-5 h-5 mr-2 text-yellow-600" />
              Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {leaderboardData.map((student, index) => (
                <div key={index} className={`flex items-center justify-between p-2 rounded-lg ${
                  student.name === "You" ? "bg-blue-50 border border-blue-200" : ""
                }`}>
                  <div className="flex items-center space-x-3">
                    <span className="font-bold text-lg">
                      {student.rank === 1 ? "🥇" : student.rank === 2 ? "🥈" : student.rank === 3 ? "🥉" : `#${student.rank}`}
                    </span>
                    <span className={`font-medium ${student.name === "You" ? "text-blue-700" : ""}`}>
                      {student.name}
                    </span>
                  </div>
                  <span className="font-semibold text-gray-600">{student.score}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <ConnectAccountsDialog 
        open={connectDialogOpen} 
        onOpenChange={setConnectDialogOpen} 
        userId={user?.id}
      />
    </div>
  );
};

export default Dashboard;
