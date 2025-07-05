
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { 
  User, 
  Settings, 
  Bell, 
  Download,
  Target,
  Trophy
} from "lucide-react";

const Profile = () => {
  const [profileData, setProfileData] = useState({
    name: "Your Name",
    email: "your@email.com",
    phone: "+92 300 1234567",
    incomeGoal: "PKR 100,000",
    whySuccess: "I want to support my family and achieve financial freedom",
    dreamGoal: "Go for Umrah with family and buy a BMW within 2 years"
  });

  const [notifications, setNotifications] = useState({
    whatsapp: true,
    email: true,
    assignments: true,
    progress: true
  });

  const achievements = [
    { name: "Early Bird", icon: "🌅", date: "2025-01-15" },
    { name: "First Video", icon: "📹", date: "2025-01-16" },
    { name: "Quiz Master", icon: "🧠", date: "2025-01-20" },
    { name: "Week Warrior", icon: "⚡", date: "2025-01-25" }
  ];

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
                    value={profileData.name}
                    onChange={(e) => setProfileData({...profileData, name: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData({...profileData, email: e.target.value})}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={profileData.phone}
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
                <Label htmlFor="incomeGoal">Monthly Income Goal</Label>
                <Input
                  id="incomeGoal"
                  value={profileData.incomeGoal}
                  onChange={(e) => setProfileData({...profileData, incomeGoal: e.target.value})}
                />
              </div>
              
              <div>
                <Label htmlFor="whySuccess">Why do you want to succeed?</Label>
                <Textarea
                  id="whySuccess"
                  value={profileData.whySuccess}
                  onChange={(e) => setProfileData({...profileData, whySuccess: e.target.value})}
                  rows={3}
                />
              </div>
              
              <div>
                <Label htmlFor="dreamGoal">Dream Goal</Label>
                <Textarea
                  id="dreamGoal"
                  value={profileData.dreamGoal}
                  onChange={(e) => setProfileData({...profileData, dreamGoal: e.target.value})}
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

          <div className="flex space-x-4">
            <Button className="bg-blue-600 hover:bg-blue-700">
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
                  <span className="text-sm">Overall Progress</span>
                  <span className="font-bold text-blue-600">75%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Current Rank</span>
                  <span className="font-bold text-green-600">#3</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Login Streak</span>
                  <span className="font-bold text-orange-600">🔥 7 days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Total Points</span>
                  <span className="font-bold text-purple-600">1,250</span>
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
                {achievements.map((achievement, index) => (
                  <div key={index} className="flex items-center space-x-3 p-2 rounded-lg bg-gray-50">
                    <span className="text-lg">{achievement.icon}</span>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{achievement.name}</div>
                      <div className="text-xs text-gray-500">{achievement.date}</div>
                    </div>
                  </div>
                ))}
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
