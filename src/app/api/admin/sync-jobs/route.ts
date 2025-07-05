// src/app/api/admin/sync-jobs/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { cronJobLogger } from '@/lib/cronJobLogger';
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
    console.log('[SyncJobs] Starting sync jobs data fetch using centralized logging...');

    // Initialize stats
    const stats = {
      activeJobs: 0,
      activeProductJobs: 0,
      activeSalesJobs: 0,
      completedJobsLast24h: 0,
      totalItemsProcessedLast24h: 0,
      errorRate: 0
    };

    // Get recent logs from centralized cronJobLogs collection
    const activeJobs: any[] = [];
    const recentJobs: any[] = [];
    const recentLogs: any[] = [];

    try {
      // 1. Get recent logs from cronJobLogs collection (last 24 hours)
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);
      
      const recentLogsSnapshot = await db.collection('logs')
        .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(yesterday))
        .orderBy('timestamp', 'desc')
        .limit(50)
        .get();

      console.log(`[SyncJobs] Found ${recentLogsSnapshot.size} recent logs`);

      if (!recentLogsSnapshot.empty) {
        recentLogs.push(...recentLogsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            timestamp: data.timestamp?.toDate?.() || data.timestamp,
            createdAt: data.createdAt?.toDate?.() || data.createdAt
          };
        }));

        // Filter for different job types
        const productJobs = recentLogs.filter(log => 
          log.cronJobType?.includes('product') || 
          log.cronJobName?.includes('product') ||
          log.cronJobName?.includes('offer')
        );
        
        const salesJobs = recentLogs.filter(log => 
          log.cronJobType?.includes('sales') || 
          log.cronJobName?.includes('sales')
        );

        // Check for running jobs (those with status 'running' and recent timestamps)
        const runningJobs = recentLogs.filter(log => 
          log.status === 'running' && 
          log.timestamp && 
          (new Date().getTime() - new Date(log.timestamp).getTime()) < 3600000 // Less than 1 hour old
        );

        // Update stats
        stats.activeJobs = runningJobs.length;
        stats.activeProductJobs = runningJobs.filter(job => 
          job.cronJobType?.includes('product') || 
          job.cronJobName?.includes('product') ||
          job.cronJobName?.includes('offer')
        ).length;
        stats.activeSalesJobs = runningJobs.filter(job => 
          job.cronJobType?.includes('sales') || 
          job.cronJobName?.includes('sales')
        ).length;

        // Count completed jobs
        const completedJobs = recentLogs.filter(log => 
          log.status === 'success' || log.status === 'failure'
        );
        stats.completedJobsLast24h = completedJobs.length;
        stats.totalItemsProcessedLast24h = completedJobs.reduce((sum, job) => 
          sum + (job.itemsProcessed || job.recordsProcessed || 0), 0
        );

        // Calculate error rate
        const failedJobs = completedJobs.filter(job => job.status === 'failure');
        stats.errorRate = completedJobs.length > 0 ? 
          Math.round((failedJobs.length / completedJobs.length) * 100) : 0;
      }

      console.log(`[SyncJobs] Processed ${recentLogs.length} recent logs for stats`);

    } catch (dbError: any) {
      console.error('[SyncJobs] Database error:', dbError);
      // Don't throw error, just return empty stats
      console.log('[SyncJobs] Continuing with empty stats due to database error');
    }

    console.log(`[SyncJobs] Successfully processed sync data: ${stats.activeJobs} active jobs, ${stats.completedJobsLast24h} completed jobs`);

    return NextResponse.json({
      success: true,
      stats,
      activeJobs: recentLogs.filter(log => log.status === 'running'),
      recentJobs: recentLogs.filter(log => log.status === 'success' || log.status === 'failure').slice(0, 10),
      recentLogs: recentLogs.slice(0, 20),
      message: 'Successfully fetched sync job data from centralized logging system',
      isPaginatedSystemActive: true,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[SyncJobs] Error in sync jobs API:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch sync job data',
        message: error.message,
        isPaginatedSystemActive: false,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
