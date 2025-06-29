#!/usr/bin/env node

// Script to remove all legacy logging collection writes
// This removes dual logging and keeps only the centralized logging system

const fs = require('fs');
const path = require('path');

const FILES_TO_CLEAN = [
  // Cron jobs with takealotSyncLogs
  'src/app/api/cron/takealot-6month-sales/route.ts',
  'src/app/api/cron/takealot-paginated-weekly/route.ts', 
  'src/app/api/cron/takealot-robust-daily/route.ts',
  'src/app/api/cron/takealot-robust-weekly/route.ts',
  'src/app/api/cron/takealot-robust-hourly/route.ts',
  
  // Manual fetch endpoints with various legacy logs
  'src/app/api/admin/takealot/optimized-fetch/route.ts', // takealotApiLogs
  'src/app/api/admin/takealot/simple-fetch/route.ts', // fetch_logs
  'src/app/api/admin/takealot/fetch-data/route.ts', // takealotJobLogs
  'src/app/api/admin/takealot/optimized-batch-fetch/route.ts', // fetch_logs
  'src/app/api/admin/takealot/test-log/route.ts', // fetch_logs
  
  // Other files
  'src/lib/paginatedSyncService.ts' // takealotSyncLogs
];

function removeLegacyLogging(filePath) {
  console.log(`Processing ${filePath}...`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`  File not found: ${filePath}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Remove takealotSyncLogs writes
  const syncLogsRegex = /\s*\/\/[^\n]*\n\s*await db\.collection\('takealotSyncLogs'\)\.add\({[^}]*}\);/gs;
  const syncLogsMatches = content.match(syncLogsRegex);
  if (syncLogsMatches) {
    content = content.replace(syncLogsRegex, '\n    // Legacy logging removed - now using centralized logging system');
    modified = true;
    console.log(`  Removed ${syncLogsMatches.length} takealotSyncLogs writes`);
  }
  
  // Remove takealotApiLogs writes
  const apiLogsRegex = /\s*await addDoc\(collection\(db, 'takealotApiLogs'\), {[^}]*}\);/gs;
  const apiLogsMatches = content.match(apiLogsRegex);
  if (apiLogsMatches) {
    content = content.replace(apiLogsRegex, '\n      // Legacy logging removed - now using centralized logging system');
    modified = true;
    console.log(`  Removed ${apiLogsMatches.length} takealotApiLogs writes`);
  }
  
  // Remove fetch_logs writes
  const fetchLogsRegex = /\s*(?:console\.log\('Saving operation log to fetch_logs\.\.\.'\);)?\s*const logDoc = await db\.collection\('fetch_logs'\)\.add\(logData\);/gs;
  const fetchLogsMatches = content.match(fetchLogsRegex);
  if (fetchLogsMatches) {
    content = content.replace(fetchLogsRegex, '\n            // Legacy logging removed - now using centralized logging system');
    modified = true;
    console.log(`  Removed ${fetchLogsMatches.length} fetch_logs writes`);
  }
  
  // Remove takealotJobLogs writes
  const jobLogsRegex = /\s*await db\.collection\('takealotJobLogs'\)\.add\({[^}]*}\);/gs;
  const jobLogsMatches = content.match(jobLogsRegex);
  if (jobLogsMatches) {
    content = content.replace(jobLogsRegex, '\n    // Legacy logging removed - now using centralized logging system');
    modified = true;
    console.log(`  Removed ${jobLogsMatches.length} takealotJobLogs writes`);
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`  ✅ Updated ${filePath}`);
  } else {
    console.log(`  ℹ️ No legacy logging found in ${filePath}`);
  }
}

console.log('🧹 Removing legacy logging collection writes...\n');

FILES_TO_CLEAN.forEach(file => {
  const fullPath = path.join(process.cwd(), file);
  removeLegacyLogging(fullPath);
});

console.log('\n✅ Legacy logging cleanup completed!');
console.log('\nNote: This script removed dual logging writes but kept centralized logging.');
console.log('All logging is now handled by the centralized cronJobLogger system.');
