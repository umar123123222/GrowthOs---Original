import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AnnouncementBannerSettings {
  enabled: boolean;
  message: string;
  start_date: string;
  end_date: string;
  background_color: 'blue' | 'yellow' | 'red' | 'green';
  dismissible: boolean;
}

const hashMessage = (message: string): string => {
  let hash = 0;
  for (let i = 0; i < message.length; i++) {
    const char = message.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString();
};

export function useAnnouncementBanner() {
  const [settings, setSettings] = useState<AnnouncementBannerSettings | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchBannerSettings();
    }, 300);
    
    return () => clearTimeout(timer);
  }, []);

  const fetchBannerSettings = async () => {
    try {
      await supabase.auth.getSession();
      
      const { data, error } = await supabase
        .from('company_settings')
        .select('announcement_banner')
        .maybeSingle();

      if (error) {
        console.error('Error fetching banner settings:', error);
        return;
      }

      if (data?.announcement_banner) {
        const bannerSettings = data.announcement_banner as unknown as AnnouncementBannerSettings;
        setSettings(bannerSettings);
        
        if (bannerSettings.dismissible) {
          const dismissedKey = `announcement_dismissed_${hashMessage(bannerSettings.message)}`;
          const dismissed = localStorage.getItem(dismissedKey);
          if (dismissed) {
            setIsDismissed(true);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching banner settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const isWithinDateRange = (): boolean => {
    if (!settings?.start_date || !settings?.end_date) return false;
    
    const now = new Date();
    // Handle datetime-local format (YYYY-MM-DDTHH:MM) by treating as local time
    const startStr = settings.start_date.includes('T') ? settings.start_date : settings.start_date + 'T00:00';
    const endStr = settings.end_date.includes('T') ? settings.end_date : settings.end_date + 'T23:59';
    
    const startDate = new Date(startStr);
    const endDate = new Date(endStr);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      console.warn('Invalid date format in announcement banner:', { start: settings.start_date, end: settings.end_date });
      return false;
    }
    
    endDate.setSeconds(59, 999);
    
    return now >= startDate && now <= endDate;
  };

  const dismiss = () => {
    if (settings?.message) {
      const dismissedKey = `announcement_dismissed_${hashMessage(settings.message)}`;
      localStorage.setItem(dismissedKey, 'true');
    }
    setIsDismissed(true);
  };

  const isVisible = !loading && settings?.enabled && !isDismissed && isWithinDateRange();

  return {
    settings,
    isVisible,
    dismiss,
    loading
  };
}
