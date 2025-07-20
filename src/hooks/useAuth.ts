import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface User {
  id: string;
  email: string;
  role: 'student' | 'admin' | 'mentor' | 'superadmin';
  full_name?: string;
  created_at?: string;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('useAuth: Starting authentication check');
    let mounted = true;
    
    const initializeAuth = async () => {
      try {
        // Get current session
        const { data: { session }, error } = await supabase.auth.getSession();
        console.log('useAuth: Initial session check', { session: !!session, error });
        
        if (!mounted) return;
        
        if (session?.user) {
          await fetchUserProfile(session.user.id);
        } else {
          console.log('useAuth: No session found, setting loading to false');
          setLoading(false);
        }
      } catch (err) {
        console.error('useAuth: Error getting initial session:', err);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('useAuth: Auth state changed', { event, session: !!session });
      
      if (!mounted) return;
      
      if (event === 'SIGNED_IN' && session?.user) {
        await fetchUserProfile(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        console.log('useAuth: User signed out, clearing state');
        setUser(null);
        setLoading(false);
      }
    });

    initializeAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchUserProfile = async (userId: string) => {
    console.log('fetchUserProfile: Starting for user ID:', userId);
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, role, full_name, created_at')
        .eq('id', userId)
        .maybeSingle();
      
      console.log('fetchUserProfile: Database query completed', { 
        data: data ? { ...data, id: data.id } : null, 
        error: error ? error.message : null 
      });

      if (error) {
        console.error('fetchUserProfile: Database error:', error);
        setUser(null);
      } else if (data) {
        console.log('fetchUserProfile: Setting user data:', { role: data.role, email: data.email });
        setUser(data as User);
      } else {
        console.log('fetchUserProfile: No user data found');
        setUser(null);
      }
    } catch (error) {
      console.error('fetchUserProfile: Catch block error:', error);
      setUser(null);
    } finally {
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