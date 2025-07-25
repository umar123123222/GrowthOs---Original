import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CompanySettings {
  maximum_installment_count: number;
}

interface InstallmentOption {
  value: string;
  label: string;
}

export const useInstallmentOptions = () => {
  const [options, setOptions] = useState<InstallmentOption[]>([]);
  const [maxCount, setMaxCount] = useState<number>(3);
  const [isLoading, setIsLoading] = useState(true);
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
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('maximum_installment_count')
        .maybeSingle();

      if (error) {
        console.error('Error fetching company settings:', error);
        return;
      }

      const count = data?.maximum_installment_count || 3;
      setMaxCount(count);
      setOptions(generateOptions(count));
    } catch (error) {
      console.error('Error fetching company settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

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