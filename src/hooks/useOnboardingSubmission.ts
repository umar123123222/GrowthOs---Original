import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
      // For now, save to the existing onboarding_responses table structure
      // TODO: Create onboarding_answers table in migration
      const { error: answersError } = await supabase
        .from('onboarding_responses')
        .upsert({
          user_id: userId,
          question_type: 'comprehensive_onboarding',
          question_text: 'Comprehensive Onboarding Questions',
          answer_data: data as any,
          answer_value: JSON.stringify(data)
        }, { onConflict: 'user_id,question_type' });

      if (answersError) {
        throw new Error(`Failed to save onboarding answers: ${answersError.message}`);
      }

      // Update user profile with onboarding completion and first_login_complete
      const { error: userError } = await supabase
        .from('users')
        .update({
          onboarding_done: true,
          
          onboarding_data: data as any // Also store in the existing field for backward compatibility
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