import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { getLogoUrl } from "@/utils/logoUtils";
import { safeMaybeSingle } from '@/lib/database-safety';
import { logger } from '@/lib/logger';

// Hook to get company logo from settings
export const useCompanyLogo = () => {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const result = await safeMaybeSingle(
          supabase
            .from('company_settings')
            .select('branding')
            .eq('id', 1),
          'company-logo-fetch'
        );

        const { data, error, success } = result;

        if (error || !success) {
          logger.error('Failed to fetch company branding', error);
          return;
        }

        if ((data as any)?.branding) {
          const brandingData = (data as any).branding;
          const headerLogo = getLogoUrl(brandingData, 'header');
          setLogoUrl(headerLogo);
        }
      } catch (error) {
        logger.error('Error fetching company logo:', error);
      }
    };

    fetchLogo();
  }, []);

  return logoUrl;
};

// Update favicon dynamically
export const updateFavicon = (faviconUrl: string) => {
  // Remove existing favicon links
  const existingLinks = document.querySelectorAll('link[rel*="icon"]');
  existingLinks.forEach(link => link.remove());

  // Add new favicon
  const link = document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/png';
  link.href = faviconUrl;
  document.head.appendChild(link);
};

// Get all logo variants for a context
export const getLogoVariants = async () => {
  try {
    const result = await safeMaybeSingle(
      supabase
        .from('company_settings')
        .select('branding')
        .eq('id', 1),
      'logo-variants-fetch'
    );

    const { data, error, success } = result;

    if (error || !success) {
      logger.error('Failed to fetch company logo variants', error);
      return [];
    }

    const brandingData = (data as any)?.branding;
    if (brandingData && typeof brandingData === 'object' && brandingData !== null) {
      if (brandingData.logo) {
        return {
          original: brandingData.logo.original,
          favicon: brandingData.logo.favicon,
          header: brandingData.logo.header
        };
      }
    }

    return null;
  } catch (error) {
    logger.error('Error fetching logo variants:', error);
    return null;
  }
};