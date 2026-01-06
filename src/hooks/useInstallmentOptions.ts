import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { safeLogger } from '@/lib/safe-logger';
import { useToast } from '@/hooks/use-toast';

interface CompanySettings {
  maximum_installment_count: number;
}

interface InstallmentOption {
  value: string;
  label: string;
}

/**
 * Hook for generating installment options.
 * Can use a specific max count (from course/pathway) or fall back to company settings.
 */
export const useInstallmentOptions = (specificMaxCount?: number) => {
  const [options, setOptions] = useState<InstallmentOption[]>([]);
  const [maxCount, setMaxCount] = useState<number>(specificMaxCount || 3);
  const [isLoading, setIsLoading] = useState(!specificMaxCount);
  const { toast } = useToast();

  const generateOptions = (count: number): InstallmentOption[] => {
    return Array.from({ length: count }, (_, index) => {
      const num = index + 1;
      return {
        value: `${num}_installment${num === 1 ? '' : 's'}`,
        label: `${num} Installment${num === 1 ? '' : 's'}`
      };
    });
  };

  const fetchCompanySettings = async () => {
    // If a specific max count is provided, use it directly
    if (specificMaxCount) {
      setMaxCount(specificMaxCount);
      setOptions(generateOptions(specificMaxCount));
      setIsLoading(false);
      return;
    }

    try {
      safeLogger.info('Fetching company settings for installments...');
      const { data, error } = await supabase
        .from('company_settings')
        .select('maximum_installment_count')
        .maybeSingle();

      safeLogger.info('Company settings response:', { data, error });

      if (error) {
        console.error('Error fetching company settings:', error);
        return;
      }

      const count = data?.maximum_installment_count || 3;
      safeLogger.info('Setting installment count to:', { count });
      setMaxCount(count);
      setOptions(generateOptions(count));
    } catch (error) {
      console.error('Error fetching company settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Update options when specificMaxCount changes
  useEffect(() => {
    if (specificMaxCount) {
      setMaxCount(specificMaxCount);
      setOptions(generateOptions(specificMaxCount));
      setIsLoading(false);
    }
  }, [specificMaxCount]);

  const validateInstallmentValue = (value: string): boolean => {
    const match = value.match(/^(\d+)_installments?$/);
    if (!match) return false;
    
    const count = parseInt(match[1]);
    return count >= 1 && count <= maxCount;
  };

  const refreshOptions = () => {
    fetchCompanySettings();
    toast({
      title: "Installment options updated",
      description: "Options updated to match new company settings.",
    });
  };

  useEffect(() => {
    fetchCompanySettings();

    // Set up real-time listener for company settings changes
    const channel = supabase
      .channel('company-settings-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'company_settings'
        },
        (payload) => {
          if (payload.new && payload.new.maximum_installment_count !== maxCount) {
            const newCount = payload.new.maximum_installment_count;
            setMaxCount(newCount);
            setOptions(generateOptions(newCount));
            toast({
              title: "Installment options updated",
              description: "Options updated to match new company settings.",
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [maxCount, toast]);

  return {
    options,
    maxCount,
    isLoading,
    validateInstallmentValue,
    refreshOptions,
    defaultValue: options[0]?.value || '1_installment'
  };
};