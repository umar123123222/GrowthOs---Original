import { useState, useEffect } from 'react';
import { X, Info, AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface AnnouncementBannerSettings {
  enabled: boolean;
  message: string;
  start_date: string;
  end_date: string;
  background_color: 'blue' | 'yellow' | 'red' | 'green';
  dismissible: boolean;
}

const colorStyles = {
  blue: {
    bg: 'bg-blue-600',
    text: 'text-white',
    icon: Info,
    hoverBg: 'hover:bg-blue-700'
  },
  yellow: {
    bg: 'bg-yellow-500',
    text: 'text-yellow-900',
    icon: AlertTriangle,
    hoverBg: 'hover:bg-yellow-600'
  },
  red: {
    bg: 'bg-red-600',
    text: 'text-white',
    icon: AlertCircle,
    hoverBg: 'hover:bg-red-700'
  },
  green: {
    bg: 'bg-green-600',
    text: 'text-white',
    icon: CheckCircle,
    hoverBg: 'hover:bg-green-700'
  }
};

export function AnnouncementBanner() {
  const [settings, setSettings] = useState<AnnouncementBannerSettings | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBannerSettings();
  }, []);

  const fetchBannerSettings = async () => {
    try {
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
        
        // Check if previously dismissed (using localStorage with message hash)
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

  const hashMessage = (message: string): string => {
    // Simple hash for localStorage key
    let hash = 0;
    for (let i = 0; i < message.length; i++) {
      const char = message.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  };

  const handleDismiss = () => {
    if (settings?.message) {
      const dismissedKey = `announcement_dismissed_${hashMessage(settings.message)}`;
      localStorage.setItem(dismissedKey, 'true');
    }
    setIsDismissed(true);
  };

  const isWithinDateRange = (): boolean => {
    if (!settings?.start_date || !settings?.end_date) return false;
    
    const now = new Date();
    const startDate = new Date(settings.start_date);
    const endDate = new Date(settings.end_date);
    
    // Set end date to end of day
    endDate.setHours(23, 59, 59, 999);
    
    return now >= startDate && now <= endDate;
  };

  // Don't render if loading, not enabled, dismissed, or outside date range
  if (loading || !settings?.enabled || isDismissed || !isWithinDateRange()) {
    return null;
  }

  const style = colorStyles[settings.background_color] || colorStyles.blue;
  const IconComponent = style.icon;

  return (
    <div className={cn(
      'w-full py-3 px-4',
      style.bg,
      style.text
    )}>
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-3">
        <IconComponent className="h-5 w-5 flex-shrink-0" />
        <p className="text-sm font-medium text-center flex-1">
          {settings.message}
        </p>
        {settings.dismissible && (
          <button
            onClick={handleDismiss}
            className={cn(
              'p-1 rounded-full transition-colors flex-shrink-0',
              style.hoverBg
            )}
            aria-label="Dismiss announcement"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
