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

  // Support Contact Information
  SUPPORT_EMAIL: import.meta.env.VITE_SUPPORT_EMAIL || "support@growthos.core47.ai",
  SUPPORT_PHONE: import.meta.env.VITE_SUPPORT_PHONE || "+92 300 1234567",
  SUPPORT_WHATSAPP: import.meta.env.VITE_SUPPORT_WHATSAPP || "+923001234567",
  SUPPORT_ADDRESS: import.meta.env.VITE_SUPPORT_ADDRESS || "Islamabad, Pakistan",

  // External Service URLs
  WHATSAPP_API_URL: import.meta.env.VITE_WHATSAPP_API_URL || "https://api.whatsapp.com",
  N8N_WEBHOOK_BASE: import.meta.env.VITE_N8N_WEBHOOK_BASE || "https://n8n.core47.ai/webhook",
  SHOPIFY_APP_URL: import.meta.env.VITE_SHOPIFY_APP_URL || "https://shopify.core47.ai",
  
  // Email Configuration
  FROM_EMAIL: import.meta.env.VITE_FROM_EMAIL || "noreply@growthos.core47.ai",
  FROM_NAME: import.meta.env.VITE_FROM_NAME || "Growth OS",
  REPLY_TO_EMAIL: import.meta.env.VITE_REPLY_TO_EMAIL || "support@growthos.core47.ai",

  // Business Rules
  DEFAULT_ASSIGNMENT_DEADLINE_DAYS: parseInt(import.meta.env.VITE_DEFAULT_ASSIGNMENT_DEADLINE_DAYS || "7"),
  DEFAULT_SESSION_DURATION_MINUTES: parseInt(import.meta.env.VITE_DEFAULT_SESSION_DURATION_MINUTES || "60"),
  MINIMUM_PASSWORD_LENGTH: parseInt(import.meta.env.VITE_MINIMUM_PASSWORD_LENGTH || "8"),
  
  // Notification Defaults
  INACTIVE_STUDENT_THRESHOLD_DAYS: parseInt(import.meta.env.VITE_INACTIVE_STUDENT_THRESHOLD_DAYS || "3"),
  PAYMENT_REMINDER_DAYS_BEFORE: parseInt(import.meta.env.VITE_PAYMENT_REMINDER_DAYS_BEFORE || "3"),

  // Domain & URL Patterns
  SHOPIFY_DOMAIN_SUFFIX: import.meta.env.VITE_SHOPIFY_DOMAIN_SUFFIX || ".myshopify.com",
  SHOPIFY_DOMAIN_PATTERN: import.meta.env.VITE_SHOPIFY_DOMAIN_PATTERN || "^[a-z0-9-]+\\.myshopify\\.com$",
  BLOCKED_DOMAINS: import.meta.env.VITE_BLOCKED_DOMAINS || "growthos.core47.ai,core47.ai",
  
  // Test Data Configuration
  TEST_ADMIN_EMAIL: import.meta.env.VITE_TEST_ADMIN_EMAIL || "admin@testcompany.com",
  TEST_MENTOR_EMAIL: import.meta.env.VITE_TEST_MENTOR_EMAIL || "mentor@testcompany.com", 
  TEST_STUDENT_EMAIL: import.meta.env.VITE_TEST_STUDENT_EMAIL || "student@testcompany.com",
  TEST_PASSWORD: import.meta.env.VITE_TEST_PASSWORD || "testpassword123",
  
  // UI Text Content
  APP_WELCOME_MESSAGE: import.meta.env.VITE_APP_WELCOME_MESSAGE || "Welcome to Growth OS",
  SIGN_IN_BUTTON_TEXT: import.meta.env.VITE_SIGN_IN_BUTTON_TEXT || "Sign In to Growth OS",
  SHOPIFY_PLACEHOLDER: import.meta.env.VITE_SHOPIFY_PLACEHOLDER || "yourstore.myshopify.com",
  
  // Error Messages
  GENERIC_ERROR_MESSAGE: import.meta.env.VITE_GENERIC_ERROR_MESSAGE || "An error occurred. Please try again.",
  CONNECTION_ERROR_MESSAGE: import.meta.env.VITE_CONNECTION_ERROR_MESSAGE || "Connection failed. Please check your details and try again.",
  SUCCESS_MESSAGE: import.meta.env.VITE_SUCCESS_MESSAGE || "Operation completed successfully",
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