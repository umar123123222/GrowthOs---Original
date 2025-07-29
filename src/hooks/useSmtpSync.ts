import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useSmtpSync = () => {
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  const syncToSupabase = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-smtp-config');

      if (error) {
        throw error;
      }

      if (data?.success) {
        toast({
          title: 'Success',
          description: 'SMTP configuration synced with Supabase successfully'
        });
        return { success: true, data };
      } else {
        throw new Error(data?.error || 'Failed to sync SMTP configuration');
      }
    } catch (error: any) {
      console.error('Error syncing SMTP config:', error);
      toast({
        title: 'Error', 
        description: error.message || 'Failed to sync SMTP configuration with Supabase',
        variant: 'destructive'
      });
      return { success: false, error: error.message };
    } finally {
      setSyncing(false);
    }
  };

  return {
    syncToSupabase,
    syncing
  };
};