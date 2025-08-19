
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Send, MessageSquare, BookOpen, Heart, Brain } from "lucide-react";

interface ShoaibGPTProps {
  onClose: () => void;
}

const ShoaibGPT = ({ onClose }: ShoaibGPTProps) => {
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<"course" | "life">("course");
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: "ai",
      content: "Assalam-o-Alaikum! I'm ShoaibGPT, your AI mentor. I'm here to help you succeed in your e-commerce journey. What can I help you with today?",
      timestamp: new Date()
    }
  ]);

  const handleSendMessage = () => {
    if (!message.trim()) return;

    // Add user message
    const userMessage = {
      id: messages.length + 1,
      type: "user",
      content: message,
      timestamp: new Date()
    };

    // Simulate AI response
    const aiResponse = {
      id: messages.length + 2,
      type: "ai",
      content: mode === "course" 
        ? `Great question about the course! Based on your progress, I see you're on Module 3. ${message.includes("video") ? "You can rewatch the video at timestamp 5:30 for that specific concept." : "Keep up the good work! You're doing better than 70% of your cohort."}`
        : `I understand this can be challenging. Remember your goal - you want to achieve PKR 100,000 monthly income to support your family. Every small step counts. You've got this! 💪`,
      timestamp: new Date()
    };

    setMessages([...messages, userMessage, aiResponse]);
    setMessage("");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl h-[600px] flex flex-col">
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-green-600 rounded-full flex items-center justify-center text-white font-bold">
                <Brain className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Success Partner</CardTitle>
                <p className="text-sm text-gray-600">Your AI Success Mentor</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Mode Toggle */}
          <div className="flex space-x-2 mt-4">
            <Button
              variant={mode === "course" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("course")}
              className="flex items-center space-x-2"
            >
              <BookOpen className="w-4 h-4" />
              <span>Course Help</span>
            </Button>
            <Button
              variant={mode === "life" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("life")}
              className="flex items-center space-x-2"
            >
              <Heart className="w-4 h-4" />
              <span>Life Advice</span>
            </Button>
          </div>
        </CardHeader>

        {/* Messages */}
        <CardContent className="flex-1 overflow-y-auto space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-lg ${
                  msg.type === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-900"
                }`}
              >
                <p className="text-sm">{msg.content}</p>
                <p className="text-xs opacity-70 mt-1">
                  {msg.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
        </CardContent>

        {/* Input */}
        <div className="flex-shrink-0 p-4 border-t">
          <div className="flex space-x-2">
            <Input
              placeholder={
                mode === "course"
                  ? "Ask about videos, assignments, or course content..."
                  : "Share what's on your mind or ask for motivation..."
              }
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
            />
            <Button onClick={handleSendMessage}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge 
              variant="outline" 
              className="cursor-pointer hover:bg-gray-100"
              onClick={() => setMessage("I'm stuck on the current assignment")}
            >
              Assignment Help
            </Badge>
            <Badge 
              variant="outline" 
              className="cursor-pointer hover:bg-gray-100"
              onClick={() => setMessage("Can you explain the video concept again?")}
            >
              Video Explanation
            </Badge>
            <Badge 
              variant="outline" 
              className="cursor-pointer hover:bg-gray-100"
              onClick={() => setMessage("I'm feeling demotivated")}
            >
              Need Motivation
            </Badge>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ShoaibGPT;
