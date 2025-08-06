import { useCompanyLogo } from "@/hooks/useCompanyBranding";

interface AppLogoProps {
  variant?: 'header' | 'favicon' | 'original';
  className?: string;
  alt?: string;
}

export function AppLogo({ variant = 'header', className = "h-10 w-auto max-w-[200px]", alt = "Company Logo" }: AppLogoProps) {
  const logoUrl = useCompanyLogo();

  // Only show logo if one is set in company settings
  if (!logoUrl) {
    return null;
  }

  return (
    <img 
      src={logoUrl} 
      alt={alt}
      className={`${className} object-contain`}
      onError={(e) => {
        // If image fails to load, hide the element
        const target = e.target as HTMLImageElement;
        target.style.display = 'none';
      }}
    />
  );
}