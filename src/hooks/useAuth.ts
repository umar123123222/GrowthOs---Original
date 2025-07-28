import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface User {
  id: string;
  email: string;
  role: 'student' | 'admin' | 'mentor' | 'superadmin' | 'enrollment_manager';
  full_name?: string;
  created_at?: string;
  metadata?: any;
  shopify_credentials?: string;
  shopify_domain?: string;
  meta_ads_credentials?: string;
  onboarding_done?: boolean;
  fees_overdue?: boolean;
  fees_due_date?: string;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    console.log('useAuth: Starting authentication check');
    setLoading(true);
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log('useAuth: Initial session check', { session: !!session, error });
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        console.log('useAuth: No session found, setting loading to false');
        setLoading(false);
      }
    }).catch(err => {
      console.error('useAuth: Error getting initial session:', err);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('useAuth: Auth state changed', { event, session: !!session });
      setSession(session);
      
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
        console.log('useAuth: No session in state change, clearing user');
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    console.log('fetchUserProfile: Starting for user ID:', userId);
    
    try {
      console.log('fetchUserProfile: About to make database query');
      
      const { data, error } = await supabase
        .from('users')
        .select('id, email, role, full_name, created_at, shopify_credentials, meta_ads_credentials, onboarding_done, fees_overdue, fees_due_date')
        .eq('id', userId)
        .maybeSingle();
      
      console.log('fetchUserProfile: Database query completed', { 
        data: data ? { ...data, id: data.id } : null, 
        error: error ? error.message : null 
      });

      if (error) {
        console.error('fetchUserProfile: Database error:', error);
        // Don't sign out on database errors - keep the session active
        if (session?.user) {
          console.log('fetchUserProfile: Keeping session active despite database error');
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            role: 'student', // default role
            full_name: session.user.user_metadata?.full_name || session.user.email
          });
        }
      } else if (data) {
        console.log('fetchUserProfile: Setting user data:', { role: data.role, email: data.email });
        setUser(data as User);
      } else {
        console.log('fetchUserProfile: No data returned but session exists');
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
      console.error('fetchUserProfile: Catch block error:', error);
      // Don't sign out on errors - preserve the session
      if (session?.user) {
        console.log('fetchUserProfile: Preserving session despite error');
        setUser({
          id: session.user.id,
          email: session.user.email || '',
          role: 'student', // default role
          full_name: session.user.user_metadata?.full_name || session.user.email
        });
      }
    } finally {
      console.log('fetchUserProfile: Setting loading to false');
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
    refreshUser: () => user && fetchUserProfile(user.id),
    session
  };
};