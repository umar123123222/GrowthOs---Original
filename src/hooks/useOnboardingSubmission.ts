import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Legacy interface - kept for backward compatibility but no longer used
export interface OnboardingData {
  income_goal: string;
  motivation: string;
  ecommerce_experience: string;
  perceived_blockers: string[];
  thirty_day_aspirations: string;
}

export const useOnboardingSubmission = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const submitOnboardingAnswers = async (
    userId: string, 
    data: OnboardingData
  ): Promise<boolean> => {
    setLoading(true);
    try {
      // Store onboarding data in user's dream_goal_summary field for now
      // TODO: Create proper onboarding_responses table in migration
      const { error: userError } = await supabase
        .from('users')
        .update({
          dream_goal_summary: JSON.stringify(data)
        })
        .eq('id', userId);

      if (userError) {
        throw new Error(`Failed to update user profile: ${userError.message}`);
      }

      toast({
        title: "Onboarding Complete",
        description: "Your information has been saved successfully."
      });

      return true;
    } catch (error: any) {
      console.error('Onboarding submission error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save onboarding information"
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    submitOnboardingAnswers,
    loading
  };
};