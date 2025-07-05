// src/app/api/cron/cleanup-old-logs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PROJECT_ID && process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY && process.env.FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_SERVICE_ACCOUNT_PROJECT_ID,
        privateKey: process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL,
      }),
    });
  } else {
    admin.initializeApp();
  }
}

const db = admin.firestore();

export async function POST(request: NextRequest) {
  try {
    console.log('[LogCleanup] Starting automatic cleanup of old cron job logs...');
    
    // Calculate cutoff date (7 days ago)
    const retentionDays = 7;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    console.log(`[LogCleanup] Deleting logs older than: ${cutoffDate.toISOString()}`);
    
    // Query old logs in batches to avoid timeout
    const batchSize = 500;
    let totalDeleted = 0;
    let hasMore = true;
    
    while (hasMore) {
      const oldLogsSnapshot = await db.collection('logs')
        .where('createdAt', '<', admin.firestore.Timestamp.fromDate(cutoffDate))
        .limit(batchSize)
        .get();
      
      if (oldLogsSnapshot.empty) {
        hasMore = false;
        break;
      }
      
      // Delete in batch
      const batch = db.batch();
      oldLogsSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      totalDeleted += oldLogsSnapshot.size;
      
      console.log(`[LogCleanup] Deleted batch of ${oldLogsSnapshot.size} logs. Total deleted: ${totalDeleted}`);
      
      // If we got less than batch size, we're done
      if (oldLogsSnapshot.size < batchSize) {
        hasMore = false;
      }
    }
    
    // Get remaining log count for reporting
    const remainingLogsSnapshot = await db.collection('logs').get();
    const remainingCount = remainingLogsSnapshot.size;
    
    console.log(`[LogCleanup] Cleanup completed. Deleted: ${totalDeleted}, Remaining: ${remainingCount}`);
    
    return NextResponse.json({
      success: true,
      message: `Cleanup completed. Deleted ${totalDeleted} logs older than ${retentionDays} days`,
      deletedCount: totalDeleted,
      remainingCount: remainingCount,
      cutoffDate: cutoffDate.toISOString(),
      retentionDays: retentionDays
    });
    
  } catch (error: any) {
    console.error('[LogCleanup] Error during cleanup:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get cleanup statistics without deleting
    const retentionDays = 7;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    const totalLogsSnapshot = await db.collection('logs').get();
    const totalLogs = totalLogsSnapshot.size;
    
    const oldLogsSnapshot = await db.collection('logs')
      .where('createdAt', '<', admin.firestore.Timestamp.fromDate(cutoffDate))
      .get();
    const oldLogs = oldLogsSnapshot.size;
    
    const recentLogs = totalLogs - oldLogs;
    
    return NextResponse.json({
      success: true,
      statistics: {
        totalLogs,
        recentLogs,
        oldLogs,
        retentionDays,
        cutoffDate: cutoffDate.toISOString(),
        wouldDeleteCount: oldLogs
      }
    });
    
  } catch (error: any) {
    console.error('[LogCleanup] Error getting statistics:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
