
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Star, TrendingUp, Award } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  rank: number;
  avatar: string;
  progress: number;
  badges: string[];
  streak: number;
  isCurrentUser?: boolean;
  videosWatched: number;
  assignmentsCompleted: number;
  milestonesCompleted: number;
}

const Leaderboard = () => {
  const { user } = useAuth();
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalStudents, setTotalStudents] = useState(0);
  const [currentUserStats, setCurrentUserStats] = useState<LeaderboardEntry | null>(null);

  useEffect(() => {
    fetchLeaderboardData();
  }, [user?.id]);

  const fetchLeaderboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch all student progress data
      const { data: students, error } = await supabase
        .from('users')
        .select(`
          id,
          full_name,
          email
        `)
        .eq('role', 'student')
        .eq('status', 'active');

      if (error) throw error;

      if (!students || students.length === 0) {
        setLoading(false);
        return;
      }

      setTotalStudents(students.length);

      // Fetch progress data for all students
      const studentProgressPromises = students.map(async (student) => {
        // Get videos watched
        const { count: videosWatched } = await supabase
          .from('recording_views')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', student.id)
          .eq('watched', true);

        // Get assignments completed
        const { count: assignmentsCompleted } = await supabase
          .from('submissions')
          .select('*', { count: 'exact', head: true })
          .eq('student_id', student.id)
          .eq('status', 'approved');

        // Get milestones completed
        const { count: milestonesCompleted } = await supabase
          .from('user_milestones')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', student.id);

        // Get total available content
        const { count: totalVideos } = await supabase
          .from('available_lessons')
          .select('*', { count: 'exact', head: true });

        const { count: totalAssignments } = await supabase
          .from('assignments')
          .select('*', { count: 'exact', head: true });

        // Calculate score (weighted average)
        const videoProgress = totalVideos ? (videosWatched || 0) / totalVideos : 0;
        const assignmentProgress = totalAssignments ? (assignmentsCompleted || 0) / totalAssignments : 0;
        const score = Math.round(((videoProgress * 0.5) + (assignmentProgress * 0.5)) * 100);
        
        // Calculate overall progress
        const totalItems = (totalVideos || 0) + (totalAssignments || 0);
        const completedItems = (videosWatched || 0) + (assignmentsCompleted || 0);
        const progress = totalItems ? Math.round((completedItems / totalItems) * 100) : 0;

        // Generate avatar initials
        const nameParts = student.full_name?.split(' ') || ['U'];
        const avatar = nameParts.length > 1 
          ? `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase()
          : nameParts[0].substring(0, 2).toUpperCase();

        // Determine badges based on achievements
        const badges: string[] = [];
        if (videosWatched && videosWatched > 0) badges.push("Video Learner");
        if (assignmentsCompleted && assignmentsCompleted > 0) badges.push("Assignment Master");
        if (milestonesCompleted && milestonesCompleted >= 3) badges.push("Achiever");
        if (progress >= 50) badges.push("Halfway Hero");
        if (progress >= 80) badges.push("Nearly There");
        if (progress === 100) badges.push("Course Complete");

        return {
          id: student.id,
          name: student.full_name || student.email || 'Student',
          score,
          rank: 0, // Will be assigned after sorting
          avatar,
          progress,
          badges,
          streak: Math.floor(Math.random() * 15) + 1, // TODO: Implement real streak tracking
          isCurrentUser: student.id === user?.id,
          videosWatched: videosWatched || 0,
          assignmentsCompleted: assignmentsCompleted || 0,
          milestonesCompleted: milestonesCompleted || 0,
        };
      });

      const progressData = await Promise.all(studentProgressPromises);

      // Sort by score, then by progress
      const sortedData = progressData.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.progress - a.progress;
      });

      // Assign ranks
      const rankedData = sortedData.map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));

      setLeaderboardData(rankedData);
      
      // Find current user stats
      const userEntry = rankedData.find(entry => entry.id === user?.id);
      setCurrentUserStats(userEntry || null);

      setLoading(false);
    } catch (error) {
      console.error('Error fetching leaderboard data:', error);
      setLoading(false);
    }
  };


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
      case "Video Learner": return "bg-blue-100 text-blue-800";
      case "Assignment Master": return "bg-green-100 text-green-800";
      case "Achiever": return "bg-purple-100 text-purple-800";
      case "Halfway Hero": return "bg-orange-100 text-orange-800";
      case "Nearly There": return "bg-yellow-100 text-yellow-800";
      case "Course Complete": return "bg-emerald-100 text-emerald-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Leaderboard 🏆</h1>
            <p className="text-gray-600 mt-2">See how you stack up against fellow students</p>
          </div>
          <Card className="p-4 bg-gradient-to-r from-blue-50 to-green-50">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">Active Students</div>
              <div className="text-sm text-gray-600">{totalStudents} Student{totalStudents !== 1 ? 's' : ''}</div>
            </div>
          </Card>
        </div>
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
              {loading ? (
                <div className="text-center py-8">
                  <div className="text-gray-500">Loading leaderboard...</div>
                </div>
              ) : leaderboardData.length === 0 ? (
                <div className="text-center py-8">
                  <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <div className="text-gray-500">No students found</div>
                </div>
              ) : (
                <div className="space-y-4">
                  {leaderboardData.map((student) => (
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
              )}
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
              {currentUserStats ? (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Current Rank</span>
                    <span className="font-bold">#{currentUserStats.rank}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Score</span>
                    <span className="font-bold">{currentUserStats.score}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Progress</span>
                    <span className="font-bold">{currentUserStats.progress}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Videos Watched</span>
                    <span className="font-bold">{currentUserStats.videosWatched}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Assignments</span>
                    <span className="font-bold">{currentUserStats.assignmentsCompleted}</span>
                  </div>
                </div>
              ) : (
                <div className="text-center text-sm text-white/80">
                  Complete activities to see your stats
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Badges */}
          {currentUserStats && currentUserStats.badges.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Award className="w-5 h-5 mr-2 text-purple-600" />
                  Your Badges
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {currentUserStats.badges.map((badge, index) => (
                    <Badge key={index} className={`${getBadgeColor(badge)}`}>
                      {badge}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
