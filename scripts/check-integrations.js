// Script to check existing Takealot integrations and their current sync settings
async function checkExistingIntegrations() {
  try {
    console.log('🔍 CHECKING EXISTING TAKEALOT INTEGRATIONS\n');
    console.log('==========================================\n');
    
    // Test if we can access the admin dashboard first
    console.log('1. Testing admin dashboard access...');
    try {
      const dashboardResponse = await fetch('http://localhost:3000/admin');
      console.log(`   Dashboard status: ${dashboardResponse.status}`);
      
      if (dashboardResponse.status === 200) {
        console.log('   ✅ Admin dashboard accessible');
      } else {
        console.log('   ⚠️  Admin dashboard may require authentication');
      }
    } catch (error) {
      console.log(`   ❌ Error accessing dashboard: ${error.message}`);
    }
    
    console.log('\n2. Testing integration API endpoints...');
    
    // Test the integrations endpoint
    try {
      const integrationsResponse = await fetch('http://localhost:3000/api/admin/integrations/takealot');
      console.log(`   Integrations API status: ${integrationsResponse.status}`);
      
      if (integrationsResponse.ok) {
        const integrationsData = await integrationsResponse.json();
        console.log('   ✅ Integrations API accessible');
        console.log(`   Found ${integrationsData.length || 0} integrations`);
        
        if (integrationsData.length > 0) {
          console.log('\n   📋 Current Integrations:');
          integrationsData.forEach((integration, index) => {
            console.log(`   ${index + 1}. ${integration.accountName || 'Unnamed'} (ID: ${integration.id})`);
            console.log(`      - API Key: ${integration.apiKey ? '✅ Set' : '❌ Missing'}`);
            console.log(`      - Assigned User: ${integration.assignedUserName || 'None'}`);
            console.log(`      - Created: ${integration.createdAt ? new Date(integration.createdAt.toDate()).toLocaleString() : 'Unknown'}`);
          });
        }
      } else {
        console.log('   ⚠️  Integrations API requires authentication');
      }
    } catch (error) {
      console.log(`   ❌ Error checking integrations: ${error.message}`);
    }
    
    console.log('\n3. Instructions for setting up integrations...');
    console.log('   📝 TO SET UP REAL TAKEALOT INTEGRATIONS:');
    console.log('   1. Open http://localhost:3000/admin in your browser');
    console.log('   2. Log in with admin credentials');
    console.log('   3. Navigate to "Takealot Integration" or "Integrations"');
    console.log('   4. Add new integration with:');
    console.log('      - Account Name (descriptive name)');
    console.log('      - Valid Takealot API Key');
    console.log('      - Assign to a user (optional)');
    console.log('   5. Save the integration');
    console.log('   6. Go to Settings for that integration');
    console.log('   7. Test API connection');
    console.log('   8. Configure sync preferences');
    console.log('   9. Enable desired cron strategies');
    console.log('   10. Click "Save Preferences"');
    
    console.log('\n🎯 NEXT TESTING STEPS:');
    console.log('=====================================');
    console.log('After setting up integrations:');
    console.log('1. Test sync preferences saving');
    console.log('2. Enable a 10-minute strategy');
    console.log('3. Wait and check API logs');
    console.log('4. Test manual sync operations');
    console.log('5. Verify data synchronization');
    
  } catch (error) {
    console.error('❌ Check failed:', error.message);
  }
}

// Run the check
checkExistingIntegrations();
