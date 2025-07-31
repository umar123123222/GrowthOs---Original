import { supabase } from '@/integrations/supabase/client';

export async function triggerOnboardingProcessor() {
  try {
    console.log('Triggering onboarding processor...');
    const { data, error } = await supabase.functions.invoke('process-onboarding-jobs', {
      body: {}
    });
    
    if (error) {
      console.error('Error triggering onboarding processor:', error);
      return { success: false, error };
    }
    
    console.log('Onboarding processor response:', data);
    return { success: true, data };
  } catch (error) {
    console.error('Failed to trigger onboarding processor:', error);
    return { success: false, error };
  }
}