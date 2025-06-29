#!/usr/bin/env node

/**
 * Final System Verification Script
 * Verifies centralized logging system is ready for deployment
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 FINAL SYSTEM VERIFICATION - CENTRALIZED LOGGING');
console.log('=' .repeat(60));

let allChecks = true;

// Check 1: Required files exist
console.log('\n📁 Checking Required Files...');
const requiredFiles = [
  'src/lib/cronJobLogger.ts',
  'src/types/cron-logs.ts',
  'src/app/api/superadmin/cron-job-logs/route.ts',
  'src/app/api/admin/cron-job-logs/route.ts',
  'src/app/api/superadmin/clear-cron-logs/route.ts',
  'src/app/api/admin/clear-cron-logs/route.ts',
  'src/app/api/cron/cleanup-old-logs/route.ts',
  'src/components/superadmin/ApiMonitorClient.tsx',
  'src/components/superadmin/ClearLogsModal.tsx',
  'vercel.json',
  'firebase.json',
  'firestore.rules',
  'firestore.indexes.json'
];

requiredFiles.forEach(file => {
  const exists = fs.existsSync(path.join(__dirname, '..', file));
  console.log(`${exists ? '✅' : '❌'} ${file}`);
  if (!exists) allChecks = false;
});

// Check 2: Environment configuration
console.log('\n🔧 Checking Environment Configuration...');
const envFile = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envFile)) {
  const envContent = fs.readFileSync(envFile, 'utf8');
  const requiredEnvVars = [
    'GOOGLE_APPLICATION_CREDENTIALS_JSON',
    'FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID'
  ];
  
  requiredEnvVars.forEach(envVar => {
    const exists = envContent.includes(envVar);
    console.log(`${exists ? '✅' : '❌'} ${envVar}`);
    if (!exists) allChecks = false;
  });
} else {
  console.log('❌ .env.local file not found');
  allChecks = false;
}

// Check 3: Package.json dependencies
console.log('\n📦 Checking Dependencies...');
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const requiredDeps = [
  'firebase',
  'firebase-admin',
  'next',
  'react',
  'tailwindcss'
];

requiredDeps.forEach(dep => {
  const exists = packageJson.dependencies[dep] || packageJson.devDependencies[dep];
  console.log(`${exists ? '✅' : '❌'} ${dep}${exists ? ` (${exists})` : ''}`);
  if (!exists) allChecks = false;
});

// Check 4: Verify no legacy references in key files
console.log('\n🧹 Checking Legacy Code Cleanup...');
const filesToCheck = [
  'src/app/api/cron/takealot-paginated-daily/route.ts',
  'src/app/api/cron/takealot-6month-sales/route.ts',
  'src/app/api/takealot/manual-fetch/route.ts',
  'src/lib/paginatedSyncService.ts'
];

filesToCheck.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const hasLegacyRefs = content.includes('takealotSyncLogs') || 
                         content.includes('fetch_logs') ||
                         (content.includes('takealotSales') && !content.includes('getTakealotSales'));
    console.log(`${!hasLegacyRefs ? '✅' : '❌'} ${file} - Legacy references cleaned`);
    if (hasLegacyRefs) allChecks = false;
  }
});

// Check 5: Verify centralized logging usage
console.log('\n📝 Checking Centralized Logging Implementation...');
const cronFiles = [
  'src/app/api/cron/takealot-paginated-daily/route.ts',
  'src/app/api/cron/takealot-6month-sales/route.ts',
  'src/app/api/cron/calculate-product-metrics/route.ts'
];

cronFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const usesCentralizedLogging = content.includes('cronJobLogger') || content.includes('logCronJobStart');
    console.log(`${usesCentralizedLogging ? '✅' : '❌'} ${file} - Uses centralized logging`);
    if (!usesCentralizedLogging) allChecks = false;
  }
});

// Check 6: Build verification
console.log('\n🏗️  Build Verification...');
try {
  const { execSync } = require('child_process');
  console.log('Running build check...');
  execSync('npm run build', { stdio: 'pipe' });
  console.log('✅ Production build successful');
} catch (error) {
  console.log('❌ Production build failed');
  console.log('Error:', error.message);
  allChecks = false;
}

// Final result
console.log('\n' + '='.repeat(60));
if (allChecks) {
  console.log('🎊 ALL CHECKS PASSED - SYSTEM READY FOR DEPLOYMENT!');
  console.log('\n✅ Centralized logging system implemented');
  console.log('✅ Legacy code cleaned up'); 
  console.log('✅ All required files present');
  console.log('✅ Dependencies configured');
  console.log('✅ Production build successful');
  console.log('\n🚀 Ready to deploy to Vercel!');
} else {
  console.log('❌ SOME CHECKS FAILED - PLEASE REVIEW ABOVE');
  console.log('\n🔧 Fix the issues above before deploying');
}

console.log('\n📚 Next Steps:');
console.log('1. Review VERCEL_DEPLOYMENT_CHECKLIST.md');
console.log('2. Set up environment variables in Vercel');
console.log('3. Configure Firebase indexes');
console.log('4. Deploy and test');

process.exit(allChecks ? 0 : 1);
