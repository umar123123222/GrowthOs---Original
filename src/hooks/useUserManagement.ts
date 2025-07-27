import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type UserRole = 'student' | 'admin' | 'mentor' | 'superadmin' | 'enrollment_manager';

export interface CreateUserRequest {
  target_email: string;
  target_password: string;
  target_role: UserRole;
  target_full_name?: string;
  target_metadata?: any;
}

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  created_at: string;
  metadata?: any;
}

export const useUserManagement = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const createUser = async (userData: CreateUserRequest): Promise<boolean> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-user-with-role', {
        body: userData
      });

      if (error || data?.error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: data?.error || error?.message || "Failed to create user"
        });
        return false;
      }

      toast({
        title: "Success",
        description: `User ${userData.target_email} created successfully`
      });
      return true;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create user"
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (userId: string): Promise<boolean> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-user-with-role', {
        body: { target_user_id: userId }
      });

      if (error || data?.error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: data?.error || error?.message || "Failed to delete user"
        });
        return false;
      }

      toast({
        title: "Success",
        description: "User deleted successfully"
      });
      return true;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete user"
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const getCurrentUserInfo = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('whoami');
      
      if (error || data?.error) {
        console.error('Failed to get user info:', data?.error || error?.message);
        return null;
      }

      return data as UserProfile;
    } catch (error: any) {
      console.error('Failed to get user info:', error.message);
      return null;
    }
  };

  return {
    createUser,
    deleteUser,
    getCurrentUserInfo,
    loading
  };
};