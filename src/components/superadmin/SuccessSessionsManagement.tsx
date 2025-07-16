import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Video, User, Link as LinkIcon, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface SuccessSession {
  id: string;
  title: string;
  description: string;
  mentor_name: string;
  schedule_date: string;
  start_time: string;
  end_time: string;
  link: string;
  status: string;
  created_at: string;
  created_by: string;
}

export function SuccessSessionsManagement() {
  const [sessions, setSessions] = useState<SuccessSession[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('success_sessions')
        .select('*')
        .order('start_time', { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch success sessions",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'upcoming':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return 'Invalid date';
    }
  };

  const formatTime = (timeString: string) => {
    try {
      return format(new Date(timeString), 'h:mm a');
    } catch {
      return 'Invalid time';
    }
  };

  const getDayOfWeek = (dateString: string) => {
    try {
      return format(new Date(dateString), 'EEEE');
    } catch {
      return 'Invalid day';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading success sessions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center">
        <div className="animate-fade-in">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-orange-600 bg-clip-text text-transparent">
            Success Sessions Management
          </h2>
          <p className="text-muted-foreground mt-1 text-lg">Manage scheduled success sessions and their status</p>
        </div>
        
        <Button 
          onClick={() => {
            // TODO: Add create session functionality
            toast({
              title: "Coming Soon",
              description: "Create session functionality will be added soon",
            });
          }}
          className="hover-scale bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
        >
          <Plus className="w-4 h-4 mr-2" />
          Schedule Session
        </Button>
      </div>

      <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50 animate-fade-in">
        <CardHeader className="bg-gradient-to-r from-orange-50 to-red-50 border-b">
          <CardTitle className="flex items-center text-xl">
            <Video className="w-6 h-6 mr-3 text-orange-600" />
            All Success Sessions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {sessions.length === 0 ? (
            <div className="text-center py-16 animate-fade-in">
              <Video className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-muted-foreground mb-2">No sessions found</h3>
              <p className="text-muted-foreground">Schedule your first success session to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold">Session Title</TableHead>
                  <TableHead className="font-semibold">Host</TableHead>
                  <TableHead className="font-semibold">Schedule Date</TableHead>
                  <TableHead className="font-semibold">Day</TableHead>
                  <TableHead className="font-semibold">Time</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session, index) => (
                  <TableRow 
                    key={session.id} 
                    className="hover:bg-gray-50 transition-colors animate-fade-in"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <TableCell className="font-medium">
                      <div>
                        <div className="font-semibold">{session.title}</div>
                        {session.description && (
                          <div className="text-sm text-muted-foreground mt-1 max-w-xs truncate" title={session.description}>
                            {session.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <User className="w-4 h-4 mr-2 text-gray-500" />
                        <span className="font-medium">{session.mentor_name || 'TBD'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-2 text-gray-500" />
                        <span>{formatDate(session.schedule_date)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700">
                        {getDayOfWeek(session.schedule_date)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-2 text-gray-500" />
                        <span>{formatTime(session.start_time)}</span>
                        {session.end_time && (
                          <span className="text-gray-400 ml-1">- {formatTime(session.end_time)}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="secondary"
                        className={`${getStatusColor(session.status)} capitalize`}
                      >
                        {session.status || 'Unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (session.link) {
                              window.open(session.link, '_blank');
                            } else {
                              toast({
                                title: "No Link",
                                description: "No session link available",
                                variant: "destructive"
                              });
                            }
                          }}
                          className="hover-scale hover:bg-blue-50 hover:border-blue-300"
                          disabled={!session.link}
                        >
                          <LinkIcon className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}