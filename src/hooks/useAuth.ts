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
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await fetchUserProfile(session.user.id);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, role, full_name, created_at')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        
        // If user doesn't exist in users table, get email from auth and create basic user
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          console.log('Creating user record for authenticated user:', authUser.email);
          
          // Create user record in users table
          const { data: newUser, error: insertError } = await supabase
            .from('users')
            .insert({
              id: authUser.id,
              email: authUser.email || '',
              role: 'student', // Default role
              full_name: authUser.user_metadata?.full_name || null,
              created_at: new Date().toISOString()
            })
            .select()
            .single();

          if (insertError) {
            console.error('Error creating user record:', insertError);
            throw insertError;
          }

          setUser(newUser as User);
        } else {
          setUser(null);
        }
      } else {
        setUser(data as User);
      }
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
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