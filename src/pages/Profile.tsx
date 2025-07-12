
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  User, 
  Settings, 
  Bell, 
  Download,
  Target,
  Trophy,
  Award,
  Calendar,
  CheckCircle,
  ExternalLink
} from "lucide-react";

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  "What's your income goal in the next 3 months?"?: string;
  "Why do you want to make this income?"?: string;
  "Final Goal"?: string;
}

interface UserBadge {
  id: string;
  badge: {
    name: string;
    description: string;
    image_url: string;
  };
  earned_at: string;
}

interface Progress {
  module: {
    title: string;
  };
  status: string;
  score: number;
}

interface Certificate {
  id: string;
  track: string;
  certificate_url: string;
  issued_at: string;
  downloaded: boolean;
}

interface ProfileProps {
  user?: any;
}

const Profile = ({ user }: ProfileProps = {}) => {
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [userProgress, setUserProgress] = useState<Progress[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [leaderboardPosition, setLeaderboardPosition] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [notifications, setNotifications] = useState({
    whatsapp: true,
    email: true,
    assignments: true,
    progress: true
  });

  useEffect(() => {
    fetchUserData();
    fetchUserBadges();
    fetchUserProgress();
    fetchCertificates();
    fetchLeaderboardPosition();
  }, []);

  const fetchUserData = async () => {
    try {
      if (!user?.id) return;

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setProfileData(data as UserProfile);
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const fetchUserBadges = async () => {
    try {
      if (!user?.id) return;

      const { data, error } = await supabase
        .from('user_badges')
        .select(`
          id,
          earned_at,
          badge:badges(name, description, image_url)
        `)
        .eq('user_id', user.id)
        .order('earned_at', { ascending: false })
        .limit(4);

      if (error) throw error;
      setUserBadges(data || []);
    } catch (error) {
      console.error('Error fetching user badges:', error);
    }
  };

  const fetchUserProgress = async () => {
    try {
      if (!user?.id) return;

      const { data, error } = await supabase
        .from('progress')
        .select(`
          status,
          score,
          module:modules(title)
        `)
        .eq('user_id', user.id)
        .eq('status', 'completed');

      if (error) throw error;
      setUserProgress(data || []);
    } catch (error) {
      console.error('Error fetching user progress:', error);
    }
  };

  const fetchCertificates = async () => {
    try {
      if (!user?.id) return;

      const { data, error } = await supabase
        .from('certificates')
        .select('*')
        .eq('user_id', user.id)
        .order('issued_at', { ascending: false });

      if (error) throw error;
      setCertificates(data || []);
    } catch (error) {
      console.error('Error fetching certificates:', error);
    }
  };

  const fetchLeaderboardPosition = async () => {
    try {
      if (!user?.id) return;

      const { data, error } = await supabase
        .from('leaderboard')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setLeaderboardPosition(data);
    } catch (error) {
      console.error('Error fetching leaderboard position:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async () => {
    if (!profileData || !user?.id) return;

    try {
      const { error } = await supabase
        .from('users')
        .update({
          full_name: profileData.full_name,
          phone: profileData.phone,
          income_goal_3_months: profileData["What's your income goal in the next 3 months?"],
          income_reason: profileData["Why do you want to make this income?"],
          final_goal: profileData["Final Goal"]
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Profile updated successfully",
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    }
  };

  const downloadCertificate = async (certificate: Certificate) => {
    try {
      // Mark as downloaded
      const { error } = await supabase
        .from('certificates')
        .update({ downloaded: true })
        .eq('id', certificate.id);

      if (error) throw error;

      // Open certificate URL
      window.open(certificate.certificate_url, '_blank');
      
      // Update local state
      setCertificates(prev => 
        prev.map(cert => 
          cert.id === certificate.id 
            ? { ...cert, downloaded: true }
            : cert
        )
      );

      toast({
        title: "Certificate Downloaded",
        description: "Your certificate has been opened in a new tab",
      });
    } catch (error) {
      console.error('Error downloading certificate:', error);
      toast({
        title: "Error",
        description: "Failed to download certificate",
        variant: "destructive",
      });
    }
  };

  if (loading || !profileData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Profile Settings</h1>
        <p className="text-gray-600 mt-2">Manage your account and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Information */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="w-5 h-5 mr-2" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={profileData.full_name}
                    onChange={(e) => setProfileData({...profileData, full_name: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profileData.email}
                    disabled
                    className="bg-gray-50"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={profileData.phone || ""}
                  onChange={(e) => setProfileData({...profileData, phone: e.target.value})}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Target className="w-5 h-5 mr-2" />
                Goals & Motivation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="incomeGoal">Income Goal (Next 3 Months)</Label>
                <Input
                  id="incomeGoal"
                  value={profileData["What's your income goal in the next 3 months?"] || ""}
                  onChange={(e) => setProfileData({...profileData, "What's your income goal in the next 3 months?": e.target.value})}
                />
              </div>
              
              <div>
                <Label htmlFor="whySuccess">Why do you want to make this income?</Label>
                <Textarea
                  id="whySuccess"
                  value={profileData["Why do you want to make this income?"] || ""}
                  onChange={(e) => setProfileData({...profileData, "Why do you want to make this income?": e.target.value})}
                  rows={3}
                />
              </div>
              
              <div>
                <Label htmlFor="dreamGoal">Final Goal</Label>
                <Textarea
                  id="dreamGoal"
                  value={profileData["Final Goal"] || ""}
                  onChange={(e) => setProfileData({...profileData, "Final Goal": e.target.value})}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Bell className="w-5 h-5 mr-2" />
                Notification Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="whatsapp-notif">WhatsApp Notifications</Label>
                  <p className="text-sm text-gray-600">Receive reminders and updates via WhatsApp</p>
                </div>
                <Switch
                  id="whatsapp-notif"
                  checked={notifications.whatsapp}
                  onCheckedChange={(checked) => setNotifications({...notifications, whatsapp: checked})}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="email-notif">Email Notifications</Label>
                  <p className="text-sm text-gray-600">Receive updates and progress reports via email</p>
                </div>
                <Switch
                  id="email-notif"
                  checked={notifications.email}
                  onCheckedChange={(checked) => setNotifications({...notifications, email: checked})}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="assignment-notif">Assignment Reminders</Label>
                  <p className="text-sm text-gray-600">Get notified about upcoming assignments</p>
                </div>
                <Switch
                  id="assignment-notif"
                  checked={notifications.assignments}
                  onCheckedChange={(checked) => setNotifications({...notifications, assignments: checked})}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="progress-notif">Progress Updates</Label>
                  <p className="text-sm text-gray-600">Weekly progress summaries and insights</p>
                </div>
                <Switch
                  id="progress-notif"
                  checked={notifications.progress}
                  onCheckedChange={(checked) => setNotifications({...notifications, progress: checked})}
                />
              </div>
            </CardContent>
          </Card>

          {/* Certificates Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Award className="w-5 h-5 mr-2" />
                My Certificates
              </CardTitle>
            </CardHeader>
            <CardContent>
              {certificates.length === 0 ? (
                <div className="text-center py-8">
                  <Award className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-medium mb-2">No Certificates Yet</h3>
                  <p className="text-gray-600 mb-4">
                    Complete course requirements to earn your first certificate
                  </p>
                  <Button variant="outline">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View Requirements
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {certificates.map((certificate) => (
                    <div key={certificate.id} className="border border-yellow-200 bg-yellow-50 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-yellow-100 rounded-full">
                            <Award className="w-5 h-5 text-yellow-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{certificate.track}</h3>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Calendar className="w-4 h-4" />
                              <span>Issued on {new Date(certificate.issued_at).toLocaleDateString()}</span>
                              {certificate.downloaded && (
                                <Badge variant="secondary" className="ml-2">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Downloaded
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button 
                          onClick={() => downloadCertificate(certificate)}
                          size="sm"
                          className="flex items-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          {certificate.downloaded ? 'Download Again' : 'Download'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex space-x-4">
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={updateProfile}>
              Save Changes
            </Button>
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Download My Data
            </Button>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Profile Stats */}
          <Card className="bg-gradient-to-r from-blue-50 to-green-50">
            <CardHeader>
              <CardTitle className="text-lg">Your Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm">Completed Modules</span>
                  <span className="font-bold text-blue-600">{userProgress.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Current Rank</span>
                  <span className="font-bold text-green-600">
                    {leaderboardPosition ? `#${leaderboardPosition.rank}` : 'Unranked'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Total Points</span>
                  <span className="font-bold text-purple-600">
                    {leaderboardPosition ? leaderboardPosition.points : 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Badges Earned</span>
                  <span className="font-bold text-orange-600">{userBadges.length}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Achievements */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <Trophy className="w-5 h-5 mr-2 text-yellow-600" />
                Recent Achievements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {userBadges.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No badges earned yet. Keep learning to unlock achievements!
                  </p>
                ) : (
                  userBadges.map((userBadge) => (
                    <div key={userBadge.id} className="flex items-center space-x-3 p-2 rounded-lg bg-gray-50">
                      <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                        🏆
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{userBadge.badge.name}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(userBadge.earned_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* ShoaibGPT Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">ShoaibGPT Style</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button variant="outline" className="w-full justify-start">
                  🔥 Strict Mentor
                </Button>
                <Button variant="outline" className="w-full justify-start bg-blue-50 border-blue-200">
                  😊 Friendly Guide
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  💡 Motivational Coach
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile;
