// src/app/api/cron/takealot-6month-sales/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createOrResumeSyncJob, processJobChunk, getActiveSyncJobs } from '@/lib/paginatedSyncService';
import { SalesSyncService } from '@/lib/salesSyncService';
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

    console.log('[6MonthCron] Starting 6-month sales sync');

    // Start centralized logging
    executionId = await cronJobLogger.startExecution({
      cronJobName: 'takealot-6month-sales',
      cronJobType: 'scheduled',
      cronSchedule: '0 0 */12 * *', // Twice daily (as per vercel.json)
      apiSource: 'Takealot API',
      triggerType: 'cron',
      triggerSource: 'Vercel Cron',
      message: 'Starting 6-month sales sync for all enabled integrations'
    });

    // Get enabled integrations with comprehensive admin details
    const integrationsSnapshot = await db.collection('takealotIntegrations')
      .where('cronEnabled', '==', true)
      .get();

    if (integrationsSnapshot.empty) {
      console.log('[6MonthCron] No enabled integrations found');
      
      // Complete centralized logging
      if (executionId) {
        await cronJobLogger.completeExecution(executionId, {
          status: 'success',
          message: 'No enabled integrations found - nothing to process',
          totalPages: 0,
          totalReads: 0,
          totalWrites: 0,
          itemsProcessed: 0
        });
      }

      // No integrations message is now logged via centralized logging system

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
        // Get comprehensive admin and account details for centralized logging
        let adminName = 'Unknown Admin';
        let adminEmail = 'unknown@example.com';
        let accountName = 'Unknown Account';
        
        try {
          // First, get integration details including account name
          if (integrationData.accountName) {
            accountName = integrationData.accountName;
          }
          
          // Then get admin details from users collection
          const adminDoc = await db.collection('users').doc(adminId).get();
          if (adminDoc.exists) {
            const adminData = adminDoc.data();
            adminName = adminData?.name || adminData?.displayName || 'Unknown Admin';
            adminEmail = adminData?.email || 'unknown@example.com';
            // Override account name from user data if not found in integration
            if (accountName === 'Unknown Account') {
              accountName = adminData?.accountName || adminData?.company?.name || 'Unknown Account';
            }
          }
          
          console.log(`[6MonthCron] Retrieved details - Admin: ${adminName} (${adminEmail}), Account: ${accountName}`);
        } catch (adminError) {
          console.warn(`[6MonthCron] Could not fetch admin details for ${adminId}:`, adminError);
        }

        // Update centralized logging with complete admin and account information
        if (executionId) {
          await cronJobLogger.updateExecution(executionId, {
            message: `Processing 6-month sales for ${accountName} (Admin: ${adminName})`,
            details: `Integration: ${integrationId}, Account: ${accountName}, Admin: ${adminName} (${adminEmail})`
          });
        }

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

        // Chunk processing result is now logged via centralized logging system

      } catch (error: any) {
        console.error(`[6MonthCron] Error processing 6-month sales for integration ${integrationId}:`, error);
        
        results.push({
          integrationId,
          adminId,
          success: false,
          message: error.message
        });
    // Legacy logging removed - now using centralized logging system
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
    // Legacy logging removed - now using centralized logging system

    console.log(`[6MonthCron] ${summaryMessage}`);

    // Complete centralized logging
    if (executionId) {
      await cronJobLogger.completeExecution(executionId, {
        status: failed > 0 && successful === 0 ? 'failure' : 'success',
        message: summaryMessage,
        totalPages: totalPagesProcessed,
        totalReads: totalPagesProcessed, // Each page is a read
        totalWrites: totalItemsProcessed, // Each item processed is a write
        itemsProcessed: totalItemsProcessed,
        details: `Processed ${results.length} integrations: ${successful} successful, ${failed} failed. Active 6-month jobs: ${active6MonthJobs.length}`
      });
    }

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
    
    // Complete centralized logging with error
    if (executionId) {
      await cronJobLogger.completeExecution(executionId, {
        status: 'failure',
        message: 'Fatal error in 6-month sales sync',
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
