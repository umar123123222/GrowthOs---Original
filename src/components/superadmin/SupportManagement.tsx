import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquare, AlertCircle, Clock, CheckCircle, Reply, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SupportTicket {
  id: string;
  user_id: string;
  title: string;
  description: string;
  type: 'complaint' | 'feedback' | 'technical' | 'billing';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  created_at: string;
  updated_at: string;
  assigned_to?: string;
  users: {
    full_name: string;
    email: string;
    student_id?: string;
  };
  replies?: TicketReply[];
}

interface TicketReply {
  id: string;
  ticket_id: string;
  user_id: string;
  message: string;
  is_staff: boolean;
  created_at: string;
  users: {
    full_name: string;
    role: string;
  };
}

export function SupportManagement() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const { toast } = useToast();

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      // Note: This would require creating support_tickets table
      // For now, we'll show a mock implementation
      const mockTickets: SupportTicket[] = [
        {
          id: '1',
          user_id: 'user1',
          title: 'Unable to access course videos',
          description: 'I am having trouble accessing the course videos. The player keeps loading but never starts.',
          type: 'technical',
          priority: 'high',
          status: 'open',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          users: {
            full_name: 'John Doe',
            email: 'john@example.com',
            student_id: 'STU001'
          }
        },
        {
          id: '2',
          user_id: 'user2',
          title: 'Billing inquiry about installments',
          description: 'I need clarification about my payment installments schedule.',
          type: 'billing',
          priority: 'medium',
          status: 'in_progress',
          created_at: new Date(Date.now() - 86400000).toISOString(),
          updated_at: new Date().toISOString(),
          users: {
            full_name: 'Jane Smith',
            email: 'jane@example.com',
            student_id: 'STU002'
          }
        }
      ];
      
      setTickets(mockTickets);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch support tickets',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReplyToTicket = async (ticketId: string) => {
    if (!replyMessage.trim()) return;

    try {
      // Mock implementation - would need to create ticket_replies table
      toast({
        title: 'Success',
        description: 'Reply sent successfully'
      });
      setReplyMessage('');
      setSelectedTicket(null);
      fetchTickets();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send reply',
        variant: 'destructive'
      });
    }
  };

  const updateTicketStatus = async (ticketId: string, status: string) => {
    try {
      // Mock implementation
      toast({
        title: 'Success',
        description: 'Ticket status updated successfully'
      });
      fetchTickets();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update ticket status',
        variant: 'destructive'
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-red-100 text-red-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'complaint': return <AlertCircle className="w-4 h-4" />;
      case 'feedback': return <MessageSquare className="w-4 h-4" />;
      case 'technical': return <Clock className="w-4 h-4" />;
      case 'billing': return <User className="w-4 h-4" />;
      default: return <MessageSquare className="w-4 h-4" />;
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    const statusMatch = filterStatus === 'all' || ticket.status === filterStatus;
    const typeMatch = filterType === 'all' || ticket.type === filterType;
    return statusMatch && typeMatch;
  });

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading support tickets...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Support Management</h1>
          <p className="text-muted-foreground">Manage student support tickets and complaints</p>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="complaint">Complaint</SelectItem>
            <SelectItem value="feedback">Feedback</SelectItem>
            <SelectItem value="technical">Technical</SelectItem>
            <SelectItem value="billing">Billing</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Support Tickets</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTickets.map((ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{ticket.users.full_name}</div>
                      <div className="text-sm text-muted-foreground">{ticket.users.student_id}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{ticket.title}</div>
                    <div className="text-sm text-muted-foreground truncate max-w-xs">
                      {ticket.description}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getTypeIcon(ticket.type)}
                      <span className="capitalize">{ticket.type}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getPriorityColor(ticket.priority)}>
                      {ticket.priority.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(ticket.status)}>
                      {ticket.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(ticket.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedTicket(ticket)}
                        >
                          <Reply className="w-4 h-4 mr-2" />
                          View & Reply
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Support Ticket Details</DialogTitle>
                        </DialogHeader>
                        {selectedTicket && (
                          <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <h3 className="font-semibold">Student Information</h3>
                                <p>{selectedTicket.users.full_name}</p>
                                <p className="text-sm text-muted-foreground">{selectedTicket.users.email}</p>
                                <p className="text-sm text-muted-foreground">{selectedTicket.users.student_id}</p>
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold">Type:</span>
                                  <Badge variant="outline">{selectedTicket.type}</Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold">Priority:</span>
                                  <Badge className={getPriorityColor(selectedTicket.priority)}>
                                    {selectedTicket.priority}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold">Status:</span>
                                  <Badge className={getStatusColor(selectedTicket.status)}>
                                    {selectedTicket.status.replace('_', ' ')}
                                  </Badge>
                                </div>
                              </div>
                            </div>

                            <div>
                              <h3 className="font-semibold mb-2">Issue Description</h3>
                              <div className="p-4 bg-gray-50 rounded-lg">
                                <h4 className="font-medium mb-2">{selectedTicket.title}</h4>
                                <p className="whitespace-pre-wrap">{selectedTicket.description}</p>
                                <p className="text-xs text-muted-foreground mt-2">
                                  Created: {new Date(selectedTicket.created_at).toLocaleString()}
                                </p>
                              </div>
                            </div>

                            <div className="space-y-4">
                              <h3 className="font-semibold">Update Status</h3>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  onClick={() => updateTicketStatus(selectedTicket.id, 'in_progress')}
                                >
                                  Mark In Progress
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => updateTicketStatus(selectedTicket.id, 'resolved')}
                                >
                                  Mark Resolved
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => updateTicketStatus(selectedTicket.id, 'closed')}
                                >
                                  Close Ticket
                                </Button>
                              </div>
                            </div>

                            <div className="space-y-4">
                              <h3 className="font-semibold">Reply to Student</h3>
                              <Textarea
                                value={replyMessage}
                                onChange={(e) => setReplyMessage(e.target.value)}
                                placeholder="Type your reply here..."
                                rows={4}
                              />
                              <Button
                                onClick={() => handleReplyToTicket(selectedTicket.id)}
                                disabled={!replyMessage.trim()}
                              >
                                <Reply className="w-4 h-4 mr-2" />
                                Send Reply
                              </Button>
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}