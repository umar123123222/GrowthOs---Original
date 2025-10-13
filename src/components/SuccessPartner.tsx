import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Send, MessageSquare, BookOpen, Heart, Brain, Loader2, Clock, TrendingUp, BarChart3, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ENV_CONFIG } from "@/lib/env-config";
import { detectBusinessContext, getContextDescription } from "@/lib/ai-context-detector";
import { safeLogger } from '@/lib/safe-logger';
import { buildBusinessContext } from "@/lib/ai-context-builder";
import { StudentIntegrations } from "@/lib/student-integrations";
import { useConversationHistory } from "@/hooks/useConversationHistory";
import ReactMarkdown from 'react-markdown';
interface Message {
  id: number;
  sender: "user" | "ai" | "loading";
  content: string;
  timestamp: Date;
}
interface SuccessPartnerProps {
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
const SuccessPartner = ({
  onClose,
  user
}: SuccessPartnerProps) => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([{
    id: 1,
    sender: "ai",
    content: "Hello, I'm your Success Partner. I'm here to help you succeed in your e-commerce journey. What can I help you with today?",
    timestamp: new Date()
  }]);
  const [isLoading, setIsLoading] = useState(false);
  const [credits, setCredits] = useState<CreditsInfo | null>(null);
  const [loadingCredits, setLoadingCredits] = useState(true);
  const [isFetchingContext, setIsFetchingContext] = useState(false);
  const [contextDescription, setContextDescription] = useState("");
  const [integrationStatus, setIntegrationStatus] = useState({
    shopify: false,
    metaAds: false,
    loading: true
  });
  const {
    toast
  } = useToast();

  // Initialize conversation history hook
  const {
    addMessage,
    getHistory,
    messageCount
  } = useConversationHistory(user?.id || 'unknown');

  // Restore today's conversation history into the chat UI on mount
  useEffect(() => {
    const history = getHistory();
    console.log('Success Partner: Restoring conversation history', { 
      historyLength: history.length,
      history: history.map(h => ({ role: h.role, contentPreview: h.content.substring(0, 50) }))
    });
    
    if (history && history.length > 0) {
      const restored = history.map((m, i) => ({
        id: Date.now() + i,
        sender: (m.role === 'user' ? 'user' : 'ai') as 'user' | 'ai',
        content: m.content,
        timestamp: new Date(m.timestamp)
      }));
      
      console.log('Success Partner: Restored messages', {
        restoredCount: restored.length,
        userMessages: restored.filter(m => m.sender === 'user').length,
        aiMessages: restored.filter(m => m.sender === 'ai').length
      });
      
      // Set messages to greeting + restored history
      setMessages([
        {
          id: 1,
          sender: "ai",
          content: "Hello, I'm your Success Partner. I'm here to help you succeed in your e-commerce journey. What can I help you with today?",
          timestamp: new Date()
        },
        ...restored
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Validate user data - show error if incomplete
  if (!user?.id || !user?.email) {
    console.error('SuccessPartner: Incomplete user data provided', {
      user
    });
    toast({
      title: "User Error",
      description: "Unable to initialize chat. Please refresh the page and try again.",
      variant: "destructive"
    });
    onClose();
    return null;
  }

  // Fetch credits on component mount
  useEffect(() => {
    const fetchCredits = async () => {
      try {
        const {
          data,
          error
        } = await supabase.functions.invoke('success-partner-credits', {
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

  // Fetch integration status on component mount and warm up cache
  useEffect(() => {
    const fetchIntegrationStatus = async () => {
      try {
        const integration = await StudentIntegrations.get(user.id);
        const status = {
          shopify: integration?.is_shopify_connected ?? false,
          metaAds: integration?.is_meta_connected ?? false,
          loading: false
        };
        setIntegrationStatus(status);

        // Cache warming removed - we now only fetch when user query requires it
      } catch (error) {
        console.error('Error fetching integration status:', error);
        setIntegrationStatus(prev => ({
          ...prev,
          loading: false
        }));
      }
    };
    fetchIntegrationStatus();
  }, [user.id]);

  // Function to update credits after successful message
  const updateCredits = useCallback(async () => {
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('success-partner-credits', {
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

  // Helper: sleep
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Helper: fetch business context with retries until both services are ready
  const fetchContextUntilReady = async (studentId: string, flags: { includeShopify: boolean; includeMetaAds: boolean }) => {
    const start = Date.now();
    const MAX_WAIT_MS = 120000; // up to 2 minutes
    const SHOPIFY_TIMEOUT = 30000;
    const META_TIMEOUT = 60000;
    let lastContext: any = null;
    while (Date.now() - start < MAX_WAIT_MS) {
      try {
        const ctx = await buildBusinessContext(studentId, flags, Math.max(SHOPIFY_TIMEOUT, META_TIMEOUT), { shopify: SHOPIFY_TIMEOUT, metaAds: META_TIMEOUT });
        lastContext = ctx;
        const shopifyReady = !flags.includeShopify || !!ctx?.shopify?.metrics || ctx?.shopify?.connected === true;
        const metaReady = !flags.includeMetaAds || !!ctx?.metaAds?.metrics || ctx?.metaAds?.connected === true;
        if (shopifyReady && metaReady) return ctx;
      } catch (e: any) {
        safeLogger.warn('Business context fetch attempt failed, retrying...', { error: e?.message });
      }
      await sleep(1500);
    }
    return lastContext;
  };

  const sendToWebhook = useCallback(async (userMessage: string): Promise<string> => {
    try {
      // Use validated user data (already checked above)
      const studentId = user.id;
      const studentName = user.full_name || user.email.split('@')[0] || 'Student';

      // Detect if we need business context
      const requestedFlags = detectBusinessContext(userMessage);
      // Only fetch data when user query requires it AND integration is connected
      const flags = {
        includeShopify: requestedFlags.includeShopify && integrationStatus.shopify,
        includeMetaAds: requestedFlags.includeMetaAds && integrationStatus.metaAds
      };
      const needsContext = flags.includeShopify || flags.includeMetaAds;
      let businessContext = null;
      if (needsContext) {
        setIsFetchingContext(true);
        const description = getContextDescription(flags);
        setContextDescription(description);
        try {
          // Ensure both Shopify and Meta Ads are ready before proceeding
          businessContext = await fetchContextUntilReady(studentId, flags);

          // Check for disconnected integrations and add UI notifications
          if (businessContext) {
            const disconnectedServices: string[] = [];
            if (businessContext.shopify?.connected === false) {
              disconnectedServices.push('Shopify');
            }
            if (businessContext.metaAds?.connected === false) {
              disconnectedServices.push('Meta Ads');
            }
            if (disconnectedServices.length > 0) {
              setMessages(prev => [...prev, {
                id: Date.now(),
                sender: "ai",
                content: `⚠️ ${disconnectedServices.join(' and ')} not connected. Connect them in Settings → Integrations to get personalized insights.`,
                timestamp: new Date()
              }]);
            }
          }
        } catch (error) {
          console.error("Error fetching business context:", error);

          // Add user-facing error message
          setMessages(prev => [...prev, {
            id: Date.now(),
            sender: "ai",
            content: "⚠️ I'm having trouble fetching your business data right now. I'll continue without those metrics, but you may want to check your integrations.",
            timestamp: new Date()
          }]);
        } finally {
          setIsFetchingContext(false);
          setContextDescription("");
        }
      }

      // Ensure we send when both contexts are ready
      const finalBusinessContext = businessContext || {};

      // Observability: log what we're sending to webhook
      safeLogger.info('Success Partner: Business context prepared', {
        requestedFlags: flags,
        contextKeys: Object.keys(finalBusinessContext),
        shopifyConnected: finalBusinessContext.shopify?.connected,
        metaAdsConnected: finalBusinessContext.metaAds?.connected,
        metaAdsCampaigns: finalBusinessContext.metaAds?.metrics?.campaigns?.length ?? 0,
        metaAdsAdSets: finalBusinessContext.metaAds?.metrics?.adSets?.length ?? 0,
        metaAdsAds: finalBusinessContext.metaAds?.metrics?.ads?.length ?? 0
      });
      const payload = {
        message: userMessage,
        studentId: studentId,
        studentName: studentName,
        timestamp: new Date().toISOString(),
        conversationHistory: getHistory(),
        businessContext: finalBusinessContext
      };
      safeLogger.info('Success Partner: Sending message', {
        studentId,
        studentName,
        messageLength: userMessage.length,
        hasBusinessContext: !!businessContext
      });
      const response = await fetch(ENV_CONFIG.SUCCESS_PARTNER_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (process.env.NODE_ENV === 'development') {
        safeLogger.info('Success Partner: Webhook response received', {
          data,
          type: typeof data
        });
      }

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
      if (process.env.NODE_ENV === 'development') {
        safeLogger.info('Success Partner: Final processed response', {
          aiResponse,
          length: aiResponse.length
        });
      }
      return aiResponse;
    } catch (error) {
      console.error('Webhook error:', error);

      // Add user-facing error message for webhook failures
      setMessages(prev => [...prev, {
        id: Date.now(),
        sender: "ai",
        content: "⚠️ I'm having trouble connecting to my services right now. Please try again in a moment.",
        timestamp: new Date()
      }]);
      throw error;
    }
  }, [user, integrationStatus, getHistory]);
  const handleSendMessage = useCallback(async () => {
    if (!message.trim() || isLoading) {
      if (process.env.NODE_ENV === 'development') {
        safeLogger.warn('Success Partner: Message sending blocked', {
          messageEmpty: !message.trim(),
          isLoading
        });
      }
      return;
    }

    // Check if user has remaining credits
    if (credits && !credits.can_send_message) {
      toast({
        title: "Daily Limit Reached",
        description: `You've used all ${credits.daily_limit} credits for today. Credits reset at midnight UTC.`,
        variant: "destructive"
      });
      return;
    }

    // Validate integration requirements BEFORE sending - only block SPECIFIC service mentions
    const lowerMessage = message.toLowerCase();

    // Specific Shopify keywords (not general business terms)
    const shopifyKeywords = ['shopify', 'store', 'product', 'inventory', 'order'];
    const hasShopifyKeyword = shopifyKeywords.some(keyword => lowerMessage.includes(keyword));
    if (hasShopifyKeyword && !integrationStatus.shopify) {
      toast({
        title: "Shopify Not Connected",
        description: "To analyze your Shopify data, please connect your account first in Settings → Integrations",
        variant: "destructive"
      });
      return;
    }

    // Specific Meta Ads keywords (not general business terms)
    const metaKeywords = ['meta', 'facebook', 'instagram', 'ads', 'campaign', 'roas', 'cpc', 'ctr'];
    const hasMetaKeyword = metaKeywords.some(keyword => lowerMessage.includes(keyword));
    if (hasMetaKeyword && !integrationStatus.metaAds) {
      toast({
        title: "Meta Ads Not Connected",
        description: "To analyze your ad performance, please connect your Meta Ads account first in Settings → Integrations",
        variant: "destructive"
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

    // Add user message to conversation history
    addMessage('user', userMessage.content);
    try {
      const aiReply = await sendToWebhook(userMessage.content);

      // Update credits after successful AI response
      await updateCredits();

      // Add AI response to conversation history
      addMessage('assistant', aiReply);

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
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [message, isLoading, sendToWebhook, updateCredits, credits, integrationStatus, toast]);
  return <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
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
              {/* Conversation History Display */}
              
              
              {/* Credits Display */}
              {loadingCredits ? <Badge variant="outline" className="flex items-center space-x-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Loading...</span>
                </Badge> : credits ? <Badge variant={credits.credits_remaining <= 2 ? "destructive" : credits.credits_remaining <= 5 ? "secondary" : "outline"} className="flex items-center space-x-1">
                  <MessageSquare className="w-3 h-3" />
                  <span>{credits.credits_remaining}/{credits.daily_limit}</span>
                </Badge> : null}
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          {/* Integration Warning Banner */}
          {!integrationStatus.loading && (!integrationStatus.shopify || !integrationStatus.metaAds) && <div className="mt-3 p-3 bg-amber-50 border-l-4 border-amber-400 rounded">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <p className="text-sm text-amber-800 font-medium">
                    {!integrationStatus.shopify && !integrationStatus.metaAds ? "Connect Shopify and Meta Ads to unlock business insights" : !integrationStatus.shopify ? "Connect Shopify to analyze your store performance" : "Connect Meta Ads to analyze your ad campaigns"}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => window.location.href = '/connect'} className="text-xs shrink-0">
                  Go to Integrations
                </Button>
              </div>
            </div>}
          
          {/* Credits Warning */}
          {credits && credits.credits_remaining <= 2 && credits.credits_remaining > 0 && <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
              <div className="flex items-center space-x-2 text-sm text-yellow-800">
                <Clock className="w-4 h-4" />
                <span>Only {credits.credits_remaining} credits remaining today. Resets at midnight UTC.</span>
              </div>
            </div>}
          
          {/* No Credits Left */}
          {credits && credits.credits_remaining === 0 && <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-center space-x-2 text-sm text-red-800">
                <Clock className="w-4 h-4" />
                <span>Daily limit reached. Your {credits.daily_limit} credits will reset at midnight UTC.</span>
              </div>
            </div>}
        </CardHeader>

        {/* Context Fetching Indicator */}
        {isFetchingContext && contextDescription && <div className="mx-4 mb-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center space-x-2 text-sm text-blue-800">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{contextDescription}</span>
            </div>
          </div>}

        {/* Messages */}
        <CardContent className="flex-1 overflow-y-auto space-y-4">
          {messages.map(msg => <div key={msg.id} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] p-3 rounded-lg ${msg.sender === "user" ? "bg-primary text-primary-foreground" : msg.sender === "loading" ? "bg-muted text-muted-foreground animate-pulse" : "bg-muted/50 text-foreground italic"}`}>
                {msg.sender === "loading" && <div className="flex items-center space-x-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span className="text-sm">AI Assistant is thinking...</span>
                  </div>}
                {msg.sender !== "loading" && <>
                    {msg.sender === "ai" && <p className="text-xs font-medium mb-1 opacity-70">AI Assistant</p>}
                    <div className="text-sm prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground">
                      <ReactMarkdown
                        components={{
                          h3: ({node, ...props}) => <h3 className="text-base font-bold mt-3 mb-2" {...props} />,
                          h4: ({node, ...props}) => <h4 className="text-sm font-semibold mt-2 mb-1" {...props} />,
                          p: ({node, ...props}) => <p className="mb-2 leading-relaxed" {...props} />,
                          ul: ({node, ...props}) => <ul className="list-disc ml-4 mb-2 space-y-1" {...props} />,
                          ol: ({node, ...props}) => <ol className="list-decimal ml-4 mb-2 space-y-1" {...props} />,
                          li: ({node, ...props}) => <li className="leading-relaxed" {...props} />,
                          strong: ({node, ...props}) => <strong className="font-semibold" {...props} />,
                          code: ({node, ...props}) => <code className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded text-xs" {...props} />,
                        }}
                      >
                        {typeof msg.content === 'string' ? msg.content : String(msg.content)}
                      </ReactMarkdown>
                    </div>
                    <p className="text-xs opacity-70 mt-1">
                      {msg.timestamp.toLocaleTimeString()}
                    </p>
                  </>}
              </div>
            </div>)}
        </CardContent>

        {/* Input */}
        <div className="flex-shrink-0 p-4 border-t">
          <div className="flex space-x-2">
            <Input placeholder="Ask about videos, assignments, or course content..." value={message} onChange={e => setMessage(e.target.value)} onKeyPress={e => e.key === "Enter" && handleSendMessage()} disabled={isLoading || credits && !credits.can_send_message} />
            <Button onClick={handleSendMessage} disabled={isLoading || credits && !credits.can_send_message}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          
          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="outline" className={`cursor-pointer hover:bg-gray-100 ${!integrationStatus.shopify || credits && !credits.can_send_message ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={() => {
            if (integrationStatus.shopify && credits && credits.can_send_message) {
              setMessage("Study my Shopify sales");
            } else if (!integrationStatus.shopify) {
              toast({
                title: "Shopify Not Connected",
                description: "Please connect your Shopify account first in Settings → Integrations",
                variant: "destructive"
              });
            }
          }} title={!integrationStatus.shopify ? "Connect Shopify first" : ""}>
              <TrendingUp className="w-3 h-3 mr-1" />
              Analyze Shopify
            </Badge>
            <Badge variant="outline" className={`cursor-pointer hover:bg-gray-100 ${!integrationStatus.metaAds || credits && !credits.can_send_message ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={() => {
            if (integrationStatus.metaAds && credits && credits.can_send_message) {
              setMessage("Review my ad performance");
            } else if (!integrationStatus.metaAds) {
              toast({
                title: "Meta Ads Not Connected",
                description: "Please connect your Meta Ads account first in Settings → Integrations",
                variant: "destructive"
              });
            }
          }} title={!integrationStatus.metaAds ? "Connect Meta Ads first" : ""}>
              <BarChart3 className="w-3 h-3 mr-1" />
              Review Ads
            </Badge>
            <Badge variant="outline" className={`cursor-pointer hover:bg-gray-100 ${credits && !credits.can_send_message ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={() => credits && credits.can_send_message && setMessage("I'm stuck on the current assignment")}>
              Assignment Help
            </Badge>
            <Badge variant="outline" className={`cursor-pointer hover:bg-gray-100 ${credits && !credits.can_send_message ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={() => credits && credits.can_send_message && setMessage("I'm feeling demotivated")}>
              Need Motivation
            </Badge>
          </div>
        </div>
      </Card>
    </div>;
};
export default SuccessPartner;