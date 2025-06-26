// src/app/api/admin/sync-jobs/route.ts

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

export async function GET(request: NextRequest) {
  try {
    // For now, return mock data until the paginated sync system is deployed
    // This will be replaced with real data after deployment
    
    const mockStats = {
      activeJobs: 0,
      activeProductJobs: 0,
      activeSalesJobs: 0,
      completedJobsLast24h: 0,
      totalItemsProcessedLast24h: 0,
      errorRate: 0
    };

    const mockActiveJobs: any[] = [];
    const mockRecentJobs: any[] = [];
    const mockRecentLogs: any[] = [];

    // Try to get real sync logs from the existing collection
    try {
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);
      
      const recentLogsSnapshot = await db.collection('takealotSyncLogs')
        .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(yesterday))
        .orderBy('timestamp', 'desc')
        .limit(20)
        .get();

      if (!recentLogsSnapshot.empty) {
        mockRecentLogs.push(...recentLogsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })));
        
        // Update stats based on real logs
        mockStats.completedJobsLast24h = recentLogsSnapshot.docs.filter(doc => 
          doc.data().type === 'summary' || doc.data().type === 'robust_sync_summary'
        ).length;
        
        mockStats.errorRate = recentLogsSnapshot.docs.length > 0 
          ? (recentLogsSnapshot.docs.filter(doc => 
              doc.data().type === 'error' || doc.data().type === 'fatal_error'
            ).length / recentLogsSnapshot.docs.length) * 100
          : 0;
      }
    } catch (logError) {
      console.warn('[SyncJobs] Could not fetch recent logs:', logError);
    }

    return NextResponse.json({
      success: true,
      stats: mockStats,
      activeJobs: mockActiveJobs,
      recentJobs: mockRecentJobs,
      recentLogs: mockRecentLogs,
      message: 'Paginated sync system not yet deployed. Showing legacy sync data.',
      isPaginatedSystemActive: false
    });

  } catch (error: any) {
    console.error('[SyncJobs] Error in sync jobs API:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch sync job data',
        message: error.message,
        isPaginatedSystemActive: false
      },
      { status: 500 }
    );
  }
}
