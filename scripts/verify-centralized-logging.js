// scripts/verify-centralized-logging.js
// Verification script to confirm all logging is using the centralized cronJobLogs collection

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    console.error('❌ GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable not set');
    process.exit(1);
  }
}

const db = admin.firestore();

async function main() {
  console.log('🔍 CENTRALIZED LOGGING VERIFICATION');
  console.log('=====================================\n');

  // 1. Check current Firestore collections
  console.log('1. 📊 CHECKING FIRESTORE COLLECTIONS...');
  const collections = await db.listCollections();
  const collectionNames = collections.map(c => c.id).sort();
  
  console.log('   Current collections in database:');
  collectionNames.forEach(name => {
    console.log(`   - ${name}`);
  });
  
  // 2. Check cronJobLogs collection
  console.log('\n2. 🎯 CHECKING CENTRAL LOGS COLLECTION...');
  
  if (collectionNames.includes('cronJobLogs')) {
    const cronJobLogsSnapshot = await db.collection('cronJobLogs').limit(5).get();
    console.log(`   ✅ cronJobLogs exists with ${cronJobLogsSnapshot.size} sample records`);
    
    if (!cronJobLogsSnapshot.empty) {
      const sampleLog = cronJobLogsSnapshot.docs[0].data();
      console.log('   📋 Sample log structure:');
      console.log(`   - cronJobName: ${sampleLog.cronJobName}`);
      console.log(`   - adminId: ${sampleLog.adminId}`);
      console.log(`   - status: ${sampleLog.status}`);
      console.log(`   - triggerType: ${sampleLog.triggerType}`);
      console.log(`   - createdAt: ${sampleLog.createdAt?.toDate?.() || sampleLog.createdAt}`);
    }
  } else {
    console.log('   ❌ cronJobLogs collection NOT FOUND');
  }

  // 3. Check legacy collections status
  console.log('\n3. 📜 CHECKING LEGACY COLLECTIONS...');
  
  const legacyCollections = [
    'takealotSyncLogs',
    'takealotApiLogs', 
    'fetch_logs',
    'takealotJobLogs'
  ];
  
  for (const legacyName of legacyCollections) {
    if (collectionNames.includes(legacyName)) {
      const legacySnapshot = await db.collection(legacyName).limit(1).get();
      console.log(`   🟡 ${legacyName}: EXISTS (${legacySnapshot.size > 0 ? 'has data' : 'empty'})`);
    } else {
      console.log(`   ✅ ${legacyName}: NOT FOUND (already deleted)`);
    }
  }

  // 4. Test centralized logging APIs
  console.log('\n4. 🧪 TESTING CENTRALIZED LOGGING APIs...');
  
  try {
    // Test Super Admin API
    const superAdminResponse = await fetch('http://localhost:3001/api/superadmin/cron-job-logs?limit=5', {
      method: 'GET'
    });
    
    if (superAdminResponse.ok) {
      const superAdminData = await superAdminResponse.json();
      console.log(`   ✅ Super Admin API: ${superAdminData.logs?.length || 0} logs fetched`);
    } else {
      console.log(`   ❌ Super Admin API: ${superAdminResponse.status} ${superAdminResponse.statusText}`);
    }
  } catch (error) {
    console.log(`   ⚠️  Super Admin API: ${error.message} (server may not be running)`);
  }

  // 5. Check for any remaining legacy writes in code
  console.log('\n5. 🔍 SCANNING CODE FOR LEGACY WRITES...');
  
  const legacyPatterns = [
    { collection: 'takealotSyncLogs', pattern: /collection\(['"]takealotSyncLogs['"]\)\.add/ },
    { collection: 'takealotApiLogs', pattern: /collection\(['"]takealotApiLogs['"]\)\.add/ },
    { collection: 'fetch_logs', pattern: /collection\(['"]fetch_logs['"]\)\.add/ },
    { collection: 'takealotJobLogs', pattern: /collection\(['"]takealotJobLogs['"]\)\.add/ }
  ];

  let foundLegacyWrites = false;
  
  function scanDirectory(dirPath) {
    const files = fs.readdirSync(dirPath);
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
        scanDirectory(filePath);
      } else if (file.endsWith('.ts') || file.endsWith('.js')) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        for (const { collection, pattern } of legacyPatterns) {
          if (pattern.test(content)) {
            console.log(`   ❌ Found ${collection} write in: ${filePath}`);
            foundLegacyWrites = true;
          }
        }
      }
    }
  }
  
  scanDirectory(path.join(__dirname, '..', 'src'));
  
  if (!foundLegacyWrites) {
    console.log('   ✅ No legacy write operations found in code');
  }

  // 6. Check for cronJobLogger usage
  console.log('\n6. ✅ CHECKING CENTRALIZED LOGGER USAGE...');
  
  let cronJobLoggerUsages = 0;
  
  function scanForCronJobLogger(dirPath) {
    const files = fs.readdirSync(dirPath);
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
        scanForCronJobLogger(filePath);
      } else if (file.endsWith('.ts') || file.endsWith('.js')) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        if (content.includes('cronJobLogger') || content.includes('CronJobLogger')) {
          cronJobLoggerUsages++;
        }
      }
    }
  }
  
  scanForCronJobLogger(path.join(__dirname, '..', 'src'));
  console.log(`   📊 Found ${cronJobLoggerUsages} files using centralized logger`);

  // 7. Summary
  console.log('\n7. 📋 VERIFICATION SUMMARY');
  console.log('===========================');
  
  const hasCentralLogs = collectionNames.includes('cronJobLogs');
  const hasLegacyCollections = legacyCollections.some(name => collectionNames.includes(name));
  
  if (hasCentralLogs && !foundLegacyWrites && cronJobLoggerUsages > 0) {
    console.log('✅ CENTRALIZED LOGGING IS ACTIVE');
    console.log('   - cronJobLogs collection exists');
    console.log('   - No legacy write operations found');
    console.log(`   - ${cronJobLoggerUsages} files using centralized logger`);
  } else {
    console.log('⚠️  CENTRALIZED LOGGING NEEDS ATTENTION');
    if (!hasCentralLogs) console.log('   - cronJobLogs collection missing');
    if (foundLegacyWrites) console.log('   - Legacy write operations still exist');
    if (cronJobLoggerUsages === 0) console.log('   - No centralized logger usage found');
  }
  
  if (hasLegacyCollections) {
    console.log('\n🗑️  LEGACY COLLECTIONS TO CONSIDER DELETING:');
    legacyCollections.forEach(name => {
      if (collectionNames.includes(name)) {
        console.log(`   - ${name}`);
      }
    });
  }

  console.log('\n🎯 NEXT STEPS:');
  if (!foundLegacyWrites && hasCentralLogs) {
    console.log('1. ✅ All logging is centralized');
    console.log('2. 🧪 Test admin and super admin UIs');
    console.log('3. 🗑️  Consider deleting legacy collections after testing');
  } else {
    console.log('1. ❌ Fix remaining legacy write operations');
    console.log('2. ✅ Ensure cronJobLogs collection is properly set up');
    console.log('3. 🧪 Test centralized logging functionality');
  }
}

main().catch(console.error);
