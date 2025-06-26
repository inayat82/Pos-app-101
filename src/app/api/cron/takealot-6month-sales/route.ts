// src/app/api/cron/takealot-6month-sales/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createOrResumeSyncJob, processJobChunk, getActiveSyncJobs } from '@/lib/paginatedSyncService';
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
  const startTime = Date.now();
  
  try {
    // Verify this is a cron request
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[6MonthCron] Starting 6-month sales sync');

    // Get enabled integrations
    const integrationsSnapshot = await db.collection('takealotIntegrations')
      .where('cronEnabled', '==', true)
      .get();

    if (integrationsSnapshot.empty) {
      console.log('[6MonthCron] No enabled integrations found');
      
      // Log to sync logs
      await db.collection('takealotSyncLogs').add({
        cronLabel: '6_month_sales',
        message: 'No enabled integrations found',
        timestamp: admin.firestore.Timestamp.now(),
        type: 'info',
        processingTimeMs: Date.now() - startTime
      });

      return NextResponse.json({ 
        success: true, 
        message: 'No enabled integrations found',
        processed: 0
      });
    }

    const results = [];
    const integrations = integrationsSnapshot.docs;
    
    // Process each integration
    for (const integrationDoc of integrations) {
      const integrationData = integrationDoc.data();
      const integrationId = integrationDoc.id;
      const adminId = integrationData.adminId;
      const apiKey = integrationData.apiKey;

      if (!apiKey) {
        console.warn(`[6MonthCron] No API key for integration ${integrationId}, skipping`);
        results.push({
          integrationId,
          adminId,
          success: false,
          message: 'No API key configured'
        });
        continue;
      }

      console.log(`[6MonthCron] Processing 6-month sales for integration ${integrationId}`);

      try {
        // Create or resume 6-month sales sync job
        const { jobId, shouldProcess, currentPage } = await createOrResumeSyncJob(
          adminId,
          'sales',
          '6_month_sales',
          apiKey,
          undefined, // No page limit - let date filtering handle the limit
          10, // Process 10 pages per chunk for comprehensive sync
          '6_months' // 6-month date filtering
        );

        if (!shouldProcess) {
          results.push({
            integrationId,
            adminId,
            jobId,
            success: true,
            message: '6-month sales job already completed',
            itemsProcessed: 0,
            pagesProcessed: 0
          });
          continue;
        }

        // Process a chunk of the job
        const chunkResult = await processJobChunk(jobId);

        results.push({
          integrationId,
          adminId,
          jobId,
          currentPage,
          dataType: 'sales',
          dateFilter: '6_months',
          ...chunkResult
        });

        // Log chunk processing result
        await db.collection('takealotSyncLogs').add({
          integrationId,
          adminId,
          cronLabel: '6_month_sales',
          dataType: 'sales',
          jobId,
          currentPage,
          itemsProcessed: chunkResult.itemsProcessed,
          pagesProcessed: chunkResult.pagesProcessed,
          reachedEnd: chunkResult.reachedEnd,
          success: chunkResult.success,
          dateFilter: '6_months',
          message: chunkResult.errorMessage || `Processed ${chunkResult.pagesProcessed} pages, ${chunkResult.itemsProcessed} items (6-month filter)`,
          timestamp: admin.firestore.Timestamp.now(),
          type: 'chunk_processed',
          processingTimeMs: Date.now() - startTime
        });

      } catch (error: any) {
        console.error(`[6MonthCron] Error processing 6-month sales for integration ${integrationId}:`, error);
        
        results.push({
          integrationId,
          adminId,
          success: false,
          message: error.message
        });

        // Log error
        await db.collection('takealotSyncLogs').add({
          integrationId,
          adminId,
          cronLabel: '6_month_sales',
          dataType: 'sales',
          error: error.message,
          timestamp: admin.firestore.Timestamp.now(),
          type: 'error',
          processingTimeMs: Date.now() - startTime
        });
      }

      // Add delay between integrations
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Generate summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const totalItemsProcessed = results.reduce((sum, r) => sum + (r.itemsProcessed || 0), 0);
    const totalPagesProcessed = results.reduce((sum, r) => sum + (r.pagesProcessed || 0), 0);

    // Get active 6-month jobs
    const activeJobs = await getActiveSyncJobs();
    const active6MonthJobs = activeJobs.filter(j => j.cronLabel === '6_month_sales');

    const summaryMessage = `6-month sales sync completed: ${successful} successful, ${failed} failed, ${totalItemsProcessed} items processed, ${totalPagesProcessed} pages processed. Active 6-month jobs: ${active6MonthJobs.length}`;

    // Log summary
    await db.collection('takealotSyncLogs').add({
      cronLabel: '6_month_sales',
      message: summaryMessage,
      totalIntegrations: results.length,
      successfulIntegrations: successful,
      failedIntegrations: failed,
      totalItemsProcessed,
      totalPagesProcessed,
      active6MonthJobs: active6MonthJobs.length,
      timestamp: admin.firestore.Timestamp.now(),
      type: 'summary',
      processingTimeMs: Date.now() - startTime
    });

    console.log(`[6MonthCron] ${summaryMessage}`);

    return NextResponse.json({
      success: true,
      message: summaryMessage,
      processed: results.length,
      totalItemsProcessed,
      totalPagesProcessed,
      active6MonthJobs: active6MonthJobs.length,
      sixMonthCutoffDate: new Date(Date.now() - (6 * 30 * 24 * 60 * 60 * 1000)).toISOString(),
      results: results.map(r => ({
        integrationId: r.integrationId,
        success: r.success,
        itemsProcessed: (r as any).itemsProcessed || 0,
        pagesProcessed: (r as any).pagesProcessed || 0,
        dateFilter: '6_months'
      })),
      processingTimeMs: Date.now() - startTime
    });

  } catch (error: any) {
    console.error('[6MonthCron] Fatal error in 6-month sales sync:', error);
    
    // Log fatal error
    await db.collection('takealotSyncLogs').add({
      cronLabel: '6_month_sales',
      error: error.message,
      timestamp: admin.firestore.Timestamp.now(),
      type: 'fatal_error',
      processingTimeMs: Date.now() - startTime
    });

    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        message: error.message,
        processingTimeMs: Date.now() - startTime
      },
      { status: 500 }
    );
  }
}
