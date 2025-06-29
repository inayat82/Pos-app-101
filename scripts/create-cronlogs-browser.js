// Direct script to create cronJobLogs collection
// Copy and paste this into your browser console while on your app

async function createCronJobLogsCollection() {
  try {
    console.log('🔧 Creating cronJobLogs collection...');
    
    // Call the endpoint to create the collection
    const response = await fetch('/api/admin/recreate-cronlogs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ SUCCESS: cronJobLogs collection created!');
      console.log('Document ID:', result.documentId);
      console.log('Collection exists:', result.collectionExists);
      console.log('Message:', result.message);
      
      // Test the collection by creating a test log
      console.log('\n🧪 Testing the collection...');
      const testResponse = await fetch('/api/admin/takealot/test-log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          test: true,
          message: 'Testing cronJobLogs collection after recreation'
        })
      });
      
      if (testResponse.ok) {
        console.log('✅ Test log created successfully!');
        console.log('\n🎉 COLLECTION READY! You can now:');
        console.log('1. Run manual sales sync');
        console.log('2. Check Admin > API Call Logs');
        console.log('3. Check Super Admin > Cron Job Logs tab');
      } else {
        console.log('⚠️ Collection created but test log failed');
      }
      
    } else {
      console.log('❌ FAILED to create collection:');
      console.log('Error:', result.error);
      console.log('Details:', result.details);
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Error creating collection:', error);
    return { success: false, error: error.message };
  }
}

// Run the function
createCronJobLogsCollection();
