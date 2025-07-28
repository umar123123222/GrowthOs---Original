import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CreateStudentRequest {
  fullName: string;
  email: string;
  phone: string;
  feesStructure: string;
}

export interface CreateStudentResponse {
  success: boolean;
  studentId?: string;
  lmsUserId?: string;
  invoiceId?: string;
  tempPassword?: string;
  emailSent?: boolean;
  error?: string;
}

export const useStudentCreation = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const createStudent = async (studentData: CreateStudentRequest): Promise<boolean> => {
    setLoading(true);
    try {
      console.log('Creating student with data:', studentData);
      
      const { data, error } = await supabase.functions.invoke('create-student-complete', {
        body: studentData
      });

      console.log('Response from create-student-complete:', data, error);

      if (error) {
        console.error('Function invocation error:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message || "Failed to create student"
        });
        return false;
      }

      if (data?.error || !data?.success) {
        console.error('Function returned error:', data?.error);
        toast({
          variant: "destructive",
          title: "Error",
          description: data?.error || "Failed to create student"
        });
        return false;
      }

      // Success case
      const response = data as CreateStudentResponse;
      
      let successMessage = `Student ${studentData.email} created successfully`;
      if (response.emailSent) {
        successMessage += '. LMS credentials and invoice sent via email.';
      } else {
        successMessage += '. Note: Email sending failed - please provide credentials manually.';
      }

      toast({
        title: "Success",
        description: successMessage
      });
      
      return true;
    } catch (error: any) {
      console.error('Error creating student:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create student"
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    createStudent,
    loading
  };
};