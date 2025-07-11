import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle, 
  ArrowLeft,
  Play,
  Lock,
  MessageCircle
} from "lucide-react";
import ShoaibGPT from "@/components/ShoaibGPT";

const VideoPlayer = () => {
  const { moduleId, lessonId } = useParams();
  const navigate = useNavigate();
  const [showShoaibGPT, setShowShoaibGPT] = useState(false);
  const [checkedItems, setCheckedItems] = useState<{ [key: number]: boolean }>({});

  // Mock data - in real app, fetch based on moduleId and lessonId
  const currentVideo = {
    id: lessonId,
    title: "Market Research Basics",
    description: "Learn how to conduct effective market research to identify profitable niches and understand your target audience.",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    duration: "18:20",
    module: "Introduction to E-commerce",
    checklist: [
      "Identify your target market",
      "Analyze market size and potential", 
      "Study competitor pricing strategies",
      "Research customer pain points",
      "Create buyer personas"
    ]
  };

  const modules = [
    {
      id: 1,
      title: "Introduction to E-commerce",
      progress: 66,
      lessons: [
        { id: 1, title: "Welcome to the Course", duration: "5:30", completed: true, locked: false },
        { id: 2, title: "E-commerce Fundamentals", duration: "12:45", completed: true, locked: false },
        { id: 3, title: "Market Research Basics", duration: "18:20", completed: false, locked: false }
      ]
    },
    {
      id: 2,
      title: "Product Research & Selection", 
      progress: 0,
      lessons: [
        { id: 4, title: "Finding Winning Products", duration: "22:15", completed: false, locked: false },
        { id: 5, title: "Competitor Analysis", duration: "16:30", completed: false, locked: false },
        { id: 6, title: "Trend Identification", duration: "14:45", completed: false, locked: true }
      ]
    }
  ];

  const handleChecklistToggle = (index: number) => {
    setCheckedItems(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const handleVideoSelect = (moduleId: number, lessonId: number) => {
    navigate(`/videos/${moduleId}/${lessonId}`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Video Player Section */}
      <div className="lg:col-span-3 space-y-6">
        <div className="flex items-center gap-3 mb-4">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate('/videos')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Videos
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="aspect-video bg-gray-900 rounded-t-lg">
              <iframe
                src={currentVideo.videoUrl}
                className="w-full h-full rounded-t-lg"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={currentVideo.title}
              />
            </div>
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-2">{currentVideo.title}</h2>
              <p className="text-muted-foreground mb-4">{currentVideo.description}</p>
              
              <div className="flex items-center space-x-4 mb-6">
                <Badge className="bg-blue-100 text-blue-800">{currentVideo.module}</Badge>
                <Badge variant="outline">{currentVideo.duration} duration</Badge>
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
                        <input 
                          type="checkbox" 
                          className="rounded" 
                          checked={checkedItems[index] || false}
                          onChange={() => handleChecklistToggle(index)}
                        />
                        <span className={checkedItems[index] ? "line-through text-muted-foreground" : ""}>
                          {item}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        {/* ShoaibGPT Assistant */}
        <Card className="bg-gradient-to-r from-blue-50 to-green-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-green-600 rounded-full mr-2 flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-white" />
              </div>
              ShoaibGPT
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              I'm here to help! Ask me anything about this video or your learning journey.
            </p>
            <Button 
              size="sm" 
              className="w-full"
              onClick={() => setShowShoaibGPT(true)}
            >
              Ask ShoaibGPT
            </Button>
          </CardContent>
        </Card>

        {/* Module Progress */}
        {modules.map((module) => (
          <Card key={module.id}>
            <CardHeader>
              <CardTitle className="text-lg">{module.title}</CardTitle>
              <Progress value={module.progress} className="h-2" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {module.lessons.map((lesson) => (
                  <div
                    key={lesson.id}
                    className={`flex items-center space-x-3 p-2 rounded-lg cursor-pointer transition-colors ${
                      lesson.locked 
                        ? "opacity-50 cursor-not-allowed" 
                        : lesson.id.toString() === lessonId
                        ? "bg-blue-50 border border-blue-200"
                        : "hover:bg-gray-50"
                    }`}
                    onClick={() => !lesson.locked && handleVideoSelect(module.id, lesson.id)}
                  >
                    <div className="flex-shrink-0">
                      {lesson.locked ? (
                        <Lock className="w-4 h-4 text-gray-400" />
                      ) : lesson.completed ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <Play className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{lesson.title}</p>
                      <p className="text-xs text-muted-foreground">{lesson.duration}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {showShoaibGPT && (
        <ShoaibGPT 
          onClose={() => setShowShoaibGPT(false)}
        />
      )}
    </div>
  );
};

export default VideoPlayer;