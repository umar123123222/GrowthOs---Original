import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface InstallmentPlan {
  value: string;
  label: string;
}

export const useInstallmentPlans = () => {
  const [plans, setPlans] = useState<InstallmentPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInstallmentPlans = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('company_settings')
          .select('installment_plans')
          .single();

        if (fetchError) {
          console.error('Error fetching installment plans:', fetchError);
          setError('Failed to load installment plans');
          return;
        }

        if (!data?.installment_plans || data.installment_plans.length === 0) {
          setError('No installment plans configured');
          return;
        }

        // Convert installment plans array to options
        const planOptions = data.installment_plans.map((plan: string) => ({
          value: plan,
          label: plan.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        }));

        setPlans(planOptions);
      } catch (err) {
        console.error('Error in fetchInstallmentPlans:', err);
        setError('Failed to load installment plans');
      } finally {
        setIsLoading(false);
      }
    };

    fetchInstallmentPlans();

    // Subscribe to changes in company_settings
    const subscription = supabase
      .channel('company_settings_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'company_settings',
        },
        () => {
          fetchInstallmentPlans();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return {
    plans,
    isLoading,
    error,
  };
};