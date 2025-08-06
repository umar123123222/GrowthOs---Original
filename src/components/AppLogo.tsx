import { useCompanyLogo } from "@/hooks/useCompanyBranding";

interface AppLogoProps {
  variant?: 'header' | 'favicon' | 'original';
  className?: string;
  alt?: string;
}

export function AppLogo({ variant = 'header', className = "h-10 w-auto max-w-[200px]", alt = "Company Logo" }: AppLogoProps) {
  const logoUrl = useCompanyLogo();

  if (!logoUrl) {
    // Fallback to text logo if no logo is uploaded
    return (
      <div className={`flex items-center font-bold text-2xl text-primary ${className.replace('h-10', 'h-auto').replace('max-w-[200px]', '')}`}>
        GrowthOS
      </div>
    );
  }

  return (
    <img 
      src={logoUrl} 
      alt={alt}
      className={`${className} object-contain`}
      onError={(e) => {
        // If image fails to load, replace with fallback
        const target = e.target as HTMLImageElement;
        target.style.display = 'none';
        if (target.parentNode) {
          const fallback = document.createElement('div');
          fallback.className = `flex items-center font-bold text-2xl text-primary ${className.replace('h-10', 'h-auto').replace('max-w-[200px]', '')}`;
          fallback.textContent = 'GrowthOS';
          target.parentNode.replaceChild(fallback, target);
        }
      }}
    />
  );
}