import { useEffect } from 'react';
import { getLogoVariants, updateFavicon } from '@/hooks/useCompanyBranding';

export function DynamicFavicon() {
  useEffect(() => {
    const updateAppFavicon = async () => {
      try {
        const variants = await getLogoVariants();
        if (variants?.favicon) {
          updateFavicon(variants.favicon);
        }
      } catch (error) {
        console.error('Error updating favicon:', error);
      }
    };

    updateAppFavicon();
  }, []);

  return null; // This component doesn't render anything
}