import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@/types/common';
import { logger } from '@/lib/logger';

// Re-export User type for backwards compatibility
export type { User };

interface AuthSession {
  user: {
    id: string;
    email?: string;
    user_metadata?: {
      full_name?: string;
    };
  };
  access_token?: string;
  refresh_token?: string;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<AuthSession | null>(null);

  // Update user activity timestamp
  const updateLastActive = async (userId: string) => {
    try {
      await supabase
        .from('users')
        .update({ last_active_at: new Date().toISOString() })
        .eq('id', userId);
    } catch (error) {
      // Log technical details only - don't show user error for activity updates
      logger.error('Error updating last active', error);
    }
  };

  // Set up activity tracking
  useEffect(() => {
    if (!user?.id) return;

    // Update activity immediately
    updateLastActive(user.id);

    // Update activity every 2 minutes while user is active
    const activityInterval = setInterval(() => {
      updateLastActive(user.id);
    }, 2 * 60 * 1000); // 2 minutes

    // Update activity on user interactions
    const handleUserActivity = () => {
      updateLastActive(user.id);
    };

    // Listen for user activity
    document.addEventListener('mousedown', handleUserActivity);
    document.addEventListener('keydown', handleUserActivity);
    document.addEventListener('scroll', handleUserActivity);
    document.addEventListener('touchstart', handleUserActivity);

    return () => {
      clearInterval(activityInterval);
      document.removeEventListener('mousedown', handleUserActivity);
      document.removeEventListener('keydown', handleUserActivity);
      document.removeEventListener('scroll', handleUserActivity);
      document.removeEventListener('touchstart', handleUserActivity);
    };
  }, [user?.id]);

  useEffect(() => {
    logger.debug('useAuth: Starting authentication check');
    setLoading(true);
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      logger.debug('useAuth: Initial session check', { session: !!session, error });
      setSession(session as AuthSession);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        logger.debug('useAuth: No session found, setting loading to false');
        setLoading(false);
      }
    }).catch(err => {
      logger.error('useAuth: Error getting initial session', err);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      logger.debug('useAuth: Auth state changed', { event, session: !!session });
      setSession(session as AuthSession);
      
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setLoading(false);
        return;
      }
      
      if (session?.user) {
        // Defer the profile fetch to avoid blocking the auth state change
        setTimeout(() => {
          fetchUserProfile(session.user.id);
        }, 0);
      } else if (event === 'SIGNED_IN') {
        logger.debug('useAuth: No session in state change, clearing user');
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Add debouncing to prevent multiple calls
  const fetchUserProfileRef = useRef<string | null>(null);
  
  const fetchUserProfile = async (userId: string, force = false) => {
    // Prevent duplicate calls for the same user unless forced
    if (!force && fetchUserProfileRef.current === userId) {
      logger.debug('fetchUserProfile: Skipping duplicate call for user', { userId });
      return;
    }
    
    fetchUserProfileRef.current = userId;
    logger.debug('fetchUserProfile: Starting for user', { userId });
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          id, email, role, full_name, created_at, last_login_at, status, 
          password_display, is_temp_password, updated_at, created_by,
          students(onboarding_completed)
        `)
        .eq('id', userId)
        .maybeSingle();
      
      logger.debug('fetchUserProfile: Database query completed', { 
        hasData: !!data, 
        userRole: data?.role,
        error: error?.message
      });

      if (error) {
        logger.error('fetchUserProfile: Database error', error);
        // Don't sign out on database errors - keep the session active
        if (session?.user) {
          logger.warn('fetchUserProfile: Keeping session active despite database error');
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            role: 'student', // default role
            full_name: session.user.user_metadata?.full_name || session.user.email
          });
        }
      } else if (data) {
        logger.debug('fetchUserProfile: Setting user data', { role: data.role, email: data.email });
        // Determine onboarding status directly from students table for reliability
        let onboardingDone = true;
        if (data.role === 'student') {
          const { data: studentRow, error: studentErr } = await supabase
            .from('students')
            .select('onboarding_completed')
            .eq('user_id', userId)
            .maybeSingle();
          if (studentErr) {
            logger.warn('fetchUserProfile: Error fetching student onboarding status', studentErr);
          }
          onboardingDone = !!studentRow?.onboarding_completed;
        }

        const userData = {
          ...data,
          onboarding_done: onboardingDone,
        };
        setUser(userData as User);
      } else {
        logger.warn('fetchUserProfile: No data returned but session exists');
        // User record doesn't exist but session is valid - use session data
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            role: 'student', // default role
            full_name: session.user.user_metadata?.full_name || session.user.email
          });
        }
      }
    } catch (error) {
      logger.error('fetchUserProfile: Unexpected error', error);
      // Don't sign out on errors - preserve the session
      if (session?.user) {
        logger.warn('fetchUserProfile: Preserving session despite error');
        setUser({
          id: session.user.id,
          email: session.user.email || '',
          role: 'student', // default role
          full_name: session.user.user_metadata?.full_name || session.user.email
        });
      }
    } finally {
      logger.debug('fetchUserProfile: Setting loading to false');
      setLoading(false);
      fetchUserProfileRef.current = null; // Reset to allow future calls
    }
  };

  const refreshUser = async (force = false) => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser?.id) {
        await fetchUserProfile(authUser.id, force);
      } else {
        logger.warn('refreshUser: No auth user found');
        setUser(null);
        setLoading(false);
      }
    } catch (e) {
      logger.error('refreshUser: Error refreshing user', e);
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const hasRole = (roles: string | string[]): boolean => {
    if (!user) return false;
    if (typeof roles === 'string') return user.role === roles;
    return roles.includes(user.role);
  };

  const canAccessLMS = (): boolean => {
    if (!user) return false;
    if (user.role !== 'student') return true; // Non-students always have access
    return true; // For now, all students have access
  };

  return {
    user,
    loading,
    signOut,
    hasRole,
    canAccessLMS,
    refreshUser,
    session
  };
};