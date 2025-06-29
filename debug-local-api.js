// Test the local API endpoint to debug dashboard data issues
const fetch = require('node-fetch');

async function testLocalAPI() {
  // Use the correct token from your Webshare API Keys page
  const API_TOKEN = 'b0lsrebqg66r3v5zueooiuiSreaaoqg9p4wlcgin'; // From your screenshot
  
  try {
    console.log('🔍 Testing local API endpoint for aggregate stats...\n');
    
    const url = `http://localhost:3000/api/superadmin/webshare?apiToken=${encodeURIComponent(API_TOKEN)}&action=aggregate-stats&days=7`;
    console.log('📡 URL:', url);
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log('✅ API call successful!\n');
      console.log('📊 Dashboard Data Structure:');
      console.log(JSON.stringify(data.data, null, 2));
      
      // Focus on subscription data
      if (data.data.subscription) {
        console.log('\n🎯 Subscription Details:');
        console.log('- Raw subscription object:', JSON.stringify(data.data.subscription, null, 2));
        console.log('- term (plan):', data.data.subscription.term);
        console.log('- end_date (expires):', data.data.subscription.end_date);
        console.log('- paused:', data.data.subscription.paused);
        console.log('- throttled:', data.data.subscription.throttled);
        
        // Test status logic
        const endDate = data.data.subscription.end_date;
        const isActive = endDate ? new Date(endDate) > new Date() : false;
        console.log('- Calculated status:', isActive ? 'Active' : 'Inactive');
      } else {
        console.log('\n❌ No subscription data found');
      }
      
      // Check for errors
      if (data.data.errors && data.data.errors.length > 0) {
        console.log('\n⚠️  API Errors:', data.data.errors);
      }
      
    } else {
      console.log('❌ API call failed');
      console.log('Response:', data);
    }
    
  } catch (error) {
    console.log('💥 Error:', error.message);
  }
}

// Test settings API
async function testSettingsAPI() {
  try {
    console.log('\n🔍 Testing settings API...\n');
    
    const response = await fetch('http://localhost:3000/api/superadmin/webshare/settings');
    const data = await response.json();
    
    console.log('Settings API response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.log('Settings API error:', error.message);
  }
}

// Test connection with the real token
async function testConnection() {
  const API_TOKEN = 'b0lsrebqg66r3v5zueooiuiSreaaoqg9p4wlcgin';
  
  try {
    console.log('\n🔍 Testing connection...\n');
    
    const response = await fetch('http://localhost:3000/api/superadmin/webshare', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiToken: API_TOKEN,
        action: 'test-connection'
      }),
    });
    
    const data = await response.json();
    console.log('Connection test response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.log('Connection test error:', error.message);
  }
}

console.log('🚀 Starting comprehensive API tests...');
testConnection()
  .then(() => testLocalAPI())
  .then(() => testSettingsAPI())
  .catch(console.error);
