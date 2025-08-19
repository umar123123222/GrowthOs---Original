#!/usr/bin/env node

/**
 * Phase 3: Console Logging Migration Script
 * Systematically replace console statements with safe logging
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Files to exclude from migration
const EXCLUDED_FILES = [
  'src/lib/logger.ts',
  'src/lib/safe-logger.ts', 
  'src/utils/migrated-console.ts',
  'src/utils/errorHandling.ts',
  'src/lib/production-monitoring.ts'
];

// Console statement patterns and their replacements
const MIGRATION_PATTERNS = [
  {
    pattern: /console\.error\(/g,
    replacement: 'handleApplicationError(',
    importNeeded: "import { handleApplicationError } from '@/utils/errorHandling';"
  },
  {
    pattern: /console\.warn\(/g,
    replacement: 'safeLogger.warn(',
    importNeeded: "import { safeLogger } from '@/lib/safe-logger';"
  },
  {
    pattern: /console\.log\(/g,
    replacement: 'safeLogger.info(',
    importNeeded: "import { safeLogger } from '@/lib/safe-logger';"
  },
  {
    pattern: /console\.debug\(/g,
    replacement: 'safeLogger.debug(',
    importNeeded: "import { safeLogger } from '@/lib/safe-logger';"
  }
];

function shouldExcludeFile(filePath) {
  return EXCLUDED_FILES.some(excluded => filePath.includes(excluded)) ||
         filePath.includes('.test.') ||
         filePath.includes('.spec.');
}

function countConsoleStatements(content) {
  let count = 0;
  MIGRATION_PATTERNS.forEach(({ pattern }) => {
    const matches = content.match(pattern);
    if (matches) count += matches.length;
  });
  return count;
}

function analyzeCodebase() {
  console.log('🔍 Phase 3: Console Logging Migration Analysis\n');
  
  // Find all TypeScript files
  const srcFiles = glob.sync('src/**/*.{ts,tsx}').filter(f => !shouldExcludeFile(f));
  const edgeFiles = glob.sync('supabase/functions/**/*.ts');
  
  let totalReplacements = 0;
  let filesToUpdate = [];
  
  // Analyze src files
  console.log('📁 Source Files Analysis:');
  srcFiles.forEach(filePath => {
    const content = fs.readFileSync(filePath, 'utf8');
    const count = countConsoleStatements(content);
    if (count > 0) {
      console.log(`  ${filePath}: ${count} console statements`);
      totalReplacements += count;
      filesToUpdate.push({ path: filePath, count, type: 'src' });
    }
  });
  
  // Analyze edge function files
  console.log('\n🚀 Edge Functions Analysis:');
  edgeFiles.forEach(filePath => {
    const content = fs.readFileSync(filePath, 'utf8');
    const count = countConsoleStatements(content);
    if (count > 0) {
      console.log(`  ${filePath}: ${count} console statements`);
      totalReplacements += count;
      filesToUpdate.push({ path: filePath, count, type: 'edge' });
    }
  });
  
  console.log(`\n📊 Migration Summary:`);
  console.log(`  Total console statements: ${totalReplacements}`);
  console.log(`  Files to update: ${filesToUpdate.length}`);
  console.log(`  Source files: ${filesToUpdate.filter(f => f.type === 'src').length}`);
  console.log(`  Edge functions: ${filesToUpdate.filter(f => f.type === 'edge').length}`);
  
  return { totalReplacements, filesToUpdate };
}

function createMigrationPlan(filesToUpdate) {
  console.log('\n📋 Migration Strategy:');
  console.log('  1. High-priority: Error boundaries and core components');
  console.log('  2. Medium-priority: Feature components and hooks');
  console.log('  3. Low-priority: Edge functions (careful with Deno compatibility)');
  console.log('  4. Validation: Run tests and verify functionality');
  
  // Prioritize files by importance
  const highPriority = filesToUpdate.filter(f => 
    f.path.includes('ErrorBoundary') ||
    f.path.includes('SafeErrorBoundary') ||
    f.path.includes('Layout.tsx') ||
    f.path.includes('App.tsx')
  );
  
  const mediumPriority = filesToUpdate.filter(f => 
    f.type === 'src' && !highPriority.includes(f)
  );
  
  const lowPriority = filesToUpdate.filter(f => f.type === 'edge');
  
  console.log(`\n🎯 Migration Phases:`);
  console.log(`  Phase 3a - Critical UI (${highPriority.length} files)`);
  console.log(`  Phase 3b - Feature Components (${mediumPriority.length} files)`);
  console.log(`  Phase 3c - Edge Functions (${lowPriority.length} files)`);
  
  return { highPriority, mediumPriority, lowPriority };
}

// Main execution
if (require.main === module) {
  const { totalReplacements, filesToUpdate } = analyzeCodebase();
  const migrationPlan = createMigrationPlan(filesToUpdate);
  
  console.log('\n✅ Analysis complete. Ready for Phase 3 migration.');
  console.log('   Run with --execute flag to perform the migration.');
}

module.exports = { analyzeCodebase, createMigrationPlan, MIGRATION_PATTERNS };