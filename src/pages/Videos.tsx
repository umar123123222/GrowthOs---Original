
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Play, 
  CheckCircle, 
  Clock, 
  Lock,
  BookOpen
} from "lucide-react";

const Videos = () => {
  const [selectedVideo, setSelectedVideo] = useState(null);

  const modules = [
    {
      id: 1,
      title: "Introduction to E-commerce",
      videos: [
        { id: 1, title: "Welcome to the Course", duration: "5:30", completed: true, locked: false },
        { id: 2, title: "E-commerce Fundamentals", duration: "12:45", completed: true, locked: false },
        { id: 3, title: "Market Research Basics", duration: "18:20", completed: false, locked: false }
      ]
    },
    {
      id: 2,
      title: "Product Research & Selection",
      videos: [
        { id: 4, title: "Finding Winning Products", duration: "22:15", completed: false, locked: false },
        { id: 5, title: "Competitor Analysis", duration: "16:30", completed: false, locked: false },
        { id: 6, title: "Trend Identification", duration: "14:45", completed: false, locked: true }
      ]
    },
    {
      id: 3,
      title: "Shopify Store Setup",
      videos: [
        { id: 7, title: "Creating Your Store", duration: "25:00", completed: false, locked: true },
        { id: 8, title: "Theme Customization", duration: "20:30", completed: false, locked: true },
        { id: 9, title: "Payment Setup", duration: "15:15", completed: false, locked: true }
      ]
    }
  ];

  const currentVideo = {
    id: 3,
    title: "Market Research Basics",
    description: "Learn how to conduct effective market research to identify profitable niches and understand your target audience.",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    checklist: [
      "Identify your target market",
      "Analyze market size and potential",
      "Study competitor pricing strategies",
      "Research customer pain points",
      "Create buyer personas"
    ]
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Video Player */}
      <div className="lg:col-span-3 space-y-6">
        <Card>
          <CardContent className="p-0">
            <div className="aspect-video bg-gray-900 rounded-t-lg">
              <iframe
                src={currentVideo.videoUrl}
                className="w-full h-full rounded-t-lg"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-2">{currentVideo.title}</h2>
              <p className="text-gray-600 mb-4">{currentVideo.description}</p>
              
              <div className="flex items-center space-x-4 mb-6">
                <Badge className="bg-blue-100 text-blue-800">Module 1</Badge>
                <Badge variant="outline">18:20 duration</Badge>
                <Button size="sm" className="bg-green-600 hover:bg-green-700">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Mark Complete
                </Button>
              </div>

              {/* Action Checklist */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Action Checklist</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {currentVideo.checklist.map((item, index) => (
                      <div key={index} className="flex items-center space-x-3">
                        <input type="checkbox" className="rounded" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        {/* Quiz Section */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Quiz</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <h3 className="font-medium">What is the most important factor in market research?</h3>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start">
                  A) Market size
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  B) Customer needs and pain points
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  C) Competitor pricing
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  D) Market trends
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sidebar - Video List */}
      <div className="space-y-6">
        {/* ShoaibGPT Assistant */}
        <Card className="bg-gradient-to-r from-blue-50 to-green-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-green-600 rounded-full mr-2"></div>
              ShoaibGPT
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-3">
              I'm here to help! Ask me anything about this video or your learning journey.
            </p>
            <Button size="sm" className="w-full">
              Ask ShoaibGPT
            </Button>
          </CardContent>
        </Card>

        {/* Module Progress */}
        {modules.map((module) => (
          <Card key={module.id}>
            <CardHeader>
              <CardTitle className="text-lg">{module.title}</CardTitle>
              <Progress value={33} className="h-2" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {module.videos.map((video) => (
                  <div
                    key={video.id}
                    className={`flex items-center space-x-3 p-2 rounded-lg cursor-pointer transition-colors ${
                      video.locked 
                        ? "opacity-50 cursor-not-allowed" 
                        : "hover:bg-gray-50"
                    }`}
                    onClick={() => !video.locked && setSelectedVideo(video)}
                  >
                    <div className="flex-shrink-0">
                      {video.locked ? (
                        <Lock className="w-4 h-4 text-gray-400" />
                      ) : video.completed ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <Play className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{video.title}</p>
                      <p className="text-xs text-gray-500">{video.duration}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Videos;
