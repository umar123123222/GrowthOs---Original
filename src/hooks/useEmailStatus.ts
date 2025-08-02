import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EmailStatus {
  id: string;
  email_type: string;
  recipient_email: string;
  recipient_name: string;
  status: string;
  retry_count: number;
  error_message?: string;
  sent_at?: string;
  created_at: string;
}

export const useEmailStatus = (userId?: string) => {
  const [emailStatuses, setEmailStatuses] = useState<EmailStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchEmailStatuses = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('email_queue')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEmailStatuses(data || []);
    } catch (error: any) {
      console.error('Error fetching email statuses:', error);
      toast({
        title: "Error",
        description: "Failed to load email status",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const retryFailedEmails = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('email_queue')
        .update({ 
          status: 'pending', 
          retry_count: 0,
          error_message: null,
          scheduled_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('status', 'failed');

      if (error) throw error;

      toast({
        title: "Success",
        description: "Failed emails have been queued for retry"
      });

      // Trigger email processing
      await supabase.functions.invoke('process-email-queue');
      
      fetchEmailStatuses();
    } catch (error: any) {
      console.error('Error retrying emails:', error);
      toast({
        title: "Error",
        description: "Failed to retry emails",
        variant: "destructive"
      });
    }
  };

  const triggerEmailProcessing = async () => {
    try {
      const response = await supabase.functions.invoke('process-email-queue');
      
      if (response.error) {
        throw response.error;
      }

      toast({
        title: "Success",
        description: "Email processing has been triggered"
      });

      // Refresh status after a short delay
      setTimeout(fetchEmailStatuses, 2000);
    } catch (error: any) {
      console.error('Error triggering email processing:', error);
      toast({
        title: "Warning",
        description: "Email processing may have failed - please check manually",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    if (userId) {
      fetchEmailStatuses();
    }
  }, [userId]);

  // Set up real-time subscription for email status updates
  useEffect(() => {
    if (!userId) return;

    const subscription = supabase
      .channel('email_queue_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'email_queue',
          filter: `user_id=eq.${userId}`
        },
        () => {
          fetchEmailStatuses();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [userId]);

  return {
    emailStatuses,
    loading,
    retryFailedEmails,
    triggerEmailProcessing,
    refreshStatuses: fetchEmailStatuses
  };
};