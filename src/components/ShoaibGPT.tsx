
import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Send, MessageSquare, BookOpen, Heart, Brain, Loader2, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ENV_CONFIG } from "@/lib/env-config";

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

interface CreditsInfo {
  credits_used: number;
  daily_limit: number;
  credits_remaining: number;
  can_send_message: boolean;
  date: string;
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
  const [credits, setCredits] = useState<CreditsInfo | null>(null);
  const [loadingCredits, setLoadingCredits] = useState(true);
  const { toast } = useToast();

  // Validate user data - show error if incomplete
  if (!user?.id || !user?.email) {
    console.error('ShoaibGPT: Incomplete user data provided', { user });
    toast({
      title: "User Error",
      description: "Unable to initialize chat. Please refresh the page and try again.",
      variant: "destructive",
    });
    onClose();
    return null;
  }

  // Fetch credits on component mount
  useEffect(() => {
    const fetchCredits = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('success-partner-credits', {
          method: 'GET'
        });

        if (error) {
          console.error('Error fetching credits:', error);
          return;
        }

        setCredits(data);
      } catch (error) {
        console.error('Error fetching credits:', error);
      } finally {
        setLoadingCredits(false);
      }
    };

    fetchCredits();
  }, []);

  // Function to update credits after successful message
  const updateCredits = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('success-partner-credits', {
        method: 'POST'
      });

      if (error) {
        console.error('Error updating credits:', error);
        return;
      }

      setCredits(data);
    } catch (error) {
      console.error('Error updating credits:', error);
    }
  }, []);

  const sendToWebhook = useCallback(async (userMessage: string): Promise<string> => {
    try {
      // Use validated user data (already checked above)
      const studentId = user.id;
      const studentName = user.full_name || user.email.split('@')[0] || 'Student';
      
      const payload = {
        message: userMessage,
        studentId: studentId,
        studentName: studentName,
        timestamp: new Date().toISOString()
      };
      
      console.log('Success Partner: Sending message', { 
        studentId, 
        studentName, 
        messageLength: userMessage.length 
      });
      
      const response = await fetch(ENV_CONFIG.SUCCESS_PARTNER_WEBHOOK_URL, {
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
      console.log('Success Partner: Webhook response received', { data, type: typeof data });
      
      // Handle different response formats and ensure string output
      let aiResponse = "";
      if (data && typeof data === 'object') {
        // Handle array format: {"reply":[{"output":"message"}]}
        if (data.reply && Array.isArray(data.reply) && data.reply.length > 0) {
          const firstReply = data.reply[0];
          if (firstReply && typeof firstReply === 'object' && firstReply.output) {
            aiResponse = typeof firstReply.output === 'string' ? firstReply.output : String(firstReply.output);
          }
        }
        // Handle nested structure: {"reply":{"output":"message"}}
        else if (data.reply && typeof data.reply === 'object' && data.reply.output) {
          aiResponse = typeof data.reply.output === 'string' ? data.reply.output : String(data.reply.output);
        }
        // Handle flat structure: {"reply":"message"}
        else if (data.reply && typeof data.reply === 'string') {
          aiResponse = data.reply;
        }
        // Handle direct output: {"output":"message"}
        else if (data.output) {
          if (typeof data.output === 'string') {
            aiResponse = data.output;
          } else if (typeof data.output === 'object') {
            aiResponse = data.output.text || data.output.message || data.output.content || JSON.stringify(data.output);
          } else {
            aiResponse = String(data.output);
          }
        }
        // Handle other message fields
        else if (data.message && typeof data.message === 'string') {
          aiResponse = data.message;
        } else {
          // Fallback for any other object structure
          aiResponse = data.text || data.content || JSON.stringify(data);
        }
      } else if (typeof data === 'string') {
        aiResponse = data;
      } else {
        aiResponse = String(data) || "Sorry, I couldn't process your request right now.";
      }
      
      // Ensure the response is always a string
      if (typeof aiResponse !== 'string') {
        console.warn('Success Partner: Non-string response detected, converting:', aiResponse);
        aiResponse = String(aiResponse);
      }
      
      console.log('Success Partner: Final processed response', { aiResponse, length: aiResponse.length });
      return aiResponse;
    } catch (error) {
      console.error('Webhook error:', error);
      throw error;
    }
  }, [user]);

  const handleSendMessage = useCallback(async () => {
    if (!message.trim() || isLoading) {
      console.log('Success Partner: Message sending blocked', { 
        messageEmpty: !message.trim(), 
        isLoading 
      });
      return;
    }

    // Check if user has remaining credits
    if (credits && !credits.can_send_message) {
      toast({
        title: "Daily Limit Reached",
        description: `You've used all ${credits.daily_limit} credits for today. Credits reset at midnight UTC.`,
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
      
      // Update credits after successful AI response
      await updateCredits();
      
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
  }, [message, isLoading, sendToWebhook, updateCredits, credits, toast]);

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
            <div className="flex items-center space-x-2">
              {/* Credits Display */}
              {loadingCredits ? (
                <Badge variant="outline" className="flex items-center space-x-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Loading...</span>
                </Badge>
              ) : credits ? (
                <Badge 
                  variant={credits.credits_remaining <= 2 ? "destructive" : credits.credits_remaining <= 5 ? "secondary" : "outline"}
                  className="flex items-center space-x-1"
                >
                  <MessageSquare className="w-3 h-3" />
                  <span>{credits.credits_remaining}/{credits.daily_limit}</span>
                </Badge>
              ) : null}
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          {/* Credits Warning */}
          {credits && credits.credits_remaining <= 2 && credits.credits_remaining > 0 && (
            <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
              <div className="flex items-center space-x-2 text-sm text-yellow-800">
                <Clock className="w-4 h-4" />
                <span>Only {credits.credits_remaining} credits remaining today. Resets at midnight UTC.</span>
              </div>
            </div>
          )}
          
          {/* No Credits Left */}
          {credits && credits.credits_remaining === 0 && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-center space-x-2 text-sm text-red-800">
                <Clock className="w-4 h-4" />
                <span>Daily limit reached. Your {credits.daily_limit} credits will reset at midnight UTC.</span>
              </div>
            </div>
          )}
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
                    <p className="text-sm">{typeof msg.content === 'string' ? msg.content : String(msg.content)}</p>
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
              disabled={isLoading || (credits && !credits.can_send_message)}
            />
            <Button 
              onClick={handleSendMessage} 
              disabled={isLoading || (credits && !credits.can_send_message)}
            >
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
              className={`cursor-pointer hover:bg-gray-100 ${credits && !credits.can_send_message ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => credits && credits.can_send_message && setMessage("I'm stuck on the current assignment")}
            >
              Assignment Help
            </Badge>
            <Badge 
              variant="outline" 
              className={`cursor-pointer hover:bg-gray-100 ${credits && !credits.can_send_message ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => credits && credits.can_send_message && setMessage("Can you explain the video concept again?")}
            >
              Video Explanation
            </Badge>
            <Badge 
              variant="outline" 
              className={`cursor-pointer hover:bg-gray-100 ${credits && !credits.can_send_message ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => credits && credits.can_send_message && setMessage("I'm feeling demotivated")}
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
