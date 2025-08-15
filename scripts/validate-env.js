// Environment validation script
import { ENV_CONFIG, validateEnvironment } from '../src/lib/env-config.js';

console.log('🔍 Validating environment configuration...\n');

// Check if validation passes
const isValid = validateEnvironment();

// Display all configuration
console.log('📋 Current Configuration:');
console.log('========================');

Object.entries(ENV_CONFIG).forEach(([key, value]) => {
  const isDefault = !process.env[`VITE_${key}`];
  const status = isDefault ? '(default)' : '(env)';
  console.log(`${key.padEnd(25)}: ${value} ${status}`);
});

console.log('\n' + '='.repeat(50));

if (isValid) {
  console.log('✅ Environment validation passed');
} else {
  console.log('❌ Environment validation failed');
  process.exit(1);
}

console.log('\n💡 To customize configuration:');
console.log('   1. Copy .env.example to .env');
console.log('   2. Update variables in .env file');
console.log('   3. Restart development server');