
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AssignmentSubmissionDialog } from "@/components/AssignmentSubmissionDialog";
import { 
  Play, 
  CheckCircle, 
  Clock, 
  Lock,
  FileText,
  ChevronDown,
  ChevronRight
} from "lucide-react";

const Videos = () => {
  const navigate = useNavigate();
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<{
    title: string;
    lessonTitle: string;
    submitted: boolean;
  } | null>(null);
  const [expandedModules, setExpandedModules] = useState<{ [key: number]: boolean }>({
    1: true // First module expanded by default
  });

  const modules = [
    {
      id: 1,
      title: "Introduction to E-commerce",
      totalLessons: 3,
      completedLessons: 2,
      lessons: [
        { 
          id: 1, 
          title: "Welcome to the Course", 
          duration: "5:30", 
          completed: true, 
          locked: false,
          assignmentTitle: "Course Introduction Assignment",
          assignmentSubmitted: true
        },
        { 
          id: 2, 
          title: "E-commerce Fundamentals", 
          duration: "12:45", 
          completed: true, 
          locked: false,
          assignmentTitle: "E-commerce Basics Quiz",
          assignmentSubmitted: false
        },
        { 
          id: 3, 
          title: "Market Research Basics", 
          duration: "18:20", 
          completed: false, 
          locked: false,
          assignmentTitle: "Market Research Report",
          assignmentSubmitted: false
        }
      ]
    },
    {
      id: 2,
      title: "Product Research & Selection",
      totalLessons: 3,
      completedLessons: 0,
      lessons: [
        { 
          id: 4, 
          title: "Finding Winning Products", 
          duration: "22:15", 
          completed: false, 
          locked: false,
          assignmentTitle: "Product Research Assignment",
          assignmentSubmitted: false
        },
        { 
          id: 5, 
          title: "Competitor Analysis", 
          duration: "16:30", 
          completed: false, 
          locked: false,
          assignmentTitle: "Competitor Analysis Report",
          assignmentSubmitted: false
        },
        { 
          id: 6, 
          title: "Trend Identification", 
          duration: "14:45", 
          completed: false, 
          locked: true,
          assignmentTitle: "Trend Analysis Assignment",
          assignmentSubmitted: false
        }
      ]
    },
    {
      id: 3,
      title: "Shopify Store Setup",
      totalLessons: 3,
      completedLessons: 0,
      lessons: [
        { 
          id: 7, 
          title: "Creating Your Store", 
          duration: "25:00", 
          completed: false, 
          locked: true,
          assignmentTitle: "Store Setup Assignment",
          assignmentSubmitted: false
        },
        { 
          id: 8, 
          title: "Theme Customization", 
          duration: "20:30", 
          completed: false, 
          locked: true,
          assignmentTitle: "Theme Customization Task",
          assignmentSubmitted: false
        },
        { 
          id: 9, 
          title: "Payment Setup", 
          duration: "15:15", 
          completed: false, 
          locked: true,
          assignmentTitle: "Payment Integration Assignment",
          assignmentSubmitted: false
        }
      ]
    }
  ];

  const handleWatchNow = (moduleId: number, lessonId: number) => {
    navigate(`/videos/${moduleId}/${lessonId}`);
  };

  const handleAssignmentClick = (lessonTitle: string, assignmentTitle: string, assignmentSubmitted: boolean) => {
    setSelectedAssignment({
      title: assignmentTitle,
      lessonTitle: lessonTitle,
      submitted: assignmentSubmitted
    });
    setAssignmentDialogOpen(true);
  };

  const toggleModule = (moduleId: number) => {
    setExpandedModules(prev => ({
      ...prev,
      [moduleId]: !prev[moduleId]
    }));
  };

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Available Lessons</h1>
        <p className="text-muted-foreground">
          Watch lessons and complete assignments to track your progress
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-muted/20">
                <tr>
                  <th className="text-left p-4 font-medium">Lesson</th>
                  <th className="text-left p-4 font-medium">Duration</th>
                  <th className="text-left p-4 font-medium">Assignment</th>
                  <th className="text-left p-4 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {modules.map((module) => (
                  <>
                    {/* Module Header */}
                    <tr 
                      key={`module-${module.id}`} 
                      className="border-b bg-blue-50/50 cursor-pointer hover:bg-blue-50"
                      onClick={() => toggleModule(module.id)}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {expandedModules[module.id] ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                          <span className="font-semibold">{module.title}</span>
                          <Badge variant="outline" className="ml-2">
                            {module.completedLessons}/{module.totalLessons} completed
                          </Badge>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted-foreground">Module</span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted-foreground">
                          {module.totalLessons} assignments
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted-foreground">-</span>
                      </td>
                    </tr>

                    {/* Module Lessons */}
                    {expandedModules[module.id] && module.lessons.map((lesson) => (
                      <tr 
                        key={`lesson-${lesson.id}`} 
                        className={`border-b hover:bg-muted/20 ${
                          lesson.locked ? "opacity-50" : ""
                        }`}
                      >
                        <td className="p-4 pl-8">
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0">
                              {lesson.locked ? (
                                <Lock className="w-4 h-4 text-muted-foreground" />
                              ) : lesson.completed ? (
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              ) : (
                                <Play className="w-4 h-4 text-blue-600" />
                              )}
                            </div>
                            <span className={lesson.locked ? "text-muted-foreground" : ""}>
                              {lesson.title}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm">{lesson.duration}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`flex items-center gap-2 ${
                              lesson.assignmentSubmitted 
                                ? "text-green-600 hover:text-green-700" 
                                : "text-blue-600 hover:text-blue-700"
                            }`}
                            onClick={() => !lesson.locked && handleAssignmentClick(lesson.title, lesson.assignmentTitle, lesson.assignmentSubmitted)}
                            disabled={lesson.locked}
                          >
                            <FileText className="w-4 h-4" />
                            <span className="text-sm">
                              {lesson.assignmentSubmitted ? "✓ " : ""}{lesson.assignmentTitle}
                            </span>
                          </Button>
                        </td>
                        <td className="p-4">
                          <Button
                            size="sm"
                            onClick={() => !lesson.locked && handleWatchNow(module.id, lesson.id)}
                            disabled={lesson.locked}
                            className="text-blue-600 hover:text-blue-700"
                            variant="ghost"
                          >
                            Watch Now
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {selectedAssignment && (
        <AssignmentSubmissionDialog
          open={assignmentDialogOpen}
          onOpenChange={setAssignmentDialogOpen}
          assignmentTitle={selectedAssignment.title}
          lessonTitle={selectedAssignment.lessonTitle}
          isSubmitted={selectedAssignment.submitted}
        />
      )}
    </div>
  );
};

export default Videos;
