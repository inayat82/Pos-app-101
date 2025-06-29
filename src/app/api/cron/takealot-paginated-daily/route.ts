// src/app/api/cron/takealot-paginated-daily/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createOrResumeSyncJob, processJobChunk, getActiveSyncJobs } from '@/lib/paginatedSyncService';
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

    console.log('[PaginatedCron] Starting paginated daily Takealot sync');

    // First run automatic log cleanup (7-day retention)
    try {
      console.log('[PaginatedCron] Running automatic log cleanup...');
      const cleanupResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/api/cron/cleanup-old-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': request.headers.get('authorization') || ''
        }
      });
      
      if (cleanupResponse.ok) {
        const cleanupResult = await cleanupResponse.json();
        console.log(`[PaginatedCron] Cleanup completed: ${cleanupResult.deletedCount} old logs deleted`);
      }
    } catch (cleanupError) {
      console.warn('[PaginatedCron] Log cleanup failed:', cleanupError);
    }

    // Start centralized logging
    executionId = await cronJobLogger.startExecution({
      cronJobName: 'Takealot Paginated Daily Sync',
      cronJobType: 'scheduled',
      cronSchedule: '0 */2 * * *',
      apiSource: 'Takealot API',
      triggerType: 'cron',
      triggerSource: 'Vercel Cron',
      message: 'Starting paginated daily sync for all enabled integrations'
    });

    // Get enabled integrations
    const integrationsSnapshot = await db.collection('takealotIntegrations')
      .where('cronEnabled', '==', true)
      .get();

    if (integrationsSnapshot.empty) {
      console.log('[PaginatedCron] No enabled integrations found');
      
      // Complete execution with no data status
      if (executionId) {
        await cronJobLogger.completeExecution(executionId, {
          status: 'success',
          message: 'No enabled integrations found',
          details: 'No Takealot integrations have cron enabled'
        });
      }

      return NextResponse.json({ 
        success: true, 
        message: 'No enabled integrations found',
        processed: 0,
        executionId
      });
    }

    const results = [];
    const integrations = integrationsSnapshot.docs;
    
    // Define sync configuration for daily sync
    const syncConfigs = [
      { dataType: 'products' as const, maxPages: 10, pagesPerChunk: 3 }, // Process 3 pages per invocation, max 10 pages total
      { dataType: 'sales' as const, maxPages: 20, pagesPerChunk: 5 }     // Process 5 pages per invocation, max 20 pages total
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
            'paginated_daily',
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

          // Chunk processing result is now logged via centralized logging system

        } catch (error: any) {
          console.error(`[PaginatedCron] Error processing ${config.dataType} for integration ${integrationId}:`, error);
          
          integrationResults.push({
            dataType: config.dataType,
            success: false,
            message: error.message
          });

          // Error is now logged via centralized logging system
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

    const summaryMessage = `Paginated daily sync completed: ${successful} successful, ${failed} failed, ${totalItemsProcessed} items processed, ${totalPagesProcessed} pages processed. Active jobs: ${activeJobs.length} (${activeJobsByType.products} products, ${activeJobsByType.sales} sales)`;

    // Summary is now logged via centralized logging system

    console.log(`[PaginatedCron] ${summaryMessage}`);

    // Complete successful execution with new logging system
    if (executionId) {
      await cronJobLogger.completeExecution(executionId, {
        status: 'success',
        totalPages: totalPagesProcessed,
        totalReads: totalItemsProcessed,
        totalWrites: totalItemsProcessed,
        itemsProcessed: totalItemsProcessed,
        message: summaryMessage,
        details: `Processed ${results.length} integrations (${successful} successful, ${failed} failed) with ${activeJobs.length} active jobs remaining`
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
      results: results.map(r => ({
        integrationId: r.integrationId,
        success: r.success,
        taskCount: r.tasks?.length || 0,
        itemsProcessed: r.totalItemsProcessed || 0,
        pagesProcessed: r.totalPagesProcessed || 0
      })),
      processingTimeMs: Date.now() - startTime,
      executionId
    });

  } catch (error: any) {
    console.error('[PaginatedCron] Fatal error in paginated daily sync:', error);
    
    // Fatal error is now logged via centralized logging system

    // Complete failed execution with new logging system
    if (executionId) {
      await cronJobLogger.completeExecution(executionId, {
        status: 'failure',
        message: 'Fatal error during paginated daily sync',
        errorDetails: error.message,
        stackTrace: error.stack
      });
    }

    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        message: error.message,
        processingTimeMs: Date.now() - startTime,
        executionId
      },
      { status: 500 }
    );
  }
}
