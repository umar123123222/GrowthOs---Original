# Environment Configuration Guide

This project has been made fully configurable to support SaaS deployment scenarios where each client gets their own UI and database instance.

## Quick Setup

1. **Copy environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Generate HTML from template:**
   ```bash
   node scripts/build-html.js
   ```

3. **Validate configuration:**
   ```bash
   node scripts/validate-env.js
   ```

4. **Start development:**
   ```bash
   npm run dev
   ```

## What's Configurable

### 🔑 Supabase Configuration
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Public anon key
- `VITE_SUPABASE_PROJECT_ID` - Project identifier

### 🎨 Application Branding
- `VITE_APP_TITLE` - Browser title and meta tags
- `VITE_APP_DESCRIPTION` - Meta description for SEO
- `VITE_APP_AUTHOR` - Author metadata
- `VITE_COMPANY_NAME` - Company name in branding
- `VITE_TWITTER_HANDLE` - Social media handle
- `VITE_FAVICON_PATH` - Path to favicon

### 🏢 Company Defaults
- `VITE_DEFAULT_COMPANY_NAME` - Default company name
- `VITE_DEFAULT_CURRENCY` - Default currency (USD, EUR, etc.)
- `VITE_DEFAULT_FEE_AMOUNT` - Default course fee
- `VITE_DEFAULT_MAX_INSTALLMENTS` - Max installment count
- `VITE_DEFAULT_LMS_URL` - Default LMS URL
- `VITE_DEFAULT_RECOVERY_RATE` - Dashboard recovery rate

### ⚙️ Development Settings
- `VITE_DEV_PORT` - Development server port
- `VITE_DEV_HOST` - Development server host

## File Structure

```
project/
├── .env.example              # Environment template
├── .env                      # Your configuration (create this)
├── index.template.html       # HTML template with placeholders
├── index.html               # Generated HTML (auto-generated)
├── src/lib/env-config.ts    # Environment configuration loader
├── scripts/
│   ├── build-html.js        # HTML template processor
│   └── validate-env.js      # Environment validator
└── supabase/config.toml     # Supabase config (uses env vars)
```

## Deployment Process

### For SaaS Providers

1. **Set up environment for each client:**
   ```bash
   # Client A
   VITE_SUPABASE_URL=https://client-a.supabase.co
   VITE_APP_TITLE="Client A Learning Platform"
   VITE_COMPANY_NAME="Client A Inc"
   
   # Client B  
   VITE_SUPABASE_URL=https://client-b.supabase.co
   VITE_APP_TITLE="Client B Academy"
   VITE_COMPANY_NAME="Client B Corp"
   ```

2. **Build for each client:**
   ```bash
   # Process HTML template with client-specific variables
   node scripts/build-html.js
   
   # Build the application
   npm run build
   ```

3. **Deploy separately** - Each client gets their own deployment with their own environment configuration.

### For Single Instance

Just set up your `.env` file once and deploy normally.

## Build Integration

The build process automatically generates `index.html` from the template. You can also run this manually:

```bash
# Regenerate HTML from template
node scripts/build-html.js

# Validate current environment
node scripts/validate-env.js
```

## Backward Compatibility

- ✅ **All existing hardcoded values are preserved as fallbacks**
- ✅ **Current deployments continue working without any changes**
- ✅ **No breaking changes to existing functionality**
- ✅ **Environment variables are optional - defaults are used if not set**

## Migration from Hardcoded Values

All previously hardcoded values now have environment variable equivalents:

| Hardcoded Value | Environment Variable | Fallback |
|----------------|---------------------|----------|
| `majqoqagohicjigmsilu.supabase.co` | `VITE_SUPABASE_URL` | Original URL |
| `"Growth OS - AI-Powered Learning Platform"` | `VITE_APP_TITLE` | Original title |
| `"Your Company"` | `VITE_DEFAULT_COMPANY_NAME` | "Your Company" |
| `"USD"` | `VITE_DEFAULT_CURRENCY` | "USD" |
| `3000` | `VITE_DEFAULT_FEE_AMOUNT` | 3000 |
| `85` (recovery rate) | `VITE_DEFAULT_RECOVERY_RATE` | 85 |

The system automatically uses environment variables when available, falling back to the original hardcoded values to ensure nothing breaks.

## Troubleshooting

### Missing Environment Variables
The system will warn about missing required variables but continue with fallbacks:
```
Warning: Missing required environment variables: VITE_SUPABASE_URL
```

### HTML Template Issues
If `index.html` looks wrong, regenerate it:
```bash
node scripts/build-html.js
```

### Configuration Validation
Check your current configuration:
```bash
node scripts/validate-env.js
```

This will show all current values and their sources (environment vs default).

## Example .env File

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://yourclient.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_SUPABASE_PROJECT_ID=yourclient

# Branding
VITE_APP_TITLE=YourClient Learning Platform
VITE_APP_DESCRIPTION=Custom learning platform for YourClient
VITE_COMPANY_NAME=YourClient Inc
VITE_TWITTER_HANDLE=@yourclient

# Defaults
VITE_DEFAULT_COMPANY_NAME=YourClient Inc
VITE_DEFAULT_CURRENCY=EUR
VITE_DEFAULT_FEE_AMOUNT=2500
VITE_DEFAULT_RECOVERY_RATE=90
```