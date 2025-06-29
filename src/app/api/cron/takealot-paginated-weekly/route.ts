// src/app/api/cron/takealot-paginated-weekly/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createOrResumeSyncJob, processJobChunk, getActiveSyncJobs, cleanupOldJobs } from '@/lib/paginatedSyncService';
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
  const startTime = Date.now();
  let executionId: string | null = null;
  
  try {
    // Verify this is a cron request
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[PaginatedCron] Starting paginated weekly Takealot sync');

    // Start centralized logging
    executionId = await cronJobLogger.startExecution({
      cronJobName: 'takealot-paginated-weekly',
      cronJobType: 'scheduled',
      cronSchedule: '0 0 * * 0', // Weekly on Sunday (as per vercel.json)
      apiSource: 'Takealot API',
      triggerType: 'cron',
      triggerSource: 'Vercel Cron',
      message: 'Starting paginated weekly sync for all enabled integrations'
    });

    // Clean up old completed jobs first
    const cleanedUpJobs = await cleanupOldJobs(7);
    if (cleanedUpJobs > 0) {
      console.log(`[PaginatedCron] Cleaned up ${cleanedUpJobs} old sync jobs`);
    }

    // Get enabled integrations
    const integrationsSnapshot = await db.collection('takealotIntegrations')
      .where('cronEnabled', '==', true)
      .get();

    if (integrationsSnapshot.empty) {
      console.log('[PaginatedCron] No enabled integrations found');
    // Legacy logging removed - now using centralized logging system

      return NextResponse.json({ 
        success: true, 
        message: 'No enabled integrations found',
        processed: 0
      });
    }

    const results = [];
    const integrations = integrationsSnapshot.docs;
    
    // Define sync configuration for weekly comprehensive sync
    const syncConfigs = [
      { dataType: 'products' as const, maxPages: undefined, pagesPerChunk: 5 }, // No limit, process 5 pages per invocation
      { dataType: 'sales' as const, maxPages: undefined, pagesPerChunk: 8 }     // No limit, process 8 pages per invocation
    ];

    // Process each integration
    for (const integrationDoc of integrations) {
      const integrationData = integrationDoc.data();
      const integrationId = integrationDoc.id;
      const adminId = integrationData.adminId;
      const apiKey = integrationData.apiKey;

      if (!apiKey) {
        console.warn(`[PaginatedCron] No API key for integration ${integrationId}, skipping`);
        results.push({
          integrationId,
          adminId,
          success: false,
          message: 'No API key configured'
        });
        continue;
      }

      console.log(`[PaginatedCron] Processing integration ${integrationId} for admin ${adminId}`);

      const integrationResults = [];

      // Process each data type (products and sales)
      for (const config of syncConfigs) {
        try {
          console.log(`[PaginatedCron] Processing ${config.dataType} for integration ${integrationId}`);

          // Create or resume sync job
          const { jobId, shouldProcess, currentPage } = await createOrResumeSyncJob(
            adminId,
            config.dataType,
            'paginated_weekly',
            apiKey,
            config.maxPages,
            config.pagesPerChunk
          );

          if (!shouldProcess) {
            integrationResults.push({
              dataType: config.dataType,
              jobId,
              success: true,
              message: 'Job already completed',
              itemsProcessed: 0,
              pagesProcessed: 0
            });
            continue;
          }

          // Process a chunk of the job
          const chunkResult = await processJobChunk(jobId);

          integrationResults.push({
            dataType: config.dataType,
            jobId,
            currentPage,
            ...chunkResult
          });

          // Legacy logging removed - now using centralized logging system

        } catch (error: any) {
          console.error(`[PaginatedCron] Error processing ${config.dataType} for integration ${integrationId}:`, error);
          
          integrationResults.push({
            dataType: config.dataType,
            success: false,
            message: error.message
          });
    // Legacy logging removed - now using centralized logging system
        }

        // Add small delay between data types
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      results.push({
        integrationId,
        adminId,
        success: integrationResults.every(r => r.success),
        tasks: integrationResults,
        totalItemsProcessed: integrationResults.reduce((sum, r) => sum + (r.itemsProcessed || 0), 0),
        totalPagesProcessed: integrationResults.reduce((sum, r) => sum + (r.pagesProcessed || 0), 0)
      });

      // Add delay between integrations to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Generate summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const totalItemsProcessed = results.reduce((sum, r) => sum + (r.totalItemsProcessed || 0), 0);
    const totalPagesProcessed = results.reduce((sum, r) => sum + (r.totalPagesProcessed || 0), 0);

    // Get active jobs for monitoring
    const activeJobs = await getActiveSyncJobs();
    const activeJobsByType = {
      products: activeJobs.filter(j => j.dataType === 'products').length,
      sales: activeJobs.filter(j => j.dataType === 'sales').length
    };

    const summaryMessage = `Paginated weekly sync completed: ${successful} successful, ${failed} failed, ${totalItemsProcessed} items processed, ${totalPagesProcessed} pages processed. Active jobs: ${activeJobs.length} (${activeJobsByType.products} products, ${activeJobsByType.sales} sales). Cleaned up ${cleanedUpJobs} old jobs.`;
    // Legacy logging removed - now using centralized logging system

    console.log(`[PaginatedCron] ${summaryMessage}`);

    // Complete centralized logging
    if (executionId) {
      await cronJobLogger.completeExecution(executionId, {
        status: failed > 0 && successful === 0 ? 'failure' : 'success',
        message: summaryMessage,
        totalPages: totalPagesProcessed,
        totalReads: totalPagesProcessed, // Each page is a read
        totalWrites: totalItemsProcessed, // Each item processed is a write
        itemsProcessed: totalItemsProcessed,
        details: `Processed ${results.length} integrations: ${successful} successful, ${failed} failed. Active jobs: ${activeJobs.length}. Cleaned up: ${cleanedUpJobs} old jobs`
      });
    }

    return NextResponse.json({
      success: true,
      message: summaryMessage,
      processed: results.length,
      totalItemsProcessed,
      totalPagesProcessed,
      activeJobs: activeJobs.length,
      activeJobsByType,
      cleanedUpJobs,
      results: results.map(r => ({
        integrationId: r.integrationId,
        success: r.success,
        taskCount: r.tasks?.length || 0,
        itemsProcessed: r.totalItemsProcessed || 0,
        pagesProcessed: r.totalPagesProcessed || 0
      })),
      processingTimeMs: Date.now() - startTime
    });

  } catch (error: any) {
    console.error('[PaginatedCron] Fatal error in paginated weekly sync:', error);
    
    // Complete centralized logging with error
    if (executionId) {
      await cronJobLogger.completeExecution(executionId, {
        status: 'failure',
        message: 'Fatal error in paginated weekly sync',
        errorDetails: error.message,
        stackTrace: error.stack
      });
    }
    // Legacy logging removed - now using centralized logging system

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
