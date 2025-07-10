// scripts/fetch-integration-details.js
// Script to fetch and verify integration details directly from Firebase
// This ensures we use the correct integrationId, adminId, and account names

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin SDK
function initializeFirebase() {
  if (!admin.apps.length) {
    // Try to get credentials from environment
    const serviceAccountPath = path.join(__dirname, '..', 'firebase-service-account.json');
    
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('✅ Firebase initialized with service account file');
    } else {
      console.log('⚠️  Service account file not found, trying environment variables...');
      
      if (process.env.FIREBASE_SERVICE_ACCOUNT_PROJECT_ID && 
          process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY && 
          process.env.FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_SERVICE_ACCOUNT_PROJECT_ID,
            privateKey: process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
            clientEmail: process.env.FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL,
          }),
        });
        console.log('✅ Firebase initialized with environment variables');
      } else {
        console.log('⚠️  No Firebase credentials found, using default configuration');
        admin.initializeApp();
      }
    }
  }
}

// Fetch all integrations from Firebase
async function fetchAllIntegrations() {
  try {
    console.log('📡 Fetching all integrations from takealotIntegrations collection...');
    
    const db = admin.firestore();
    const integrationsRef = db.collection('takealotIntegrations');
    const snapshot = await integrationsRef.get();
    
    if (snapshot.empty) {
      console.log('❌ No integrations found in the collection');
      return [];
    }
    
    console.log(`📊 Found ${snapshot.size} integrations`);
    
    const integrations = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      integrations.push({
        integrationId: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || null,
        updatedAt: data.updatedAt?.toDate?.() || null
      });
    });
    
    return integrations;
  } catch (error) {
    console.error('❌ Error fetching integrations:', error);
    throw error;
  }
}

// Display integration details in a formatted way
function displayIntegrations(integrations) {
  console.log('\n🔍 INTEGRATION DETAILS:');
  console.log('='.repeat(80));
  
  integrations.forEach((integration, index) => {
    console.log(`\n📋 Integration ${index + 1}:`);
    console.log(`   Integration ID: ${integration.integrationId}`);
    console.log(`   Admin ID: ${integration.adminId}`);
    console.log(`   Account Name: ${integration.accountName}`);
    console.log(`   Assigned User ID: ${integration.assignedUserId}`);
    console.log(`   Has API Key: ${integration.apiKey ? 'Yes' : 'No'}`);
    console.log(`   Status: ${integration.status || 'Not set'}`);
    console.log(`   Created: ${integration.createdAt ? integration.createdAt.toISOString() : 'Not set'}`);
    console.log(`   Updated: ${integration.updatedAt ? integration.updatedAt.toISOString() : 'Not set'}`);
    console.log('   -'.repeat(60));
  });
}

// Save integration details to JSON file for reference
function saveIntegrationDetails(integrations) {
  const outputFile = path.join(__dirname, 'integration-details.json');
  const cleanedIntegrations = integrations.map(integration => ({
    integrationId: integration.integrationId,
    adminId: integration.adminId,
    accountName: integration.accountName,
    assignedUserId: integration.assignedUserId,
    hasApiKey: !!integration.apiKey,
    status: integration.status || null,
    createdAt: integration.createdAt ? integration.createdAt.toISOString() : null,
    updatedAt: integration.updatedAt ? integration.updatedAt.toISOString() : null
  }));
  
  fs.writeFileSync(outputFile, JSON.stringify(cleanedIntegrations, null, 2));
  console.log(`\n💾 Integration details saved to: ${outputFile}`);
}

// Check data consistency for each integration
async function checkDataConsistency(integrations) {
  console.log('\n🔍 CHECKING DATA CONSISTENCY:');
  console.log('='.repeat(80));
  
  const db = admin.firestore();
  
  for (const integration of integrations) {
    console.log(`\n📊 Checking integration: ${integration.accountName} (${integration.integrationId})`);
    
    try {
      // Check sales data
      const salesSnapshot = await db.collection('takealot_sales')
        .where('integrationId', '==', integration.integrationId)
        .limit(1)
        .get();
      
      // Check products/offers data
      const offersSnapshot = await db.collection('takealot_offers')
        .where('integrationId', '==', integration.integrationId)
        .limit(1)
        .get();
      
      console.log(`   Sales data: ${salesSnapshot.size > 0 ? 'Found' : 'Not found'}`);
      console.log(`   Offers data: ${offersSnapshot.size > 0 ? 'Found' : 'Not found'}`);
      
      if (salesSnapshot.size > 0) {
        const salesQuery = await db.collection('takealot_sales')
          .where('integrationId', '==', integration.integrationId)
          .get();
        console.log(`   Total sales records: ${salesQuery.size}`);
      }
      
      if (offersSnapshot.size > 0) {
        const offersQuery = await db.collection('takealot_offers')
          .where('integrationId', '==', integration.integrationId)
          .get();
        console.log(`   Total offers records: ${offersQuery.size}`);
      }
      
    } catch (error) {
      console.error(`   ❌ Error checking data for ${integration.accountName}:`, error.message);
    }
  }
}

// Main function
async function main() {
  try {
    console.log('🚀 Starting integration details fetch...');
    
    // Initialize Firebase
    initializeFirebase();
    
    // Fetch all integrations
    const integrations = await fetchAllIntegrations();
    
    if (integrations.length === 0) {
      console.log('❌ No integrations found. Please check your Firebase configuration.');
      return;
    }
    
    // Display integrations
    displayIntegrations(integrations);
    
    // Save to file
    saveIntegrationDetails(integrations);
    
    // Check data consistency
    await checkDataConsistency(integrations);
    
    console.log('\n✅ Integration details fetch completed successfully!');
    console.log('\n📝 NEXT STEPS:');
    console.log('   1. Review the integration details above');
    console.log('   2. Check the saved integration-details.json file');
    console.log('   3. Update all scripts and documentation with the correct details');
    console.log('   4. Run dual-write tests with the verified integration IDs');
    
  } catch (error) {
    console.error('❌ Error in main function:', error);
  } finally {
    // Clean up
    if (admin.apps.length > 0) {
      await admin.app().delete();
    }
  }
}

// Run the script
main().catch(console.error);
