// Environment configuration with fallbacks
export const ENV_CONFIG = {
  // Supabase Configuration
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || "https://majqoqagohicjigmsilu.supabase.co",
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hanFvcWFnb2hpY2ppZ21zaWx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE2MzM3MTksImV4cCI6MjA2NzIwOTcxOX0.m7QE1xCco9XyfZrTi24lhElL8Bo8Jqj9zOFovfBAzWw",
  SUPABASE_PROJECT_ID: import.meta.env.VITE_SUPABASE_PROJECT_ID || "majqoqagohicjigmsilu",

  // Application Branding
  APP_TITLE: import.meta.env.VITE_APP_TITLE || "Growth OS - AI-Powered Learning Platform",
  APP_DESCRIPTION: import.meta.env.VITE_APP_DESCRIPTION || "Growth OS by IDM Pakistan - AI-powered LMS for e-commerce success",
  APP_AUTHOR: import.meta.env.VITE_APP_AUTHOR || "IDM Pakistan",
  COMPANY_NAME: import.meta.env.VITE_COMPANY_NAME || "IDM Pakistan",
  TWITTER_HANDLE: import.meta.env.VITE_TWITTER_HANDLE || "@core47ai",
  FAVICON_PATH: import.meta.env.VITE_FAVICON_PATH || "/favicon.ico",

  // Site Configuration
  SITE_URL: import.meta.env.VITE_SITE_URL || "https://majqoqagohicjigmsilu.lovable.app",

  // Company Defaults
  DEFAULT_COMPANY_NAME: import.meta.env.VITE_DEFAULT_COMPANY_NAME || "Your Company",
  DEFAULT_CURRENCY: import.meta.env.VITE_DEFAULT_CURRENCY || "USD",
  DEFAULT_FEE_AMOUNT: parseFloat(import.meta.env.VITE_DEFAULT_FEE_AMOUNT || "3000"),
  DEFAULT_MAX_INSTALLMENTS: parseInt(import.meta.env.VITE_DEFAULT_MAX_INSTALLMENTS || "3"),
  DEFAULT_LMS_URL: import.meta.env.VITE_DEFAULT_LMS_URL || "https://growthos.core47.ai",
  DEFAULT_INVOICE_OVERDUE_DAYS: parseInt(import.meta.env.VITE_DEFAULT_INVOICE_OVERDUE_DAYS || "30"),
  DEFAULT_INVOICE_SEND_GAP_DAYS: parseInt(import.meta.env.VITE_DEFAULT_INVOICE_SEND_GAP_DAYS || "7"),
  DEFAULT_RECOVERY_RATE: parseFloat(import.meta.env.VITE_DEFAULT_RECOVERY_RATE || "85"),

  // Development Server Configuration
  DEV_PORT: parseInt(import.meta.env.VITE_DEV_PORT || "8080"),
  DEV_HOST: import.meta.env.VITE_DEV_HOST || "::",

  // Success Partner Configuration
  SUCCESS_PARTNER_DAILY_LIMIT: parseInt(import.meta.env.VITE_SUCCESS_PARTNER_DAILY_LIMIT || "10"),
  SUCCESS_PARTNER_WEBHOOK_URL: import.meta.env.VITE_SUCCESS_PARTNER_WEBHOOK_URL || "https://n8n.core47.ai/webhook/SuccessPartner",
} as const;

// Validation function
export function validateEnvironment() {
  const required = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_PROJECT_ID'
  ] as const;

  const missing = required.filter(key => !ENV_CONFIG[key]);
  
  if (missing.length > 0) {
    console.warn(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return missing.length === 0;
}