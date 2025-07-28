import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Bell, Check, Eye, EyeOff, AlertCircle, Info, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

interface Notification {
  id: string;
  type: string;
  status: string;
  payload: any;
  sent_at: string;
  channel: string;
  error_message?: string;
}

const NotificationDropdown = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch last 5 unread notifications
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'sent')
        .order('sent_at', { ascending: false })
        .limit(5);

      if (error) throw error;

      setNotifications(data || []);
      setUnreadCount(data?.length || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleNotificationStatus = async (notificationId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'sent' ? 'read' : 'sent';
      
      const { error } = await supabase
        .from('notifications')
        .update({ status: newStatus })
        .eq('id', notificationId);

      if (error) throw error;

      // Update local state
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId 
            ? { ...notif, status: newStatus }
            : notif
        ).filter(notif => notif.status === 'sent') // Keep only unread in dropdown
      );

      // Update unread count
      if (newStatus === 'read') {
        setUnreadCount(prev => Math.max(0, prev - 1));
      } else {
        setUnreadCount(prev => prev + 1);
      }

      toast({
        title: newStatus === 'read' ? "Marked as read" : "Marked as unread",
        description: `Notification ${newStatus === 'read' ? 'marked as read' : 'marked as unread'}`,
      });
    } catch (error) {
      console.error('Error updating notification status:', error);
      toast({
        title: "Error",
        description: "Failed to update notification status",
        variant: "destructive",
      });
    }
  };

  const getNotificationIcon = (type: string, status: string) => {
    if (status === 'error') return <AlertCircle className="h-4 w-4 text-red-500" />;
    
    switch (type) {
      case 'assignment_submission':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'success_session':
        return <Clock className="h-4 w-4 text-purple-500" />;
      case 'student_progress':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'assignment':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'achievement':
        return <Check className="h-4 w-4 text-green-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Notifications</h4>
            <Link to="/notifications">
              <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700">
                View all
              </Button>
            </Link>
          </div>
        </div>
        
        <ScrollArea className="max-h-96">
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <Bell className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No unread notifications</p>
            </div>
          ) : (
            <div className="p-2">
              {notifications.map((notification, index) => (
                <div key={notification.id}>
                  <div className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg group">
                    <div className="flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notification.type, notification.status)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {notification.payload?.title || `${notification.type} notification`}
                      </p>
                      <p className="text-xs text-gray-500 truncate mt-1">
                        {notification.payload?.message || notification.payload?.description || 'No message content'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDate(notification.sent_at)}
                      </p>
                    </div>
                    
                    <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleNotificationStatus(notification.id, notification.status)}
                        className="h-8 w-8 p-0"
                      >
                        {notification.status === 'sent' ? (
                          <EyeOff className="h-3 w-3" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  {index < notifications.length - 1 && <Separator className="my-1" />}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        
        {notifications.length > 0 && (
          <>
            <Separator />
            <div className="p-3">
              <Link to="/notifications">
                <Button variant="ghost" className="w-full text-sm">
                  View all notifications
                </Button>
              </Link>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default NotificationDropdown;