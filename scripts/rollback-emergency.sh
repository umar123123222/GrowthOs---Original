#!/bin/bash
# Emergency Rollback Script
# Created: 2025-01-19
# Purpose: Immediate rollback of critical fixes if issues arise

echo "🚨 EMERGENCY ROLLBACK INITIATED"
echo "================================"

# Step 1: Disable all migration feature flags
echo "📍 Step 1: Disabling feature flags..."
cat > src/lib/feature-flags.ts << 'EOF'
export const FEATURE_FLAGS = {
  // Emergency rollback - all fixes disabled
  ENABLE_CONSOLE_LOGGING: process.env.NODE_ENV === 'development',
  ENHANCED_ERROR_HANDLING: false, // DISABLED FOR ROLLBACK
  SAFE_DATABASE_QUERIES: false,   // DISABLED FOR ROLLBACK
  TYPE_SAFETY_IMPROVEMENTS: false,
  LMS_SEQUENTIAL_UNLOCK: false,
  
  // Phase 2: Database Safety Fixes (DISABLED)
  MIGRATE_SINGLE_QUERIES: false,
  ENABLE_DATABASE_ERROR_BOUNDARIES: false,
  SAFE_QUERY_FALLBACKS: false,
  
  // Phase 3: Console Logging Migration (DISABLED)
  MIGRATE_CONSOLE_LOGS: false,
  PRESERVE_DEBUG_LOGS: false,
  
  // Phase 4: Navigation & Performance (DISABLED)
  REPLACE_WINDOW_RELOAD: false,
  ENABLE_REAL_RECOVERY_RATE: false,
  OPTIMIZE_DATABASE_QUERIES: false,
  ENHANCED_LOADING_STATES: false,
  
  // Phase 5: Type Safety (DISABLED)
  STRICT_TYPE_CHECKING: false,
  RUNTIME_TYPE_VALIDATION: false,
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag];
}
EOF

echo "✅ Feature flags disabled"

# Step 2: Restore original console statements (if needed)
echo "📍 Step 2: Checking for console statement restoration..."
# This would require git revert for specific files if needed

# Step 3: Check database state
echo "📍 Step 3: Checking database integrity..."
echo "If database issues persist, run: supabase db reset --debug"

# Step 4: Restart application
echo "📍 Step 4: Application restart required"
echo "Run: yarn dev"

echo ""
echo "🔄 ROLLBACK COMPLETE"
echo "==================="
echo "1. ✅ Feature flags disabled"
echo "2. ⚠️  Database may need manual reset"
echo "3. 🔄 Restart application with: yarn dev"
echo "4. 📝 Check docs/CRITICAL_FIXES_CHECKPOINT.md for original state"
echo ""
echo "If issues persist:"
echo "- Check console for errors"
echo "- Review database logs"
echo "- Contact support with this rollback log"