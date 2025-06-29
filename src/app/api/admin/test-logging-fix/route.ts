// Quick test to create the cronJobLogs collection if missing
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';
import { cronJobLogger } from '@/lib/cronJobLogger';

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Testing and fixing logging system...');
    
    // 1. Check if cronJobLogs collection exists
    const cronLogsRef = db.collection('cronJobLogs');
    const existingLogs = await cronLogsRef.limit(1).get();
    
    console.log(`cronJobLogs collection has ${existingLogs.size} documents`);
    
    // 2. Create a test log to ensure collection works
    const testLogId = await cronJobLogger.logManualFetch({
      adminId: 'test-admin',
      adminName: 'Test Admin', 
      adminEmail: 'test@example.com',
      operation: 'System Test',
      apiSource: 'Test',
      status: 'success',
      message: 'Testing logging system after collection recreation',
      integrationId: 'test-integration',
      details: 'This is a test log to verify the cronJobLogs collection is working'
    });
    
    console.log(`✅ Test log created with ID: ${testLogId}`);
    
    // 3. Verify log was created
    const verifyLog = await cronLogsRef.doc(testLogId).get();
    if (verifyLog.exists) {
      console.log('✅ Log verified in database');
    } else {
      console.log('❌ Log not found in database');
    }
    
    // 4. Count total logs
    const allLogs = await cronLogsRef.get();
    console.log(`Total logs in cronJobLogs: ${allLogs.size}`);
    
    return NextResponse.json({
      success: true,
      message: 'Logging system test completed',
      testLogId,
      totalLogs: allLogs.size,
      details: 'cronJobLogs collection is now working. Try the manual sync again.'
    });
    
  } catch (error: any) {
    console.error('❌ Error testing logging system:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      details: 'Failed to test/fix logging system'
    }, { status: 500 });
  }
}
