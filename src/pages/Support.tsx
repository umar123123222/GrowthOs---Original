import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { RoleGuard } from "@/components/RoleGuard";
import { 
  MessageSquare, 
  Plus, 
  Calendar,
  User,
  MessageCircle,
  AlertCircle,
  CheckCircle
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

interface SupportTicket {
  id: string;
  title: string;
  description: string;
  category?: string | null;
  status: string;
  priority: string;
  user_id: string;
  assigned_to?: string | null;
  created_at: string;
  updated_at: string;
}

interface TicketReply {
  id: string;
  message: string;
  is_internal: boolean;
  created_at: string;
  user_id: string;
}

interface TicketWithReplies extends SupportTicket {
  replies?: TicketReply[];
}

const Support = () => {
  const [tickets, setTickets] = useState<TicketWithReplies[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<TicketWithReplies | null>(null);
  const [newReply, setNewReply] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();

  // Form state for creating tickets
  const [newTicket, setNewTicket] = useState({
    title: "",
    description: "",
    type: "complaint",
    priority: "medium"
  });

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch replies for each ticket
      const ticketsWithReplies = await Promise.all(
        (data || []).map(async (ticket) => {
          const { data: replies, error: repliesError } = await supabase
            .from('support_ticket_replies')
            .select('*')
            .eq('ticket_id', ticket.id)
            .order('created_at', { ascending: true });

          if (repliesError) {
            console.error('Error fetching replies:', repliesError);
          }

          return {
            ...ticket,
            replies: replies || []
          };
        })
      );

      setTickets(ticketsWithReplies);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      toast({
        title: "Error",
        description: "Failed to load support tickets",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createTicket = async () => {
    try {
      if (!newTicket.title || !newTicket.description) {
        toast({
          title: "Error",
          description: "Please fill in all required fields",
          variant: "destructive",
        });
        return;
      }

      if (!user?.id) {
        toast({
          title: "Error",
          description: "You must be logged in to create a ticket",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('support_tickets')
        .insert({
          title: newTicket.title,
          description: newTicket.description,
          category: newTicket.type,
          priority: newTicket.priority,
          user_id: user.id
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Support ticket created successfully",
      });

      setNewTicket({ title: "", description: "", type: "complaint", priority: "medium" });
      setCreateDialogOpen(false);
      fetchTickets();
    } catch (error) {
      console.error('Error creating ticket:', error);
      toast({
        title: "Error",
        description: "Failed to create support ticket",
        variant: "destructive",
      });
    }
  };

  const addReply = async (ticketId: string) => {
    try {
      if (!newReply.trim()) return;

      if (!user?.id) {
        toast({
          title: "Error",
          description: "You must be logged in to add a reply",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('support_ticket_replies')
        .insert({
          ticket_id: ticketId,
          message: newReply,
          is_internal: false,
          user_id: user.id
        });

      if (error) throw error;

      setNewReply("");
      fetchTickets();
      
      toast({
        title: "Success",
        description: "Reply added successfully",
      });
    } catch (error) {
      console.error('Error adding reply:', error);
      toast({
        title: "Error",
        description: "Failed to add reply",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low': return 'bg-gray-100 text-gray-800';
      case 'medium': return 'bg-blue-100 text-blue-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'urgent': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <RoleGuard allowedRoles={['student', 'admin', 'mentor', 'superadmin']}>
      <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Support Center</h1>
          <p className="text-muted-foreground text-lg">
            Get help with your questions and concerns
          </p>
        </div>
        
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Ticket
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Support Ticket</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Title</label>
                <Input
                  value={newTicket.title}
                  onChange={(e) => setNewTicket({ ...newTicket, title: e.target.value })}
                  placeholder="Brief description of your issue"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Type</label>
                <Select 
                  value={newTicket.type} 
                  onValueChange={(value) => setNewTicket({ ...newTicket, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="complaint">Complaint</SelectItem>
                    <SelectItem value="feedback">Feedback</SelectItem>
                    <SelectItem value="technical">Technical Issue</SelectItem>
                    <SelectItem value="billing">Billing</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Priority</label>
                <Select 
                  value={newTicket.priority} 
                  onValueChange={(value) => setNewTicket({ ...newTicket, priority: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Description</label>
                <Textarea
                  value={newTicket.description}
                  onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                  placeholder="Please provide detailed information about your issue"
                  rows={4}
                />
              </div>
              
              <Button onClick={createTicket} className="w-full">
                Create Ticket
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {tickets.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">No Support Tickets</h3>
            <p className="text-muted-foreground mb-4">
              You haven't created any support tickets yet
            </p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Ticket
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {tickets.map((ticket) => (
            <Card key={ticket.id} className="group hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <CardTitle className="text-xl group-hover:text-primary transition-colors">
                      {ticket.title}
                    </CardTitle>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={getStatusColor(ticket.status)}>
                        {ticket.status.replace('_', ' ')}
                      </Badge>
                      <Badge variant="outline" className={getPriorityColor(ticket.priority)}>
                        {ticket.priority}
                      </Badge>
                       <Badge variant="outline">
                         {ticket.category || 'General'}
                       </Badge>
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {new Date(ticket.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <p className="text-muted-foreground leading-relaxed">
                  {ticket.description}
                </p>
                
                {ticket.replies && ticket.replies.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <h4 className="font-medium flex items-center gap-2">
                        <MessageCircle className="w-4 h-4" />
                        Conversation ({ticket.replies.length} {ticket.replies.length === 1 ? 'reply' : 'replies'})
                      </h4>
                      
                      <div className="space-y-3">
                        {ticket.replies.map((reply) => (
                          <div
                            key={reply.id}
                            className={`p-3 rounded-lg ${
                              reply.is_internal 
                                ? 'bg-blue-50 border-l-4 border-l-blue-500' 
                                : 'bg-gray-50 border-l-4 border-l-gray-300'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <User className="w-3 h-3" />
                                <span className="text-sm font-medium">
                                  {reply.is_internal ? 'Support Team' : 'You'}
                                </span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {new Date(reply.created_at).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-sm leading-relaxed">{reply.message}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                
                {ticket.status !== 'closed' && ticket.status !== 'resolved' && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <label className="text-sm font-medium">Add a reply</label>
                      <Textarea
                        value={newReply}
                        onChange={(e) => setNewReply(e.target.value)}
                        placeholder="Type your reply here..."
                        rows={3}
                      />
                      <Button 
                        onClick={() => addReply(ticket.id)}
                        disabled={!newReply.trim()}
                        size="sm"
                      >
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Send Reply
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      </div>
    </RoleGuard>
  );
};

export default Support;