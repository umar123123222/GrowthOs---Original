
import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Send, MessageSquare, BookOpen, Heart, Brain, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: number;
  sender: "user" | "ai" | "loading";
  content: string;
  timestamp: Date;
}

interface ShoaibGPTProps {
  onClose: () => void;
  user?: {
    id: string;
    full_name?: string;
    email?: string;
  };
}

const ShoaibGPT = ({ onClose, user }: ShoaibGPTProps) => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      sender: "ai",
      content: "Hello, I'm your Success Partner. I'm here to help you succeed in your e-commerce journey. What can I help you with today?",
      timestamp: new Date()
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const sendToWebhook = useCallback(async (userMessage: string): Promise<string> => {
    try {
      // Ensure we have proper user data
      const studentId = user?.id || 'unknown';
      const studentName = user?.full_name || user?.email?.split('@')[0] || 'Student';
      
      const payload = {
        message: userMessage,
        studentId: studentId,
        studentName: studentName
      };
      
      console.log('User object:', user);
      console.log('Sending webhook payload:', payload);
      
      const response = await fetch('https://n8n.core47.ai/webhook/SuccessPartner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.reply || "Sorry, I couldn't process your request right now.";
    } catch (error) {
      console.error('Webhook error:', error);
      throw error;
    }
  }, [user]);

  const handleSendMessage = useCallback(async () => {
    console.log('HandleSendMessage called with:', { message: message.trim(), isLoading, userId: user?.id, user });
    
    if (!message.trim() || isLoading) {
      console.log('Message sending blocked:', { messageEmpty: !message.trim(), isLoading });
      return;
    }

    if (!user?.id) {
      console.log('User ID missing:', user);
      toast({
        title: "User Error",
        description: "User information not available. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }

    const userMessage: Message = {
      id: Date.now(),
      sender: "user",
      content: message.trim(),
      timestamp: new Date()
    };

    const loadingMessage: Message = {
      id: Date.now() + 1,
      sender: "loading",
      content: "AI Assistant is thinking...",
      timestamp: new Date()
    };

    // Add user message and loading indicator
    setMessages(prev => [...prev, userMessage, loadingMessage]);
    setMessage("");
    setIsLoading(true);

    try {
      const aiReply = await sendToWebhook(userMessage.content);
      
      // Remove loading message and add AI response
      setMessages(prev => {
        const withoutLoading = prev.filter(msg => msg.sender !== "loading");
        const aiMessage: Message = {
          id: Date.now() + 2,
          sender: "ai",
          content: aiReply,
          timestamp: new Date()
        };
        return [...withoutLoading, aiMessage];
      });
    } catch (error) {
      // Remove loading message and add fallback
      setMessages(prev => {
        const withoutLoading = prev.filter(msg => msg.sender !== "loading");
        const fallbackMessage: Message = {
          id: Date.now() + 2,
          sender: "ai",
          content: "Sorry, the assistant is not available right now.",
          timestamp: new Date()
        };
        return [...withoutLoading, fallbackMessage];
      });
      
      toast({
        title: "Connection Error",
        description: "Unable to reach the AI assistant. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [message, isLoading, sendToWebhook, toast]);

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
          
        </CardHeader>

        {/* Messages */}
        <CardContent className="flex-1 overflow-y-auto space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[80%] p-3 rounded-lg ${
                msg.sender === "user" 
                  ? "bg-primary text-primary-foreground" 
                  : msg.sender === "loading"
                  ? "bg-muted text-muted-foreground animate-pulse"
                  : "bg-muted/50 text-foreground italic"
              }`}>
                {msg.sender === "loading" && (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span className="text-sm">AI Assistant is thinking...</span>
                  </div>
                )}
                {msg.sender !== "loading" && (
                  <>
                    {msg.sender === "ai" && (
                      <p className="text-xs font-medium mb-1 opacity-70">AI Assistant</p>
                    )}
                    <p className="text-sm">{msg.content}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {msg.timestamp.toLocaleTimeString()}
                    </p>
                  </>
                )}
              </div>
            </div>
          ))}
        </CardContent>

        {/* Input */}
        <div className="flex-shrink-0 p-4 border-t">
          <div className="flex space-x-2">
            <Input
              placeholder="Ask about videos, assignments, or course content..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
              disabled={isLoading}
            />
            <Button onClick={handleSendMessage} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
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
