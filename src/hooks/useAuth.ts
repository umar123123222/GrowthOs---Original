import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface User {
  id: string;
  email: string;
  role: 'student' | 'admin' | 'mentor' | 'superadmin' | 'Admin';
  full_name?: string;
  created_at?: string;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('useAuth: Starting authentication check');
    setLoading(true);
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log('useAuth: Initial session check', { session: !!session, error });
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
      if (session?.user) {
        await fetchUserProfile(session.user.id);
      } else {
        console.log('useAuth: No session in state change, clearing user');
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    console.log('fetchUserProfile: Starting for user ID:', userId);
    
    // Add a timeout to prevent infinite loading
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database query timeout')), 10000);
    });
    
    try {
      console.log('fetchUserProfile: About to make database query');
      
      const queryPromise = supabase
        .from('users')
        .select('id, email, role, full_name, created_at')
        .eq('id', userId)
        .single();
      
      const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any;
      
      console.log('fetchUserProfile: Database query completed', { 
        data: data ? { ...data, id: data.id } : null, 
        error: error ? error.message : null 
      });

      if (error) {
        console.error('fetchUserProfile: Database error:', error);
        // If user doesn't exist, we'll set user to null and let login handle user creation
        setUser(null);
      } else if (data) {
        console.log('fetchUserProfile: Setting user data:', { role: data.role, email: data.email });
        setUser(data as User);
      } else {
        console.log('fetchUserProfile: No data returned');
        setUser(null);
      }
    } catch (error) {
      console.error('fetchUserProfile: Catch block error:', error);
      setUser(null);
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
    refreshUser: () => user && fetchUserProfile(user.id)
  };
};