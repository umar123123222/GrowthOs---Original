import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CreateStudentData {
  full_name: string;
  email: string;
  phone: string;
  fees_structure: string;
}

export interface CreateStudentResponse {
  success: boolean;
  studentId?: string;
  tempPassword?: string;
  emailSent?: boolean;
  error?: string;
}

export const useSecureStudentCreation = () => {
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const createStudent = async (studentData: CreateStudentData): Promise<CreateStudentResponse> => {
    setIsCreating(true);

    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No authentication session');
      }

      // Call the secure edge function
      const { data, error } = await supabase.functions.invoke('create-student-secure', {
        body: studentData,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Edge function error:', error);
        toast({
          title: 'Error',
          description: error.message || 'Failed to create student account',
          variant: 'destructive',
        });
        return { success: false, error: error.message || 'Failed to create student' };
      }

      if (!data.success) {
        const errorDetails = data.details ? ` (${data.details})` : '';
        
        if (data.error === 'Student Email Exists') {
          toast({
            title: "Email Already Exists",
            description: "A student with this email address already exists in the system.",
            variant: "destructive",
          });
        } else if (data.error === 'Insufficient permissions') {
          toast({
            title: "Access Denied",
            description: "You don't have permission to create students.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Creation Failed",
            description: `${data.error || "Failed to create student account"}${errorDetails}`,
            variant: "destructive",
          });
        }
        return data;
      }

      // Success
      toast({
        title: "Student Created Successfully",
        description: `Student created and login email sent${data.emailSent ? '' : ' (email delivery may have failed)'}.`,
      });

      return data;

    } catch (error) {
      console.error('Student creation error:', error);
      toast({
        title: "Creation Failed",
        description: "An unexpected error occurred while creating the student.",
        variant: "destructive",
      });
      return { success: false, error: 'An unexpected error occurred' };
    } finally {
      setIsCreating(false);
    }
  };

  return {
    createStudent,
    isCreating,
  };
};