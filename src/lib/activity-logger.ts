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
  ASSIGNMENT_REVIEWED: 'assignment_reviewed',
  PROFILE_UPDATED: 'profile_updated',
  LEADERBOARD_VIEWED: 'leaderboard_viewed',
  MODULE_COMPLETED: 'module_completed',
  MODULE_STARTED: 'module_started',
  SUPPORT_TICKET_CREATED: 'support_ticket_created',
  SUPPORT_TICKET_REPLIED: 'support_ticket_replied',
  SESSION_ATTENDED: 'session_attended',
  CERTIFICATE_DOWNLOADED: 'certificate_downloaded',
  USER_CREATED: 'user_created',
  USER_UPDATED: 'user_updated',
  USER_DELETED: 'user_deleted',
  CONTENT_CREATED: 'content_created',
  CONTENT_UPDATED: 'content_updated',
  CONTENT_DELETED: 'content_deleted',
  ROLE_CHANGED: 'role_changed',
  SETTINGS_UPDATED: 'settings_updated',
  ASSIGNMENT_APPROVED: 'assignment_approved',
  ASSIGNMENT_DECLINED: 'assignment_declined',
  RECORDING_UNLOCKED: 'recording_unlocked',
  SUCCESS_SESSION_SCHEDULED: 'success_session_scheduled',
  SUCCESS_SESSION_ATTENDED: 'success_session_attended',
} as const;

// Helper function to log specific activities with common patterns
export const logActivity = {
  login: (userId: string) => logUserActivity({
    user_id: userId,
    activity_type: ACTIVITY_TYPES.LOGIN,
    metadata: { timestamp: new Date().toISOString() }
  }),

  logout: (userId: string) => logUserActivity({
    user_id: userId,
    activity_type: ACTIVITY_TYPES.LOGOUT,
    metadata: { timestamp: new Date().toISOString() }
  }),

  pageVisit: (userId: string, page: string) => logUserActivity({
    user_id: userId,
    activity_type: ACTIVITY_TYPES.PAGE_VISIT,
    metadata: { page, timestamp: new Date().toISOString() }
  }),

  videoWatched: (userId: string, videoId: string, duration?: number) => logUserActivity({
    user_id: userId,
    activity_type: ACTIVITY_TYPES.VIDEO_WATCHED,
    reference_id: videoId,
    metadata: { videoId, duration, timestamp: new Date().toISOString() }
  }),

  assignmentSubmitted: (userId: string, assignmentId: string, submissionType: string) => logUserActivity({
    user_id: userId,
    activity_type: ACTIVITY_TYPES.ASSIGNMENT_SUBMITTED,
    reference_id: assignmentId,
    metadata: { assignmentId, submissionType, timestamp: new Date().toISOString() }
  }),

  moduleCompleted: (userId: string, moduleId: string) => logUserActivity({
    user_id: userId,
    activity_type: ACTIVITY_TYPES.MODULE_COMPLETED,
    reference_id: moduleId,
    metadata: { moduleId, timestamp: new Date().toISOString() }
  }),

  supportTicketCreated: (userId: string, ticketId: string, type: string) => logUserActivity({
    user_id: userId,
    activity_type: ACTIVITY_TYPES.SUPPORT_TICKET_CREATED,
    reference_id: ticketId,
    metadata: { ticketId, type, timestamp: new Date().toISOString() }
  }),

  userAction: (userId: string, action: string, target: string, targetId?: string) => logUserActivity({
    user_id: userId,
    activity_type: action,
    reference_id: targetId,
    metadata: { action, target, targetId, timestamp: new Date().toISOString() }
  })
} as const;