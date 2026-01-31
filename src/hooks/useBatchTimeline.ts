import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type TimelineItemType = 'RECORDING' | 'LIVE_SESSION';

export interface TimelineItem {
  id: string;
  batch_id: string;
  course_id: string | null;
  type: TimelineItemType;
  title: string;
  description: string | null;
  drip_offset_days: number;
  sequence_order: number;
  // Recording fields
  recording_id: string | null;
  // Live session fields
  start_datetime: string | null;
  end_datetime: string | null;
  meeting_link: string | null;
  zoom_username: string | null;
  zoom_password: string | null;
  recording_url: string | null;
  session_status: 'scheduled' | 'live' | 'completed' | 'cancelled';
  // Assignment gating
  assignment_id: string | null;
  // Tracking
  reminder_24h_sent_at: string | null;
  reminder_1h_sent_at: string | null;
  reminder_start_sent_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  recording?: {
    id: string;
    recording_title: string;
    recording_url: string;
    duration_min: number | null;
  } | null;
  assignment?: {
    id: string;
    name: string;
  } | null;
}

export interface TimelineItemFormData {
  type: TimelineItemType;
  title: string;
  description?: string;
  drip_offset_days: number;
  sequence_order: number;
  // Recording fields
  recording_id?: string;
  // Live session fields
  start_datetime?: string;
  end_datetime?: string;
  meeting_link?: string;
  zoom_username?: string;
  zoom_password?: string;
  recording_url?: string;
  // Assignment
  assignment_id?: string;
}

export function useBatchTimeline(batchId: string | null) {
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchTimeline = useCallback(async () => {
    if (!batchId) {
      setTimelineItems([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('batch_timeline_items')
        .select(`
          *,
          recording:available_lessons(id, recording_title, recording_url, duration_min),
          assignment:assignments(id, name)
        `)
        .eq('batch_id', batchId)
        .order('drip_offset_days', { ascending: true })
        .order('sequence_order', { ascending: true });

      if (error) throw error;

      setTimelineItems((data || []) as TimelineItem[]);
    } catch (error) {
      console.error('Error fetching timeline:', error);
      toast({
        title: "Error",
        description: "Failed to fetch timeline items",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [batchId, toast]);

  const triggerNotification = async (
    batchId: string,
    itemType: TimelineItemType,
    itemId: string,
    title: string,
    description?: string,
    meetingLink?: string,
    startDatetime?: string,
    timelineItemId?: string
  ) => {
    try {
      const { error } = await supabase.functions.invoke('send-batch-content-notification', {
        body: {
          batch_id: batchId,
          item_type: itemType,
          item_id: itemId,
          title,
          description,
          meeting_link: meetingLink,
          start_datetime: startDatetime,
          timeline_item_id: timelineItemId,
        },
      });

      if (error) {
        console.error('Error triggering notification:', error);
      } else {
        console.log('Notification triggered successfully');
      }
    } catch (error) {
      console.error('Error calling notification function:', error);
    }
  };

  const createTimelineItem = async (formData: TimelineItemFormData) => {
    if (!batchId) return null;

    try {
      const { data: userData } = await supabase.auth.getUser();

      // Get batch's course_id
      const { data: batch } = await supabase
        .from('batches')
        .select('course_id')
        .eq('id', batchId)
        .single();

      const { data, error } = await supabase
        .from('batch_timeline_items')
        .insert({
          batch_id: batchId,
          course_id: batch?.course_id,
          ...formData,
          created_by: userData?.user?.id
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: `${formData.type === 'RECORDING' ? 'Recording' : 'Live Session'} added to timeline`
      });

      // Trigger immediate notification if drip_offset_days is 0
      if (formData.drip_offset_days === 0) {
        triggerNotification(
          batchId,
          formData.type,
          formData.recording_id || formData.assignment_id || data.id,
          formData.title,
          formData.description,
          formData.meeting_link,
          formData.start_datetime,
          data.id
        );
      }

      await fetchTimeline();
      return data;
    } catch (error: any) {
      console.error('Error creating timeline item:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create timeline item",
        variant: "destructive"
      });
      throw error;
    }
  };

  const updateTimelineItem = async (id: string, formData: Partial<TimelineItemFormData>) => {
    try {
      const { data, error } = await supabase
        .from('batch_timeline_items')
        .update(formData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: "Timeline item updated successfully"
      });

      await fetchTimeline();
      return data;
    } catch (error: any) {
      console.error('Error updating timeline item:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update timeline item",
        variant: "destructive"
      });
      throw error;
    }
  };

  const deleteTimelineItem = async (id: string) => {
    try {
      const { error } = await supabase
        .from('batch_timeline_items')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Timeline item deleted successfully"
      });

      await fetchTimeline();
    } catch (error: any) {
      console.error('Error deleting timeline item:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete timeline item",
        variant: "destructive"
      });
      throw error;
    }
  };

  const updateSessionRecordingUrl = async (id: string, recordingUrl: string) => {
    return updateTimelineItem(id, { 
      recording_url: recordingUrl,
    });
  };

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  return {
    timelineItems,
    loading,
    fetchTimeline,
    createTimelineItem,
    updateTimelineItem,
    deleteTimelineItem,
    updateSessionRecordingUrl
  };
}
