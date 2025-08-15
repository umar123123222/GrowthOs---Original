import { useCompanyLogo } from "@/hooks/useCompanyBranding";
import { safeLogger } from '@/lib/safe-logger';

interface AppLogoProps {
  variant?: 'header' | 'favicon' | 'original';
  className?: string;
  alt?: string;
}

export function AppLogo({ variant = 'header', className = "h-10 w-auto max-w-[200px]", alt = "Company Logo" }: AppLogoProps) {
  const logoUrl = useCompanyLogo();

  safeLogger.info('AppLogo - logoUrl:', { logoUrl });

  // Only show logo if one is set in company settings
  if (!logoUrl) {
    safeLogger.info('AppLogo - No logo URL found, showing fallback');
    // Show a placeholder while loading or if no logo is set
    return (
      <div className={`${className} flex items-center justify-center bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-lg font-semibold text-sm`}>
        Loading...
      </div>
    );
  }

  return (
    <img 
      src={logoUrl} 
      alt={alt}
      className={`${className} object-contain`}
      onError={(e) => {
        console.error('AppLogo - Failed to load image:', logoUrl);
        // If image fails to load, hide the element
        const target = e.target as HTMLImageElement;
        target.style.display = 'none';
      }}
    />
  );
}