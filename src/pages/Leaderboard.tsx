
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Star, TrendingUp, Award } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const Leaderboard = () => {
  const { user } = useAuth();
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboardData = async () => {
      try {
        const { data, error } = await supabase
          .from('leaderboard')
          .select(`
            user_id,
            points,
            rank,
            users!inner(full_name)
          `)
          .order('rank', { ascending: true })
          .limit(12);

        if (error) {
          console.error('Error fetching leaderboard:', error);
          return;
        }

        // Transform the data to match our UI format
        const transformedData = data?.map((item, index) => ({
          id: index + 1,
          name: item.users?.full_name || `Student ${index + 1}`,
          score: Math.floor(item.points / 25), // Convert points to percentage
          rank: item.rank,
          avatar: item.users?.full_name?.split(' ').map(n => n[0]).join('') || 'ST',
          progress: Math.min(100, Math.floor(item.points / 25)),
          badges: getBadgesForScore(item.points),
          streak: Math.floor(item.points / 100) + Math.floor(Math.random() * 10),
          isCurrentUser: item.user_id === user?.id
        })) || [];

        setLeaderboardData(transformedData);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboardData();
  }, [user?.id]);

  const getBadgesForScore = (points) => {
    const badges = [];
    if (points >= 2000) badges.push("First Sale", "Quiz Master", "Store Live", "Speed Learner");
    else if (points >= 1500) badges.push("Store Live", "Quiz Master", "First Sale");
    else if (points >= 1000) badges.push("Quiz Master", "Store Live");
    else if (points >= 500) badges.push("Quiz Master");
    return badges;
  };

  // Fallback data if database is empty or loading
  const fallbackData = [
    {
      id: 1,
      name: "Sarah Johnson",
      score: 98,
      rank: 1,
      avatar: "SJ",
      progress: 100,
      badges: ["First Sale", "Quiz Master", "Store Live", "Speed Learner"],
      streak: 23
    },
    {
      id: 2,
      name: "Marcus Chen",
      score: 94,
      rank: 2,
      avatar: "MC",
      progress: 98,
      badges: ["Store Live", "Quiz Master", "First Sale"],
      streak: 18
    },
    {
      id: 3,
      name: "Priya Patel",
      score: 91,
      rank: 3,
      avatar: "PP",
      progress: 95,
      badges: ["Quiz Master", "Store Live", "Helper"],
      streak: 15
    },
    {
      id: 4,
      name: "You",
      score: 87,
      rank: 4,
      avatar: "YU",
      progress: 78,
      badges: ["Quiz Master", "Store Live"],
      streak: 9,
      isCurrentUser: true
    },
    {
      id: 5,
      name: "Alex Rodriguez",
      score: 84,
      rank: 5,
      avatar: "AR",
      progress: 82,
      badges: ["Store Live", "First Sale"],
      streak: 12
    },
    {
      id: 6,
      name: "Emma Wilson",
      score: 81,
      rank: 6,
      avatar: "EW",
      progress: 75,
      badges: ["Quiz Master"],
      streak: 7
    },
    {
      id: 7,
      name: "David Kim",
      score: 78,
      rank: 7,
      avatar: "DK",
      progress: 70,
      badges: ["Store Live"],
      streak: 5
    },
    {
      id: 8,
      name: "Maya Singh",
      score: 75,
      rank: 8,
      avatar: "MS",
      progress: 68,
      badges: ["Helper"],
      streak: 8
    },
    {
      id: 9,
      name: "James Miller",
      score: 72,
      rank: 9,
      avatar: "JM",
      progress: 65,
      badges: [],
      streak: 4
    },
    {
      id: 10,
      name: "Lisa Thompson",
      score: 69,
      rank: 10,
      avatar: "LT",
      progress: 60,
      badges: ["Helper"],
      streak: 6
    },
    {
      id: 11,
      name: "Ryan Foster",
      score: 66,
      rank: 11,
      avatar: "RF",
      progress: 55,
      badges: [],
      streak: 3
    },
    {
      id: 12,
      name: "Sophie Clark",
      score: 63,
      rank: 12,
      avatar: "SC",
      progress: 52,
      badges: [],
      streak: 2
    }
  ];

  const achievements = [
    { name: "First Sale", icon: "💰", description: "Made your first sale", count: 3 },
    { name: "Store Live", icon: "🛒", description: "Launched your store", count: 5 },
    { name: "Quiz Master", icon: "🧠", description: "Scored 90%+ on all quizzes", count: 8 },
    { name: "Speed Learner", icon: "⚡", description: "Completed module ahead of time", count: 4 },
    { name: "Helper", icon: "🤝", description: "Helped other students", count: 2 }
  ];

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return "🥇";
      case 2: return "🥈";
      case 3: return "🥉";
      default: return `#${rank}`;
    }
  };

  const getBadgeColor = (badge: string) => {
    switch (badge) {
      case "First Sale": return "bg-green-100 text-green-800";
      case "Store Live": return "bg-blue-100 text-blue-800";
      case "Quiz Master": return "bg-purple-100 text-purple-800";
      case "Speed Learner": return "bg-orange-100 text-orange-800";
      case "Helper": return "bg-pink-100 text-pink-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Leaderboard 🏆</h1>
          <p className="text-gray-600 mt-2">See how you stack up against fellow students</p>
        </div>
        <Card className="p-4 bg-gradient-to-r from-blue-50 to-green-50">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">Current Cohort</div>
          <div className="text-sm text-gray-600">32 Students</div>
        </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Leaderboard */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Trophy className="w-5 h-5 mr-2 text-yellow-600" />
                Top Performers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(leaderboardData.length > 0 ? leaderboardData : fallbackData).map((student) => (
                  <div
                    key={student.id}
                    className={`p-4 rounded-lg border transition-all ${
                      student.isCurrentUser 
                        ? "bg-blue-50 border-blue-200 shadow-md" 
                        : "hover:shadow-sm"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-4">
                        <div className="text-2xl font-bold">
                          {getRankIcon(student.rank)}
                        </div>
                        
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-green-500 rounded-full flex items-center justify-center text-white font-semibold">
                            {student.avatar}
                          </div>
                          <div>
                            <h3 className={`font-semibold ${student.isCurrentUser ? "text-blue-700" : ""}`}>
                              {student.name}
                            </h3>
                            <div className="flex items-center space-x-2 text-sm text-gray-500">
                              <span>🔥 {student.streak} day streak</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-xl font-bold text-gray-900">
                          {student.score}%
                        </div>
                        <div className="text-sm text-gray-500">
                          {student.progress}% complete
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Progress value={student.progress} className="h-2" />
                      
                      {student.badges.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {student.badges.map((badge, index) => (
                            <Badge key={index} className={`text-xs ${getBadgeColor(badge)}`}>
                              {badge}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Your Stats */}
          <Card className="bg-gradient-to-r from-blue-500 to-green-500 text-white">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Star className="w-5 h-5 mr-2" />
                Your Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Current Rank</span>
                  <span className="font-bold">#4</span>
                </div>
                <div className="flex justify-between">
                  <span>Score</span>
                  <span className="font-bold">87%</span>
                </div>
                <div className="flex justify-between">
                  <span>Progress</span>
                  <span className="font-bold">78%</span>
                </div>
                <div className="flex justify-between">
                  <span>Streak</span>
                  <span className="font-bold">🔥 9 days</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Achievements */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Award className="w-5 h-5 mr-2 text-purple-600" />
                Achievements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {achievements.map((achievement, index) => (
                  <div key={index} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                    <div className="flex items-center space-x-3">
                      <span className="text-lg">{achievement.icon}</span>
                      <div>
                        <div className="font-medium text-sm">{achievement.name}</div>
                        <div className="text-xs text-gray-500">{achievement.description}</div>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {achievement.count}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Weekly Challenge */}
          <Card className="bg-gradient-to-r from-orange-50 to-red-50 border-orange-200">
            <CardHeader>
              <CardTitle className="flex items-center text-orange-800">
                <TrendingUp className="w-5 h-5 mr-2" />
                Weekly Challenge
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <h4 className="font-medium text-orange-800">Complete 3 Assignments</h4>
                <p className="text-sm text-orange-700">Finish 3 assignments this week to earn bonus points!</p>
                <Progress value={33} className="h-2" />
                <div className="text-xs text-orange-600">1 of 3 completed</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
