import { supabase } from "@/integrations/supabase/client";

export interface ActivityLogData {
  user_id: string;
  activity_type: string;
  metadata?: any;
  reference_id?: string;
}

export const logUserActivity = async (activityData: ActivityLogData) => {
  try {
    // Check if user is authenticated first
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      // Silently skip logging if user is not authenticated
      return;
    }

    // Ensure the user_id matches the authenticated user
    if (activityData.user_id !== user.id) {
      console.warn('Activity log user_id mismatch, skipping log');
      return;
    }

    const { error } = await supabase
      .from('user_activity_logs')
      .insert([{
        ...activityData,
        occurred_at: new Date().toISOString()
      }]);

    if (error) {
      // Don't throw errors for activity logging - just log them
      console.warn('Failed to log activity:', error);
    }
  } catch (error) {
    // Silently handle all activity logging errors to prevent blocking the UI
    console.warn('Activity logging error:', error);
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