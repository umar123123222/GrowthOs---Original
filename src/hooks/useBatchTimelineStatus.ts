import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type SessionState = 'upcoming' | 'join_now' | 'watch_now' | 'recording_pending';

export interface TimelineStatusItem {
  item_id: string;
  item_type: 'RECORDING' | 'LIVE_SESSION';
  title: string;
  description: string | null;
  drip_offset_days: number;
  sequence_order: number;
  is_deployed: boolean;
  deployed_date: string;
  is_unlocked: boolean;
  unlock_reason: string | null;
  // Recording specific
  recording_id: string | null;
  recording_url: string | null;
  duration_min: number | null;
  recording_watched: boolean;
  assignment_id: string | null;
  assignment_required: boolean;
  assignment_status: string | null;
  // Live session specific
  start_datetime: string | null;
  end_datetime: string | null;
  meeting_link: string | null;
  session_recording_url: string | null;
  session_status: string | null;
  session_state: SessionState | null;
}

export function useBatchTimelineStatus(batchId: string | null) {
  const [timelineStatus, setTimelineStatus] = useState<TimelineStatusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchTimelineStatus = useCallback(async () => {
    if (!batchId) {
      setTimelineStatus([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user?.id) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .rpc('get_batch_timeline_status', {
          p_user_id: userData.user.id,
          p_batch_id: batchId
        });

      if (error) throw error;

      setTimelineStatus((data || []) as TimelineStatusItem[]);
    } catch (error) {
      console.error('Error fetching timeline status:', error);
      toast({
        title: "Error",
        description: "Failed to fetch timeline status",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [batchId, toast]);

  const getSessionState = (item: TimelineStatusItem): SessionState => {
    if (item.session_state) {
      return item.session_state;
    }
    
    // Fallback calculation
    if (!item.start_datetime) return 'upcoming';
    
    const now = new Date();
    const start = new Date(item.start_datetime);
    const end = item.end_datetime ? new Date(item.end_datetime) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const twoHoursBefore = new Date(start.getTime() - 2 * 60 * 60 * 1000);
    
    if (now < twoHoursBefore) return 'upcoming';
    if (now >= twoHoursBefore && now <= end) return 'join_now';
    if (now > end && item.session_recording_url) return 'watch_now';
    return 'recording_pending';
  };

  useEffect(() => {
    fetchTimelineStatus();
  }, [fetchTimelineStatus]);

  // Set up real-time listener for changes
  useEffect(() => {
    if (!batchId) return;

    const channel = supabase
      .channel(`batch_timeline_${batchId}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'batch_timeline_items', filter: `batch_id=eq.${batchId}` },
        () => fetchTimelineStatus()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'submissions' },
        () => fetchTimelineStatus()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'recording_views' },
        () => fetchTimelineStatus()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [batchId, fetchTimelineStatus]);

  return {
    timelineStatus,
    loading,
    fetchTimelineStatus,
    getSessionState
  };
}
