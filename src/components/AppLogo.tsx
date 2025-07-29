import { useCompanyLogo } from "@/hooks/useCompanyBranding";

interface AppLogoProps {
  variant?: 'header' | 'favicon' | 'original';
  className?: string;
  alt?: string;
}

export function AppLogo({ variant = 'header', className = "h-8 w-auto", alt = "Company Logo" }: AppLogoProps) {
  const logoUrl = useCompanyLogo();

  if (!logoUrl) {
    // Fallback to text logo if no logo is uploaded
    return (
      <div className={`flex items-center font-bold text-primary ${className}`}>
        Company
      </div>
    );
  }

  return (
    <img 
      src={logoUrl} 
      alt={alt}
      className={className}
    />
  );
}