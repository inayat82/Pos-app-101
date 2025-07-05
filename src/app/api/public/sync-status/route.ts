// src/app/api/public/sync-status/route.ts

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
    console.log('[PublicSyncStatus] Fetching sync status...');

    // Initialize stats
    const stats = {
      activeJobs: 0,
      activeProductJobs: 0,
      activeSalesJobs: 0,
      completedJobsLast24h: 0,
      totalItemsProcessedLast24h: 0,
      errorRate: 0
    };

    // Get active sync jobs from the paginated system
    const activeJobs: any[] = [];
    const recentJobs: any[] = [];
    const recentLogs: any[] = [];

    try {
      // 1. Get active jobs from takealotSyncJobs collection
      const activeJobsSnapshot = await db.collection('takealotSyncJobs')
        .where('status', 'in', ['pending', 'in_progress'])
        .orderBy('startedAt', 'desc')
        .limit(5)
        .get();

      if (!activeJobsSnapshot.empty) {
        activeJobs.push(...activeJobsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            startedAt: data.startedAt?.toDate?.() || data.startedAt,
            lastProcessedAt: data.lastProcessedAt?.toDate?.() || data.lastProcessedAt,
            completedAt: data.completedAt?.toDate?.() || data.completedAt,
            progressPercentage: data.totalPages ? Math.round((data.currentPage / data.totalPages) * 100) : 0
          };
        }));

        // Update active job stats
        stats.activeJobs = activeJobs.length;
        stats.activeProductJobs = activeJobs.filter(job => job.dataType === 'products').length;
        stats.activeSalesJobs = activeJobs.filter(job => job.dataType === 'sales').length;
      }

      // 2. Get recent completed jobs (last 24 hours)
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);
      
      const recentJobsSnapshot = await db.collection('takealotSyncJobs')
        .where('completedAt', '>=', admin.firestore.Timestamp.fromDate(yesterday))
        .orderBy('completedAt', 'desc')
        .limit(10)
        .get();

      if (!recentJobsSnapshot.empty) {
        recentJobs.push(...recentJobsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            startedAt: data.startedAt?.toDate?.() || data.startedAt,
            lastProcessedAt: data.lastProcessedAt?.toDate?.() || data.lastProcessedAt,
            completedAt: data.completedAt?.toDate?.() || data.completedAt,
            duration: data.completedAt && data.startedAt ? 
              Math.round((data.completedAt.toDate().getTime() - data.startedAt.toDate().getTime()) / 1000) : 0
          };
        }));

        // Calculate stats from recent jobs
        stats.completedJobsLast24h = recentJobs.length;
        stats.totalItemsProcessedLast24h = recentJobs.reduce((sum, job) => sum + (job.totalItemsProcessed || 0), 0);
      }

      // 3. Get recent sync logs from centralized logs collection
      const recentLogsSnapshot = await db.collection('logs')
        .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(yesterday))
        .orderBy('timestamp', 'desc')
        .limit(20)
        .get();

      if (!recentLogsSnapshot.empty) {
        recentLogs.push(...recentLogsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            timestamp: data.timestamp?.toDate?.() || data.timestamp
          };
        }));

        // Calculate error rate from logs
        const errorLogs = recentLogs.filter(log => 
          log.type === 'error' || log.type === 'fatal_error' || log.status === 'error'
        );
        stats.errorRate = recentLogs.length > 0 ? Math.round((errorLogs.length / recentLogs.length) * 100) : 0;
      }

      // 4. Get environment status
      const environmentStatus = {
        firebaseConfigured: !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || 
                           (!!process.env.FIREBASE_SERVICE_ACCOUNT_PROJECT_ID && 
                            !!process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY),
        takealotApiConfigured: !!process.env.TAKEALOT_API_KEY,
        cronSecretConfigured: !!process.env.CRON_SECRET
      };

    } catch (dbError: any) {
      console.error('[PublicSyncStatus] Database error:', dbError);
      throw new Error(`Database error: ${dbError.message}`);
    }

    console.log(`[PublicSyncStatus] Successfully fetched data: ${activeJobs.length} active jobs, ${recentJobs.length} recent jobs, ${recentLogs.length} logs`);

    // Get environment status
    const environmentStatus = {
      firebaseConfigured: !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || 
                         (!!process.env.FIREBASE_SERVICE_ACCOUNT_PROJECT_ID && 
                          !!process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY),
      takealotApiConfigured: !!process.env.TAKEALOT_API_KEY,
      cronSecretConfigured: !!process.env.CRON_SECRET
    };

    return NextResponse.json({
      success: true,
      stats,
      activeJobs,
      recentJobs,
      recentLogs,
      environmentStatus,
      message: 'Successfully fetched sync status from paginated system',
      isPaginatedSystemActive: true,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[PublicSyncStatus] Error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch sync status',
        message: error.message,
        isPaginatedSystemActive: false,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
