import { supabase } from "@/integrations/supabase/client";

export interface ActivityLogData {
  user_id: string;
  activity_type: string;
  metadata?: any;
  reference_id?: string;
}

export const logUserActivity = async (activityData: ActivityLogData) => {
  try {
    const { error } = await supabase
      .from('user_activity_logs')
      .insert([{
        ...activityData,
        occurred_at: new Date().toISOString()
      }]);

    if (error) {
      console.error('Failed to log activity:', error);
    }
  } catch (error) {
    console.error('Activity logging error:', error);
  }
};

// Common activity types for consistency
export const ACTIVITY_TYPES = {
  LOGIN: 'login',
  LOGOUT: 'logout',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  PAGE_VISIT: 'page_visit',
  VIDEO_WATCHED: 'video_watched',
  ASSIGNMENT_SUBMITTED: 'assignment_submitted',
  ASSIGNMENT_VIEWED: 'assignment_viewed',
  PROFILE_UPDATED: 'profile_updated',
  LEADERBOARD_VIEWED: 'leaderboard_viewed'
} as const;