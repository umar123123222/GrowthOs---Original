/**
 * Feature flags for safe rollout of fixes
 * Issues 1-6 implementation with zero-breakage policy
 */

export const FEATURE_FLAGS = {
  // Issue 3: Production console logging (OFF by default for safety)
  ENABLE_CONSOLE_LOGGING: process.env.NODE_ENV === 'development',
  
  // Issue 6: Enhanced error handling (ON by default, additive only)
  ENHANCED_ERROR_HANDLING: true,
  
  // Issue 4: Safe database queries (ON by default, replaces unsafe patterns)
  SAFE_DATABASE_QUERIES: true,
  
  // Issue 2: Type safety improvements (ON by default, compile-time only)
  TYPE_SAFETY_IMPROVEMENTS: true,
  
  // Sequential unlock system (OFF by default, zero regression)
  LMS_SEQUENTIAL_UNLOCK: false,
  
  // Phase 2: Database Safety Fixes (OFF by default, zero-breakage)
  MIGRATE_SINGLE_QUERIES: false,
  ENABLE_DATABASE_ERROR_BOUNDARIES: false,
  SAFE_QUERY_FALLBACKS: false,
  
  // Phase 3: Console Logging Migration (OFF by default)
  MIGRATE_CONSOLE_LOGS: false,
  PRESERVE_DEBUG_LOGS: true,
  
  // Phase 4: Navigation & Performance (OFF by default)
  REPLACE_WINDOW_RELOAD: false,
  ENABLE_REAL_RECOVERY_RATE: false,
  OPTIMIZE_DATABASE_QUERIES: false,
  ENHANCED_LOADING_STATES: false,
  
  // Phase 5: Type Safety (OFF by default)
  STRICT_TYPE_CHECKING: false,
  RUNTIME_TYPE_VALIDATION: false,
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag];
}