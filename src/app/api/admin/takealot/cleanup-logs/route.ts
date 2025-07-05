// src/app/api/admin/takealot/cleanup-logs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';

export async function POST(request: NextRequest) {  try {
    const { integrationId, clearAll } = await request.json();

    if (!integrationId) {
      return NextResponse.json({ error: 'Missing integrationId' }, { status: 400 });
    }

    console.log('Cleaning up logs for integration:', integrationId, clearAll ? '(ALL LOGS)' : '(DUMMY LOGS ONLY)');

    // Query all logs for this integration from centralized logging
    const logsSnapshot = await db
      .collection('logs')
      .where('integrationId', '==', integrationId)
      .get();

    console.log(`Found ${logsSnapshot.docs.length} logs to review`);

    // Delete logs based on clearAll flag
    const batch = db.batch();
    let deletedCount = 0;

    logsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      
      if (clearAll) {
        // Delete ALL logs for this integration
        batch.delete(doc.ref);
        deletedCount++;
      } else {
        // Delete only dummy/test logs and logs with problematic data
        if (
          // Test logs
          data.type === 'test' || 
          data.operation === 'Test Log Entry' ||
          data.trigger === 'test' ||
          
          // Unknown/dummy operations
          data.operation === 'Unknown Operation' ||
          data.operation === 'Manual Fetch' ||          
          // Logs with no meaningful data
          (data.recordsFetched === 0 && data.recordsSaved === 0 && data.totalRecords === 0) ||
          
          // Logs with "Running" status (incomplete/stuck operations)
          data.status === 'running' ||
          
          // Logs with invalid or missing operation names
          !data.operation ||
          data.operation === '' ||
          
          // Logs with invalid types
          !data.type ||
          data.type === ''
        ) {
          batch.delete(doc.ref);
          deletedCount++;
        }
      }
    });

    if (deletedCount > 0) {
      await batch.commit();
      console.log(`Deleted ${deletedCount} ${clearAll ? 'logs' : 'dummy/test logs'}`);
    }

    return NextResponse.json({ 
      success: true, 
      message: clearAll 
        ? `Cleared all ${deletedCount} logs` 
        : `Cleaned up ${deletedCount} dummy/test logs`,
      deletedCount
    });

  } catch (error: any) {
    console.error('Error cleaning up logs:', error);
    return NextResponse.json({ 
      error: 'Failed to cleanup logs', 
      details: error.message 
    }, { status: 500 });
  }
}
