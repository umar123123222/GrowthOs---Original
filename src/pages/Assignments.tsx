
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Upload
} from "lucide-react";

const Assignments = () => {
  const [selectedAssignment, setSelectedAssignment] = useState(1);
  const [submission, setSubmission] = useState("");

  const assignments = [
    {
      id: 1,
      title: "Market Research Assignment",
      module: "Module 2",
      dueDate: "2025-07-10",
      status: "overdue",
      description: "Research and identify 3 potential product niches with market analysis",
      points: 25,
      submitted: false
    },
    {
      id: 2,
      title: "Product Research Report",
      module: "Module 3",
      dueDate: "2025-07-15",
      status: "pending",
      description: "Find 5 winning products using the taught methodology",
      points: 30,
      submitted: false
    },
    {
      id: 3,
      title: "Competitor Analysis",
      module: "Module 4",
      dueDate: "2025-07-20",
      status: "upcoming",
      description: "Analyze top 3 competitors in your chosen niche",
      points: 35,
      submitted: false
    },
    {
      id: 4,
      title: "Store Concept Plan",
      module: "Module 5",
      dueDate: "2025-07-25",
      status: "locked",
      description: "Create a detailed plan for your Shopify store",
      points: 40,
      submitted: false
    }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "overdue":
        return <Badge variant="destructive">Overdue</Badge>;
      case "pending":
        return <Badge className="bg-orange-100 text-orange-800">Due Soon</Badge>;
      case "upcoming":
        return <Badge variant="outline">Upcoming</Badge>;
      case "locked":
        return <Badge variant="secondary">Locked</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  const selectedAssignmentData = assignments.find(a => a.id === selectedAssignment);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Assignment List */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Assignments</h2>
        {assignments.map((assignment) => (
          <Card 
            key={assignment.id}
            className={`cursor-pointer transition-all ${
              selectedAssignment === assignment.id 
                ? "border-blue-500 shadow-md" 
                : "hover:shadow-sm"
            } ${assignment.status === "locked" ? "opacity-50" : ""}`}
            onClick={() => assignment.status !== "locked" && setSelectedAssignment(assignment.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-sm">{assignment.title}</h3>
                {getStatusBadge(assignment.status)}
              </div>
              
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{assignment.module}</span>
                <span className="flex items-center">
                  <Clock className="w-3 h-3 mr-1" />
                  Due: {new Date(assignment.dueDate).toLocaleDateString()}
                </span>
              </div>
              
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-gray-600">{assignment.points} points</span>
                {assignment.status === "overdue" && (
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Assignment Details */}
      <div className="lg:col-span-2">
        {selectedAssignmentData && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">{selectedAssignmentData.title}</CardTitle>
                {getStatusBadge(selectedAssignmentData.status)}
              </div>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <span>{selectedAssignmentData.module}</span>
                <span>•</span>
                <span>{selectedAssignmentData.points} points</span>
                <span>•</span>
                <span>Due: {new Date(selectedAssignmentData.dueDate).toLocaleDateString()}</span>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Description */}
              <div>
                <h3 className="font-semibold mb-2">Assignment Description</h3>
                <p className="text-gray-600">{selectedAssignmentData.description}</p>
              </div>

              {/* Requirements */}
              <div>
                <h3 className="font-semibold mb-2">Requirements</h3>
                <ul className="list-disc list-inside text-gray-600 space-y-1">
                  <li>Submit a detailed report with your findings</li>
                  <li>Include screenshots and data to support your analysis</li>
                  <li>Minimum 500 words for written submissions</li>
                  <li>Follow the provided template format</li>
                </ul>
              </div>

              {/* Submission Area */}
              <div>
                <h3 className="font-semibold mb-2">Your Submission</h3>
                {selectedAssignmentData.status !== "locked" ? (
                  <div className="space-y-4">
                    <Textarea
                      placeholder="Write your assignment submission here..."
                      value={submission}
                      onChange={(e) => setSubmission(e.target.value)}
                      className="min-h-32"
                    />
                    
                    <div className="flex items-center space-x-4">
                      <Button className="bg-blue-600 hover:bg-blue-700">
                        <FileText className="w-4 h-4 mr-2" />
                        Submit Assignment
                      </Button>
                      
                      <Button variant="outline">
                        <Upload className="w-4 h-4 mr-2" />
                        Upload File
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Complete previous assignments to unlock this one</p>
                  </div>
                )}
              </div>

              {/* AI Feedback */}
              {selectedAssignmentData.status === "overdue" && (
                <Card className="bg-red-50 border-red-200">
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-red-800">Assignment Overdue</h4>
                        <p className="text-red-700 text-sm mt-1">
                          This assignment is past due. Submit as soon as possible to maintain your progress. 
                          Consider reviewing Module 2 videos again if you need help.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Assignments;
